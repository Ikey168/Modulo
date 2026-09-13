package com.modulo.integrations.noesis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** One authenticated Noesis MCP session per request; credentials never reach the browser. */
@Service
public class NoesisIntakeBridge {
  public static final Set<String> TOOLS = Set.of(
      "discover_intake_modes", "route_intake_mode", "start_intake_mode", "inspect_intake_mode",
      "list_intake_modes", "command_intake_mode", "export_intake_mode",
      "verify_intake_mode_export", "export_modulo_intake_handoff",
      "subscribe_intake_feed", "list_intake_feed_subscriptions", "refresh_intake_feed_inbox",
      "list_intake_feed_inbox", "inspect_intake_feed_item", "preview_intake_feed_signals",
      "save_intake_feed_signal_rule", "list_intake_feed_signal_rules",
      "preview_intake_feed_signal_rule", "mark_intake_feed_read", "decide_intake_feed_item",
      "annotate_intake_feed_item", "start_awareness_from_inbox", "triage_awareness_item",
      "triage_awareness_batch", "promote_awareness_item", "capture_exploration_page",
      "visit_exploration_feed_item", "inspect_exploration_source");
  private static final String PROTOCOL = "2025-03-26";
  private static final int MAX_RESPONSE = 8_388_608;
  private static final int MAX_CREDENTIALS = 262_144;
  private final ObjectMapper json;
  private final HttpClient http;
  private final URI endpoint;
  private final Path credentialsFile;
  private final AtomicInteger ids = new AtomicInteger();

  @Autowired
  public NoesisIntakeBridge(
      @Value("${noesis.intake.mcp-url:}") String url,
      @Value("${noesis.intake.credentials-file:}") String credentialsFile) {
    this(new ObjectMapper(), url, credentialsFile);
  }

  NoesisIntakeBridge(ObjectMapper json, String url, String credentialsFile) {
    this.json = json;
    this.endpoint = validateEndpoint(url);
    this.credentialsFile = credentialsFile.isBlank() ? null : Path.of(credentialsFile);
    this.http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER)
        .proxy(new ProxySelector() {
          @Override public List<Proxy> select(URI uri) { return List.of(Proxy.NO_PROXY); }
          @Override public void connectFailed(URI uri, java.net.SocketAddress address, IOException error) {}
        })
        .build();
  }

  private static URI validateEndpoint(String url) {
    if (url == null || url.isBlank()) return null;
    URI uri;
    try { uri = URI.create(url); }
    catch (IllegalArgumentException e) { throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_CONFIG_INVALID"); }
    boolean local = uri.getHost() != null &&
        Set.of("localhost", "127.0.0.1", "::1").contains(uri.getHost().toLowerCase());
    if (uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null ||
        !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())))) {
      throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_CONFIG_INVALID");
    }
    return uri;
  }

  public boolean configured() { return endpoint != null && credentialsFile != null; }

  private String tokenFor(long userId) {
    if (!configured()) throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_NOT_CONFIGURED");
    try {
      if (!Files.isRegularFile(credentialsFile) || Files.size(credentialsFile) > MAX_CREDENTIALS) {
        throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_CREDENTIALS_UNAVAILABLE");
      }
      try {
        Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(credentialsFile);
        if (permissions.contains(PosixFilePermission.GROUP_READ) ||
            permissions.contains(PosixFilePermission.GROUP_WRITE) ||
            permissions.contains(PosixFilePermission.OTHERS_READ) ||
            permissions.contains(PosixFilePermission.OTHERS_WRITE)) {
          throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_CREDENTIALS_INSECURE");
        }
      } catch (UnsupportedOperationException ignored) {
        // POSIX permissions are unavailable on this filesystem.
      }
      JsonNode root = json.readTree(Files.readAllBytes(credentialsFile));
      JsonNode entry = root.path(Long.toString(userId));
      String token = entry.path("token").asText("");
      if (token.length() < 32 || token.length() > 4096) {
        throw new BridgeException(HttpStatus.FORBIDDEN, "NOESIS_USER_NOT_MAPPED");
      }
      return token;
    } catch (BridgeException e) {
      throw e;
    } catch (IOException e) {
      throw new BridgeException(HttpStatus.SERVICE_UNAVAILABLE, "NOESIS_CREDENTIALS_UNAVAILABLE");
    }
  }

  public JsonNode call(long userId, String tool, JsonNode arguments) {
    if (!TOOLS.contains(tool)) throw new BridgeException(HttpStatus.BAD_REQUEST, "NOESIS_TOOL_UNSUPPORTED");
    if (arguments == null || !arguments.isObject() || arguments.toString().length() > 256_000) {
      throw new BridgeException(HttpStatus.BAD_REQUEST, "NOESIS_ARGUMENTS_INVALID");
    }
    String token = tokenFor(userId);
    int initializeId = ids.incrementAndGet();
    int callId = ids.incrementAndGet();
    try {
      JsonNode initialized = send(token, null, Map.of(
          "jsonrpc", "2.0", "id", initializeId, "method", "initialize",
          "params", Map.of("protocolVersion", PROTOCOL, "capabilities", Map.of(),
              "clientInfo", Map.of("name", "Modulo", "version", "1.0"))));
      if (initialized.path("result").path("protocolVersion").asText("").isBlank()) {
        throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_HANDSHAKE_FAILED");
      }
      String sessionId = lastSessionId.get();
      send(token, sessionId, Map.of("jsonrpc", "2.0", "method", "notifications/initialized"));
      JsonNode response = send(token, sessionId, Map.of(
          "jsonrpc", "2.0", "id", callId, "method", "tools/call",
          "params", Map.of("name", tool, "arguments", arguments)));
      if (!response.path("error").isMissingNode()) {
        throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_MCP_ERROR");
      }
      JsonNode result = response.path("result");
      JsonNode structured = result.path("structuredContent");
      if (!structured.isMissingNode()) return structured;
      JsonNode content = result.path("content");
      if (content.isArray() && content.size() > 0 && content.get(0).path("type").asText().equals("text")) {
        return json.readTree(content.get(0).path("text").asText());
      }
      throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_RESULT_INVALID");
    } catch (BridgeException e) {
      throw e;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_INTERRUPTED");
    } catch (Exception e) {
      throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_UNAVAILABLE");
    } finally {
      lastSessionId.remove();
    }
  }

  private final ThreadLocal<String> lastSessionId = new ThreadLocal<>();

  private JsonNode send(String token, String sessionId, Object body) throws IOException, InterruptedException {
    HttpRequest.Builder request = HttpRequest.newBuilder(endpoint)
        .timeout(Duration.ofSeconds(20))
        .header("Authorization", "Bearer " + token)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .header("MCP-Protocol-Version", PROTOCOL);
    if (sessionId != null && !sessionId.isBlank()) request.header("Mcp-Session-Id", sessionId);
    HttpResponse<InputStream> response = http.send(
        request.POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(body))).build(),
        HttpResponse.BodyHandlers.ofInputStream());
    try (InputStream input = response.body()) {
      byte[] bytes = input.readNBytes(MAX_RESPONSE + 1);
      if (bytes.length > MAX_RESPONSE) throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_RESPONSE_TOO_LARGE");
      if (response.statusCode() == 202) return json.createObjectNode();
      if (response.statusCode() != 200) throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_HTTP_ERROR");
      response.headers().firstValue("mcp-session-id").ifPresent(lastSessionId::set);
      String text = new String(bytes, StandardCharsets.UTF_8);
      if (response.headers().firstValue("content-type").orElse("").startsWith("application/json")) {
        return json.readTree(text);
      }
      for (String line : text.split("\\R")) {
        if (line.startsWith("data: ")) {
          JsonNode event = json.readTree(line.substring(6));
          if (event.has("result") || event.has("error")) return event;
        }
      }
      throw new BridgeException(HttpStatus.BAD_GATEWAY, "NOESIS_RESULT_INVALID");
    }
  }

  public static class BridgeException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public BridgeException(HttpStatus status, String code) {
      super(code);
      this.status = status;
      this.code = code;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
  }
}
