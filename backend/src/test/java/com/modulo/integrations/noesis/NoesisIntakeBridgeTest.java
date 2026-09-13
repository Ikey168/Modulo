package com.modulo.integrations.noesis;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

class NoesisIntakeBridgeTest {
  @TempDir Path temp;
  private final ObjectMapper json = new ObjectMapper();

  @Test
  void usesServerCredentialAndMcpSessionWithoutExposingToken() throws Exception {
    String token = "a".repeat(32);
    Path credentials = temp.resolve("noesis-credentials.json");
    Files.writeString(credentials, "{\"1\":{\"token\":\"" + token + "\"}}");
    Files.setPosixFilePermissions(credentials,
        Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE));
    AtomicInteger calls = new AtomicInteger();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/mcp", exchange -> {
      try {
        assertEquals("Bearer " + token, exchange.getRequestHeaders().getFirst("Authorization"));
        JsonNode request = json.readTree(exchange.getRequestBody());
        String method = request.path("method").asText();
        if (method.equals("initialize")) {
          assertEquals("2025-03-26", request.path("params").path("protocolVersion").asText());
          exchange.getResponseHeaders().set("Mcp-Session-Id", "session-1");
          exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
          byte[] body = ("event: message\r\ndata: {\"jsonrpc\":\"2.0\",\"id\":"
              + request.path("id").asInt() + ",\"result\":{\"protocolVersion\":\"2025-03-26\"}}\r\n\r\n")
              .getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
        } else if (method.equals("notifications/initialized")) {
          assertEquals("session-1", exchange.getRequestHeaders().getFirst("Mcp-Session-Id"));
          exchange.sendResponseHeaders(202, -1);
        } else {
          assertEquals("session-1", exchange.getRequestHeaders().getFirst("Mcp-Session-Id"));
          assertEquals("tools/call", method);
          assertEquals("discover_intake_modes", request.path("params").path("name").asText());
          calls.incrementAndGet();
          exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
          byte[] body = ("event: message\r\ndata: {\"jsonrpc\":\"2.0\",\"id\":"
              + request.path("id").asInt() + ",\"result\":{\"structuredContent\":{\"contract\":\"noesis-intake-modes-v1\"}}}\r\n\r\n")
              .getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
        }
      } finally {
        exchange.close();
      }
    });
    server.start();
    try {
      NoesisIntakeBridge bridge = new NoesisIntakeBridge(json,
          "http://127.0.0.1:" + server.getAddress().getPort() + "/mcp", credentials.toString());
      JsonNode result = bridge.call(1L, "discover_intake_modes", json.createObjectNode());
      assertEquals("noesis-intake-modes-v1", result.path("contract").asText());
      assertFalse(result.toString().contains(token));
      assertEquals(1, calls.get());
      assertEquals("NOESIS_USER_NOT_MAPPED", assertThrows(
          NoesisIntakeBridge.BridgeException.class,
          () -> bridge.call(2L, "discover_intake_modes", json.createObjectNode())).code());
      assertEquals("NOESIS_TOOL_UNSUPPORTED", assertThrows(
          NoesisIntakeBridge.BridgeException.class,
          () -> bridge.call(1L, "create_research_project", json.createObjectNode())).code());
      assertTrue(NoesisIntakeBridge.TOOLS.contains("create_research_decision"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("inspect_research_decision"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("start_problem_session"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("record_problem_step"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("promote_problem_playbook"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("inspect_intake_playbook"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("revise_intake_playbook"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("start_guided_playbook_run"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("inspect_guided_playbook_run"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("command_guided_playbook_run"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("create_practice_pack"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("list_due_practice"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("start_practice_review"));
      assertTrue(NoesisIntakeBridge.TOOLS.contains("command_practice_review"));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void rejectsInsecureCredentialsAndUnconfiguredEndpoints() throws Exception {
    Path credentials = temp.resolve("insecure.json");
    Files.writeString(credentials, "{\"1\":{\"token\":\"" + "a".repeat(32) + "\"}}");
    Files.setPosixFilePermissions(credentials, Set.of(
        PosixFilePermission.OWNER_READ, PosixFilePermission.GROUP_READ));
    NoesisIntakeBridge bridge = new NoesisIntakeBridge(json,
        "http://127.0.0.1:9999/mcp", credentials.toString());
    var error = assertThrows(NoesisIntakeBridge.BridgeException.class,
        () -> bridge.call(1L, "discover_intake_modes", json.createObjectNode()));
    assertEquals("NOESIS_CREDENTIALS_INSECURE", error.code());
    assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.status());
    assertThrows(NoesisIntakeBridge.BridgeException.class,
        () -> new NoesisIntakeBridge(json, "http://example.org/mcp", credentials.toString()));
  }
}
