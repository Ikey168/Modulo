package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.audit.AuditEventService;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

/** The inbox listing of pending Praxis approvals (#553), against a loopback Praxis stand-in. */
class PraxisApprovalsTest {
  private static final String TOKEN = "praxis_test-token-0123456789";
  private final ObjectMapper json = new ObjectMapper();
  private final PraxisIdentity identity = mock(PraxisIdentity.class);
  private final PraxisSubmissions submissions = mock(PraxisSubmissions.class);
  private final AuditEventService audit = mock(AuditEventService.class);
  private final List<String[]> requests = new CopyOnWriteArrayList<>();
  private HttpServer server;
  private ObjectProvider<PraxisClient> clients;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void start() throws IOException {
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    server.start();
    PraxisProperties properties = new PraxisProperties();
    properties.setEnabled(true);
    properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
    PraxisClient client = new PraxisClient(properties, json, Map.of("PRAXIS_MODULO_TOKEN", TOKEN)::get);
    clients = mock(ObjectProvider.class);
    when(clients.getIfAvailable()).thenReturn(client);
    when(identity.current()).thenReturn(new PraxisIdentity.Principal(7, "user-7"));
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  private void route(String path, int status, String body) {
    server.createContext(path, exchange -> {
      requests.add(new String[] {exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
          exchange.getRequestHeaders().getFirst("X-Praxis-On-Behalf-Of"),
          new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)});
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(status, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
  }

  private static Map<String, Object> submission(String processId, String objective) {
    return Map.of("processId", processId, "objective", objective, "executor", "fake", "publishRequested", false,
        "createdAt", "2026-09-27T08:00:00Z");
  }

  @Test
  @SuppressWarnings("unchecked")
  void listsPendingApprovalsOfTheUsersSubmittedProcessesWithDelegatedIdentity() {
    when(submissions.list(7)).thenReturn(List.of(submission("p-1", "Deploy docs"), submission("p-2", "Tidy repo")));
    route("/v1/processes/p-1/approvals", 200, "{\"approvals\":[{\"effect_id\":\"e-1\",\"process_id\":\"p-1c\","
        + "\"attempt_id\":\"a-3\",\"kind\":\"file_write\",\"target\":\"docs/x.md\",\"version\":2,\"reversible\":true,"
        + "\"payload\":{},\"requested_at\":\"2026-09-27T09:00:00Z\"}]}");
    route("/v1/processes/p-2/approvals", 200, "{\"approvals\":[]}");
    // Another user's process exists on the host but was never submitted by user 7.
    route("/v1/processes/p-other/approvals", 200, "{\"approvals\":[{\"effect_id\":\"e-9\"}]}");

    Map<String, Object> result = new PraxisApprovals(clients, identity, submissions, audit, json).pending();

    assertThat(result).containsEntry("configured", true).containsEntry("complete", true);
    List<Map<String, Object>> approvals = (List<Map<String, Object>>) result.get("approvals");
    assertThat(approvals).hasSize(1);
    assertThat(approvals.get(0))
        .containsEntry("source", "praxis").containsEntry("processId", "p-1").containsEntry("effectProcessId", "p-1c")
        .containsEntry("effectId", "e-1").containsEntry("version", 2L).containsEntry("attemptId", "a-3")
        .containsEntry("title", "file write → docs/x.md").containsEntry("summary", "Deploy docs")
        .containsEntry("requestedAt", "2026-09-27T09:00:00Z").containsEntry("submittedAt", "2026-09-27T08:00:00Z");
    assertThat(requests).extracting(request -> request[1])
        .containsExactly("/v1/processes/p-1/approvals", "/v1/processes/p-2/approvals");
    assertThat(requests).allSatisfy(request -> assertThat(request[2]).isEqualTo("user-7"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void processesPraxisNoLongerShowsAreSkippedAndOutagesMarkTheListIncomplete() {
    when(submissions.list(7)).thenReturn(List.of(submission("gone", "a"), submission("broken", "b"), submission("p-1", "c")));
    route("/v1/processes/gone/approvals", 404, "{\"error\":{\"code\":\"process_not_found\"}}");
    route("/v1/processes/broken/approvals", 500, "{\"error\":{\"code\":\"internal\"}}");
    route("/v1/processes/p-1/approvals", 200, "{\"approvals\":[{\"effect_id\":\"e-1\",\"attempt_id\":\"a\",\"version\":1}]}");

    Map<String, Object> result = new PraxisApprovals(clients, identity, submissions, audit, json).pending();

    assertThat(result).containsEntry("complete", false);
    assertThat((List<Map<String, Object>>) result.get("approvals")).singleElement()
        .satisfies(item -> assertThat(item).containsEntry("effectId", "e-1").containsEntry("requestedAt", null));
  }

  @Test
  @SuppressWarnings("unchecked")
  void notConfiguredIsAnEmptyListNotAnError() {
    ObjectProvider<PraxisClient> none = mock(ObjectProvider.class);
    Map<String, Object> result = new PraxisApprovals(none, identity, submissions, audit, json).pending();

    assertThat(result).containsEntry("configured", false).containsEntry("complete", true);
    assertThat((List<?>) result.get("approvals")).isEmpty();
    verify(submissions, never()).list(anyLong());
    verify(identity, never()).current();
  }

  // ---------------------------------------------------------------- decisions (#555)

  @Test
  void anAcceptedDecisionIsRelayedWithItsBindingAndThenAudited() throws Exception {
    route("/v1/processes/p-1/approvals", 200, "{\"effect\":{\"effect_id\":\"e-1\",\"state\":\"approved\"}}");

    JsonNode accepted = new PraxisApprovals(clients, identity, submissions, audit, json)
        .decide("p-1", "e-1", 4, "a-2", true, "Diff checked");

    assertThat(accepted.path("effect").path("state").asText()).isEqualTo("approved");
    String[] request = requests.get(0);
    assertThat(request[0]).isEqualTo("POST");
    assertThat(request[2]).isEqualTo("user-7");
    JsonNode sent = json.readTree(request[3]);
    assertThat(sent.path("effect_id").asText()).isEqualTo("e-1");
    assertThat(sent.path("version").asLong()).isEqualTo(4);
    assertThat(sent.path("attempt_id").asText()).isEqualTo("a-2");
    assertThat(sent.path("approved").asBoolean()).isTrue();
    assertThat(sent.path("reason").asText()).isEqualTo("Diff checked");

    ArgumentCaptor<String> detail = ArgumentCaptor.forClass(String.class);
    verify(audit).record(eq(PraxisApprovals.AUDIT_EVENT), isNull(), isNull(), isNull(), eq("APPROVED"), isNull(),
        detail.capture());
    JsonNode entry = json.readTree(detail.getValue());
    assertThat(entry.path("source").asText()).isEqualTo("praxis");
    assertThat(entry.path("ownerId").asLong()).isEqualTo(7);
    assertThat(entry.path("processId").asText()).isEqualTo("p-1");
    assertThat(entry.path("effectId").asText()).isEqualTo("e-1");
    assertThat(entry.path("version").asLong()).isEqualTo(4);
    assertThat(entry.path("attemptId").asText()).isEqualTo("a-2");
    assertThat(entry.path("decision").asText()).isEqualTo("approve");
    assertThat(entry.path("reason").asText()).isEqualTo("Diff checked");
    assertThat(entry.path("decidedAt").asText()).isNotBlank();
  }

  @Test
  void anAcceptedRejectionIsAuditedAsRejected() {
    route("/v1/processes/p-1/approvals", 200, "{}");
    new PraxisApprovals(clients, identity, submissions, audit, json).decide("p-1", "e-1", 1, "a-1", false, "Wrong target");
    verify(audit).record(eq(PraxisApprovals.AUDIT_EVENT), isNull(), isNull(), isNull(), eq("REJECTED"), isNull(),
        anyString());
  }

  @Test
  void aStaleAttemptIsNotAudited() {
    route("/v1/processes/p-1/approvals", 409, "{\"error\":{\"code\":\"stale_process_attempt\",\"details\":{}}}");
    PraxisApprovals approvals = new PraxisApprovals(clients, identity, submissions, audit, json);

    assertThatThrownBy(() -> approvals.decide("p-1", "e-1", 1, "old", true, "ok"))
        .isInstanceOfSatisfying(PraxisException.class, error -> {
          assertThat(error.status()).isEqualTo(409);
          assertThat(error.code()).isEqualTo("stale_process_attempt");
        });
    verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void aDecisionPraxisRefusesIsNotAudited() {
    route("/v1/processes/p-1/approvals", 409, "{\"error\":{\"code\":\"approval_rejected\",\"details\":{}}}");
    route("/v1/processes/p-2/approvals", 403, "{\"error\":{\"code\":\"action_denied\",\"details\":{}}}");
    PraxisApprovals approvals = new PraxisApprovals(clients, identity, submissions, audit, json);

    assertThatThrownBy(() -> approvals.decide("p-1", "e-1", 1, "a-1", true, "ok")).isInstanceOf(PraxisException.class);
    assertThatThrownBy(() -> approvals.decide("p-2", "e-2", 1, "a-1", false, "no")).isInstanceOf(PraxisException.class);
    verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void aDecisionWithoutPraxisConfiguredIsRefusedAndNotAudited() {
    ObjectProvider<PraxisClient> none = mock(ObjectProvider.class);
    assertThatThrownBy(() -> new PraxisApprovals(none, identity, submissions, audit, json)
        .decide("p-1", "e-1", 1, "a-1", true, "ok"))
        .isInstanceOfSatisfying(PraxisException.class, error -> assertThat(error.code()).isEqualTo("praxis_not_configured"));
    verify(audit, never()).record(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void aFailedAuditWriteDoesNotReportAnAcceptedDecisionAsFailed() {
    route("/v1/processes/p-1/approvals", 200, "{\"accepted\":true}");
    doThrow(new IllegalStateException("database down")).when(audit)
        .record(any(), any(), any(), any(), any(), any(), any());

    JsonNode accepted = new PraxisApprovals(clients, identity, submissions, audit, json)
        .decide("p-1", "e-1", 1, "a-1", true, "ok");

    assertThat(accepted.path("accepted").asBoolean()).isTrue();
  }
}
