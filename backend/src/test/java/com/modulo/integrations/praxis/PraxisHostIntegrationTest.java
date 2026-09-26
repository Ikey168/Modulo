package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Modulo's client against a real Praxis host (krasforge/praxis {@code praxis.host}) with
 * the {@code fake} executor, mutual TLS from an internal CA and a hashed bearer token.
 * {@code scripts/praxis-host-it.sh} generates the CA, certificates, token and host config,
 * starts the host and runs this class; without PRAXIS_IT_URL it is skipped.
 */
@EnabledIfEnvironmentVariable(named = "PRAXIS_IT_URL", matches = "https://.+")
class PraxisHostIntegrationTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static PraxisClient client;
  private static PraxisController describer;

  private static PraxisProperties properties(String cert, String key) {
    PraxisProperties properties = new PraxisProperties();
    properties.setEnabled(true);
    properties.setBaseUrl(System.getenv("PRAXIS_IT_URL"));
    properties.setCaFile(System.getenv("PRAXIS_IT_CA"));
    properties.setClientCertFile(cert);
    properties.setClientKeyFile(key);
    properties.setTokenFile(System.getenv("PRAXIS_IT_TOKEN_FILE"));
    return properties;
  }

  @BeforeAll
  static void connect() {
    client = new PraxisClient(properties(System.getenv("PRAXIS_IT_CERT"), System.getenv("PRAXIS_IT_KEY")), JSON);
    describer = new PraxisController(null, null, null, new PraxisProperties(), JSON);
  }

  private static ObjectNode spec(String objective) {
    ObjectNode spec = JSON.createObjectNode().put("objective", objective).put("executor", "fake");
    spec.putObject("metadata").putObject("modulo").put("source", "modulo-it");
    return spec;
  }

  private static JsonNode finished(String processId, String user) throws InterruptedException {
    for (int attempt = 0; attempt < 100; attempt++) {
      JsonNode view = client.inspect(processId, user);
      if (PraxisControls.TERMINAL.contains(view.path("state").asText())) return view;
      Thread.sleep(100);
    }
    throw new AssertionError("process did not finish: " + processId);
  }

  @Test
  void submitIsIdempotentPerUserAndKey() {
    String key = "it-" + UUID.randomUUID();
    JsonNode first = client.submit(spec("Summarize the release notes"), key, "user-1");
    JsonNode again = client.submit(spec("Summarize the release notes"), key, "user-1");

    assertThat(first.path("duplicate").asBoolean()).isFalse();
    assertThat(again.path("duplicate").asBoolean()).isTrue();
    assertThat(again.path("process_id").asText()).isEqualTo(first.path("process_id").asText());
    // The same key with a different spec is a conflict, not a silent second process.
    assertThatThrownBy(() -> client.submit(spec("Something else"), key, "user-1"))
        .isInstanceOfSatisfying(PraxisException.class, error -> {
          assertThat(error.status()).isEqualTo(409);
          assertThat(error.code()).isEqualTo("submission_idempotency_conflict");
        });
  }

  @Test
  void aFinishedTaskShowsExecutionAndVerificationSeparately() throws Exception {
    String id = client.submit(spec("Draft a status update"), "it-" + UUID.randomUUID(), "user-1").path("process_id").asText();
    ObjectNode view = describer.describe((ObjectNode) finished(id, "user-1"));

    assertThat(view.path("summary").path("state").asText()).isEqualTo("completed");
    assertThat(view.path("summary").path("execution").path("status").asText()).isEqualTo("completed");
    assertThat(view.path("summary").path("verification").path("available").asBoolean()).isTrue();
    assertThat(view.path("summary").path("verification").path("approved").asBoolean()).isTrue();
    assertThat(view.path("summary").path("publishable").asBoolean()).isTrue();
    assertThat(view.path("controls").path("cancel").path("supported").asBoolean()).isTrue();
    assertThat(view.path("controls").path("cancel").path("available").asBoolean()).isFalse();
    assertThat(view.path("controls").path("retry").path("available").asBoolean()).isFalse();

    JsonNode tree = client.tree(id, "user-1");
    assertThat(tree.path("root").asText()).isEqualTo(id);
    assertThat(tree.path("processes")).hasSize(1);
    assertThat(client.approvals(id, "user-1").path("approvals")).isEmpty();
  }

  @Test
  void eventsStreamInOrderAndResumeFromAPersistedCursor() throws Exception {
    String id = client.submit(spec("Collect sources"), "it-" + UUID.randomUUID(), "user-1").path("process_id").asText();
    List<PraxisClient.Event> seen = new ArrayList<>();
    try (PraxisClient.EventStream events = client.events(id, 0, false, "user-1")) {
      Optional<PraxisClient.Event> next;
      while ((next = events.next()).isPresent()) seen.add(next.get());
    }
    assertThat(seen).isNotEmpty();
    assertThat(seen.get(0).event().path("type").asText()).isEqualTo("process.created");
    assertThat(seen.get(0).event().path("payload").path("actor").asText()).isEqualTo("modulo/user-1");
    for (int index = 1; index < seen.size(); index++) {
      assertThat(seen.get(index).cursor()).isGreaterThan(seen.get(index - 1).cursor());
    }

    long middle = seen.get(seen.size() / 2).cursor();
    List<Long> resumed = new ArrayList<>();
    try (PraxisClient.EventStream events = client.events(id, middle, false, "user-1")) {
      Optional<PraxisClient.Event> next;
      while ((next = events.next()).isPresent()) resumed.add(next.get().cursor());
    }
    assertThat(resumed).allSatisfy(cursor -> assertThat(cursor).isGreaterThan(middle));
    assertThat(resumed).containsExactlyElementsOf(seen.stream().map(PraxisClient.Event::cursor).filter(c -> c > middle).toList());
  }

  @Test
  void controlNeedsTheCurrentAttempt() throws Exception {
    String id = client.submit(spec("Check links"), "it-" + UUID.randomUUID(), "user-1").path("process_id").asText();
    JsonNode view = finished(id, "user-1");
    assertThatThrownBy(() -> client.control(id, "stale-attempt", "cancel", null, "self", "user-1"))
        .isInstanceOfSatisfying(PraxisException.class, error -> assertThat(error.code()).isEqualTo("stale_process_attempt"));
    JsonNode receipt = client.control(id, view.path("attempt_id").asText(), "cancel", null, "self", "user-1");
    assertThat(receipt.path("control").path(id).path("applied").asBoolean()).isFalse();
  }

  @Test
  void publicationIsRefusedCleanlyWhenTheHostHasItTurnedOff() throws Exception {
    String id = client.submit(spec("Write a summary"), "it-" + UUID.randomUUID(), "user-1").path("process_id").asText();
    finished(id, "user-1");
    assertThatThrownBy(() -> client.publish(id, "user-1")).isInstanceOfSatisfying(PraxisException.class, error -> {
      assertThat(error.status()).isEqualTo(404);
      assertThat(error.code()).isEqualTo("route_not_found");
    });
  }

  @Test
  void aUserReachesOnlyTheirOwnProcessesWhileModuloItselfReachesAll() throws Exception {
    String id = client.submit(spec("Private task"), "it-" + UUID.randomUUID(), "user-1").path("process_id").asText();
    assertThatThrownBy(() -> client.inspect(id, "user-2")).isInstanceOfSatisfying(PraxisException.class,
        error -> assertThat(error.status()).isEqualTo(403));
    assertThat(client.inspect(id, null).path("process_id").asText()).isEqualTo(id);
  }

  @Test
  void aWrongTokenOrACertificateFromAnotherCaIsRejected() throws IOException {
    Path wrongToken = Files.createTempFile("praxis-token", "");
    Files.writeString(wrongToken, "praxis_this-is-not-the-modulo-token");
    PraxisProperties wrong = properties(System.getenv("PRAXIS_IT_CERT"), System.getenv("PRAXIS_IT_KEY"));
    wrong.setTokenFile(wrongToken.toString());
    assertThatThrownBy(() -> new PraxisClient(wrong, JSON).inspect("does-not-exist", "user-1"))
        .isInstanceOfSatisfying(PraxisException.class, error -> assertThat(error.status()).isEqualTo(401));

    PraxisClient rogue = new PraxisClient(properties(System.getenv("PRAXIS_IT_ROGUE_CERT"), System.getenv("PRAXIS_IT_ROGUE_KEY")), JSON);
    assertThatThrownBy(() -> rogue.inspect("does-not-exist", "user-1")).isInstanceOfSatisfying(PraxisException.class,
        error -> assertThat(error.code()).isEqualTo("praxis_unavailable"));
    Files.deleteIfExists(wrongToken);
  }
}
