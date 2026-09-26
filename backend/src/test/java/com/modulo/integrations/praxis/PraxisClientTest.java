package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The wire contract of krasforge/praxis docs/host.md, exercised against a loopback stand-in. */
class PraxisClientTest {
  private static final String TOKEN = "praxis_test-token-0123456789";
  private final ObjectMapper json = new ObjectMapper();
  private final List<Recorded> requests = new CopyOnWriteArrayList<>();
  private HttpServer server;
  private PraxisClient client;

  record Recorded(String method, String path, Headers headers, String body) {}

  @BeforeEach
  void start() throws IOException {
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    server.start();
    PraxisProperties properties = new PraxisProperties();
    properties.setEnabled(true);
    properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
    client = new PraxisClient(properties, json, Map.of("PRAXIS_MODULO_TOKEN", TOKEN)::get);
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  private void route(String path, int status, String contentType, String body, Map<String, String> headers) {
    server.createContext(path, exchange -> {
      requests.add(new Recorded(exchange.getRequestMethod(), exchange.getRequestURI().toString(),
          exchange.getRequestHeaders(), new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
      exchange.getResponseHeaders().add("Content-Type", contentType);
      headers.forEach(exchange.getResponseHeaders()::add);
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
      if (bytes.length > 0) exchange.getResponseBody().write(bytes);
      exchange.close();
    });
  }

  private void route(String path, int status, String body) {
    route(path, status, "application/json", body, Map.of());
  }

  @Test
  void submitSendsTokenDelegatedIdentityAndIdempotencyKey() {
    route("/v1/processes", 202, "{\"process_id\":\"p-1\",\"state\":\"pending\",\"duplicate\":false}");
    JsonNode receipt = client.submit(json.createObjectNode().put("objective", "o").put("executor", "fake"), "ticket-42", "user-7");

    assertThat(receipt.path("process_id").asText()).isEqualTo("p-1");
    Recorded request = requests.get(0);
    assertThat(request.method()).isEqualTo("POST");
    assertThat(request.headers().getFirst("Authorization")).isEqualTo("Bearer " + TOKEN);
    assertThat(request.headers().getFirst("X-Praxis-On-Behalf-Of")).isEqualTo("user-7");
    assertThat(request.headers().getFirst("Idempotency-Key")).isEqualTo("ticket-42");
    assertThat(request.body()).contains("\"objective\":\"o\"");
  }

  @Test
  void actingAsItselfSendsNoDelegationHeader() {
    route("/v1/processes/p-1", 200, "{\"process_id\":\"p-1\",\"attempt_id\":\"a\",\"state\":\"running\"}");
    client.inspect("p-1", null);
    assertThat(requests.get(0).headers().containsKey("X-Praxis-On-Behalf-Of")).isFalse();
  }

  @Test
  void rejectsIdentitiesAndProcessIdsPraxisWouldNotAccept() {
    assertThatThrownBy(() -> client.inspect("p-1", "../admin")).hasMessage("invalid_delegated_identity");
    assertThatThrownBy(() -> client.inspect("p-1", "a\r\nX-Evil: 1")).hasMessage("invalid_delegated_identity");
    assertThatThrownBy(() -> client.inspect("../health", "user-1")).hasMessage("invalid_process_identity");
    assertThatThrownBy(() -> client.inspect("p/1", "user-1")).hasMessage("invalid_process_identity");
    assertThatThrownBy(() -> client.submit(json.createObjectNode(), "", "user-1")).hasMessage("invalid_idempotency_key");
    assertThat(requests).isEmpty();
  }

  @Test
  void praxisErrorsKeepTheirStatusCodeAndRetryAfter() {
    route("/v1/processes/p-1/control", 409, "{\"error\":{\"code\":\"stale_process_attempt\",\"details\":{}}}");
    route("/v1/processes/p-2/events", 429, "application/json", "{\"error\":{\"code\":\"stream_limited\",\"details\":{}}}",
        Map.of("Retry-After", "7"));

    assertThatThrownBy(() -> client.control("p-1", "old", "cancel", null, "tree", "user-1"))
        .isInstanceOfSatisfying(PraxisException.class, error -> {
          assertThat(error.status()).isEqualTo(409);
          assertThat(error.code()).isEqualTo("stale_process_attempt");
        });
    assertThat(requests.get(0).body()).contains("\"attempt_id\":\"old\"", "\"operation\":\"cancel\"", "\"policy\":\"tree\"");
    assertThatThrownBy(() -> client.events("p-2", 0, false, "user-1"))
        .isInstanceOfSatisfying(PraxisException.class, error -> {
          assertThat(error.status()).isEqualTo(429);
          assertThat(error.code()).isEqualTo("stream_limited");
          assertThat(error.retryAfter()).isEqualTo("7");
        });
  }

  @Test
  void refusesRedirectsAndNonJsonErrorBodies() {
    route("/v1/processes/p-1", 302, "application/json", "", Map.of("Location", "https://elsewhere.example/"));
    route("/v1/processes/p-2", 502, "text/html", "<html>bad gateway</html>", Map.of());
    assertThatThrownBy(() -> client.inspect("p-1", "user-1")).isInstanceOfSatisfying(PraxisException.class,
        error -> assertThat(error.code()).isEqualTo("praxis_redirect_refused"));
    assertThatThrownBy(() -> client.inspect("p-2", "user-1")).isInstanceOfSatisfying(PraxisException.class,
        error -> assertThat(error.code()).isEqualTo("praxis_http_502"));
  }

  @Test
  void eventsResumeAfterTheCursorAndParseEachFrame() throws IOException {
    String stream = ": keep-alive\n\n"
        + "id: 5\nevent: praxis\ndata: {\"cursor\": 5, \"event\": {\"process_id\": \"p-1\", \"type\": \"process.started\"}}\n\n"
        + "id: 9\nevent: praxis\ndata: {\"cursor\": 9, \"event\": {\"process_id\": \"p-1\", \"type\": \"process.completed\"}}\n\n";
    route("/v1/processes/p-1/events", 200, "text/event-stream", stream, Map.of());

    try (PraxisClient.EventStream events = client.events("p-1", 3, false, "user-1")) {
      Optional<PraxisClient.Event> first = events.next();
      Optional<PraxisClient.Event> second = events.next();
      assertThat(first).map(PraxisClient.Event::cursor).contains(5L);
      assertThat(second.map(event -> event.event().path("type").asText())).contains("process.completed");
      assertThat(events.next()).isEmpty();
    }
    assertThat(requests.get(0).path()).isEqualTo("/v1/processes/p-1/events?after=3&tree=false");
  }

  @Test
  void eventsRejectCursorsThatDoNotAdvanceOrForeignProcesses() {
    route("/v1/processes/p-1/events", 200, "text/event-stream",
        "event: praxis\ndata: {\"cursor\": 2, \"event\": {\"process_id\": \"p-1\"}}\n\n", Map.of());
    route("/v1/processes/p-2/events", 200, "text/event-stream",
        "event: praxis\ndata: {\"cursor\": 8, \"event\": {\"process_id\": \"other\"}}\n\n", Map.of());
    assertThatThrownBy(() -> {
      try (PraxisClient.EventStream events = client.events("p-1", 2, false, "user-1")) { events.next(); }
    }).hasMessage("praxis_invalid_event_stream");
    assertThatThrownBy(() -> {
      try (PraxisClient.EventStream events = client.events("p-2", 0, false, "user-1")) { events.next(); }
    }).hasMessage("praxis_invalid_event_stream");
  }

  @Test
  void decisionsAndPublicationUseThePraxisBodies() {
    route("/v1/processes/p-1/approvals", 200, "{\"effect\":{},\"approvals\":[]}");
    route("/v1/processes/p-1/publication", 200, "{\"publication\":{\"status\":\"accepted\"}}");
    client.decide("p-1", "e-1", 3, "a-1", true, "Looks right", "user-1");
    assertThat(client.publish("p-1", "user-1").path("publication").path("status").asText()).isEqualTo("accepted");
    assertThat(requests.get(0).body()).contains("\"effect_id\":\"e-1\"", "\"version\":3", "\"attempt_id\":\"a-1\"",
        "\"approved\":true", "\"reason\":\"Looks right\"");
    assertThat(requests.get(1).method()).isEqualTo("POST");
  }

  @Test
  void refusedPublicationsReportTheReceiptReason() {
    route("/v1/processes/p-1/publication", 409,
        "{\"process_id\":\"p-1\",\"publication\":{\"status\":\"rejected\",\"reason\":\"publication_ineligible\",\"document_id\":null}}");
    route("/v1/processes/p-2/publication", 503, "{\"publication\":{\"status\":\"unavailable\",\"reason\":\"\"}}");
    assertThatThrownBy(() -> client.publish("p-1", "user-1")).isInstanceOfSatisfying(PraxisException.class, error -> {
      assertThat(error.status()).isEqualTo(409);
      assertThat(error.code()).isEqualTo("publication_ineligible");
    });
    assertThatThrownBy(() -> client.publish("p-2", "user-1")).isInstanceOfSatisfying(PraxisException.class,
        error -> assertThat(error.code()).isEqualTo("unavailable"));
  }

  @Test
  void onlyHttpsOriginsUnlessLoopback() {
    assertThatThrownBy(() -> PraxisClient.origin("http://praxis.example.com")).hasMessageContaining("https");
    assertThatThrownBy(() -> PraxisClient.origin("https://praxis.internal:8443/v1")).hasMessageContaining("origin");
    assertThatThrownBy(() -> PraxisClient.origin("https://user@praxis.internal")).hasMessageContaining("origin");
    assertThat(PraxisClient.origin("https://praxis.internal:8443/").toString()).isEqualTo("https://praxis.internal:8443");
  }
}
