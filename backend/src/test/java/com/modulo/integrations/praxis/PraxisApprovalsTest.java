package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.beans.factory.ObjectProvider;

/** The inbox listing of pending Praxis approvals (#553), against a loopback Praxis stand-in. */
class PraxisApprovalsTest {
  private static final String TOKEN = "praxis_test-token-0123456789";
  private final ObjectMapper json = new ObjectMapper();
  private final PraxisIdentity identity = mock(PraxisIdentity.class);
  private final PraxisSubmissions submissions = mock(PraxisSubmissions.class);
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
          exchange.getRequestHeaders().getFirst("X-Praxis-On-Behalf-Of")});
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

    Map<String, Object> result = new PraxisApprovals(clients, identity, submissions).pending();

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

    Map<String, Object> result = new PraxisApprovals(clients, identity, submissions).pending();

    assertThat(result).containsEntry("complete", false);
    assertThat((List<Map<String, Object>>) result.get("approvals")).singleElement()
        .satisfies(item -> assertThat(item).containsEntry("effectId", "e-1").containsEntry("requestedAt", null));
  }

  @Test
  @SuppressWarnings("unchecked")
  void notConfiguredIsAnEmptyListNotAnError() {
    ObjectProvider<PraxisClient> none = mock(ObjectProvider.class);
    Map<String, Object> result = new PraxisApprovals(none, identity, submissions).pending();

    assertThat(result).containsEntry("configured", false).containsEntry("complete", true);
    assertThat((List<?>) result.get("approvals")).isEmpty();
    verify(submissions, never()).list(anyLong());
    verify(identity, never()).current();
  }
}
