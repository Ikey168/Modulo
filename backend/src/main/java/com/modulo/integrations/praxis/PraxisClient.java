package com.modulo.integrations.praxis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Pattern;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;

/**
 * Praxis control-plane client for Modulo's backend (#525), following the contract in
 * krasforge/praxis docs/host.md and docs/api.md.
 *
 * <p>Every request carries the mTLS client certificate and {@code Authorization: Bearer}.
 * Requests made for a signed-in user also carry {@code X-Praxis-On-Behalf-Of}; Praxis
 * trusts that header from Modulo, so callers must pass only identities Modulo has
 * authenticated itself (see {@link PraxisIdentity}), never values from client input.
 *
 * <p>Redirects are refused, bodies are bounded and nothing is retried automatically:
 * a lost submission acknowledgement is resolved by resubmitting with the same
 * {@code Idempotency-Key}.
 */
public class PraxisClient {
  /** Praxis' own principal pattern (praxis.host.auth.PRINCIPAL). */
  public static final Pattern PRINCIPAL = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._@+-]{0,127}");
  /** Process ids are UUIDs; anything else never reaches a URL path. */
  public static final Pattern PROCESS_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,127}");
  public static final Pattern IDEMPOTENCY_KEY = Pattern.compile("[\\x21-\\x7e]{1,200}");
  static final int MAX_BODY = 8 * 1024 * 1024;
  static final int MAX_EVENT = 1024 * 1024;

  private final HttpClient http;
  private final URI base;
  private final PraxisCredentials credentials;
  private final PraxisProperties properties;
  private final ObjectMapper json;

  public PraxisClient(PraxisProperties properties, ObjectMapper json) {
    this(properties, json, System::getenv);
  }

  PraxisClient(PraxisProperties properties, ObjectMapper json, Function<String, String> environment) {
    this.properties = properties;
    this.json = json;
    this.base = origin(properties.getBaseUrl());
    this.credentials = new PraxisCredentials(properties, environment);
    SSLContext tls = "https".equals(base.getScheme()) ? PraxisCredentials.sslContext(properties) : null;
    HttpClient.Builder builder = HttpClient.newBuilder()
        .connectTimeout(properties.getConnectTimeout())
        .followRedirects(HttpClient.Redirect.NEVER)
        .version(HttpClient.Version.HTTP_1_1);
    if (tls != null) {
      SSLParameters parameters = new SSLParameters();
      parameters.setProtocols(new String[] {"TLSv1.3", "TLSv1.2"});
      parameters.setEndpointIdentificationAlgorithm("HTTPS");
      builder.sslContext(tls).sslParameters(parameters);
    }
    this.http = builder.build();
  }

  /** https, or http only to a loopback host (a local sidecar in development). */
  static URI origin(String raw) {
    URI uri;
    try {
      uri = URI.create(raw == null ? "" : raw.strip());
    } catch (IllegalArgumentException error) {
      throw new IllegalStateException("modulo.praxis.base-url is not a URL", error);
    }
    if (uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null
        || !(uri.getRawPath() == null || uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))) {
      throw new IllegalStateException("modulo.praxis.base-url must be an origin such as https://praxis.internal:8443");
    }
    if ("http".equals(uri.getScheme())) {
      if (!loopback(uri.getHost())) throw new IllegalStateException("modulo.praxis.base-url must use https unless it is loopback");
    } else if (!"https".equals(uri.getScheme())) {
      throw new IllegalStateException("modulo.praxis.base-url must use https");
    }
    return URI.create(uri.getScheme() + "://" + uri.getRawAuthority());
  }

  /** localhost or a loopback IP literal; never a DNS lookup, which could point anywhere. */
  private static boolean loopback(String host) {
    if ("localhost".equalsIgnoreCase(host)) return true;
    String literal = host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
    if (!literal.matches("[0-9.]+|[0-9A-Fa-f:]+")) return false;
    try {
      return InetAddress.getByName(literal).isLoopbackAddress();
    } catch (UnknownHostException error) {
      return false;
    }
  }

  // ---------------------------------------------------------------- operations

  /** {@code POST /v1/processes}. Praxis answers 202 for a new process and 200 for a duplicate key. */
  public JsonNode submit(ObjectNode spec, String idempotencyKey, String onBehalfOf) {
    if (idempotencyKey == null || !IDEMPOTENCY_KEY.matcher(idempotencyKey).matches()) {
      throw new IllegalArgumentException("invalid_idempotency_key");
    }
    return send("POST", "/v1/processes", spec, onBehalfOf, Map.of("Idempotency-Key", idempotencyKey)).body();
  }

  /** {@code GET /v1/processes/{id}}: state, result, verification, effects, blocking reason. */
  public JsonNode inspect(String processId, String onBehalfOf) {
    return send("GET", processPath(processId), null, onBehalfOf, Map.of()).body();
  }

  /** {@code GET /v1/processes/{id}/tree}. */
  public JsonNode tree(String processId, String onBehalfOf) {
    return send("GET", processPath(processId) + "/tree", null, onBehalfOf, Map.of()).body();
  }

  /**
   * {@code POST /v1/processes/{id}/control}. {@code attemptId} must be the process's
   * current attempt; Praxis answers 409 {@code stale_process_attempt} otherwise.
   */
  public JsonNode control(String processId, String attemptId, String operation, String signal, String policy,
      String onBehalfOf) {
    ObjectNode body = json.createObjectNode()
        .put("attempt_id", attemptId).put("operation", operation).put("policy", policy == null ? "self" : policy);
    if (signal != null) body.put("signal", signal);
    body.putObject("retry");
    return send("POST", processPath(processId) + "/control", body, onBehalfOf, Map.of()).body();
  }

  /** {@code GET /v1/processes/{id}/approvals}: pending effects in the process tree. */
  public JsonNode approvals(String processId, String onBehalfOf) {
    return send("GET", processPath(processId) + "/approvals", null, onBehalfOf, Map.of()).body();
  }

  /** {@code POST /v1/processes/{id}/approvals}: an attempt- and version-bound decision. */
  public JsonNode decide(String processId, String effectId, long version, String attemptId, boolean approved,
      String reason, String onBehalfOf) {
    ObjectNode body = json.createObjectNode().put("effect_id", effectId).put("version", version)
        .put("attempt_id", attemptId).put("approved", approved).put("reason", reason);
    return send("POST", processPath(processId) + "/approvals", body, onBehalfOf, Map.of()).body();
  }

  /**
   * {@code POST /v1/processes/{id}/publication}. 200 {@code accepted}/{@code duplicate};
   * 409 when ineligible or not finished; 503 when Noesis is unavailable; 404
   * {@code route_not_found} when the host has publication turned off.
   */
  public JsonNode publish(String processId, String onBehalfOf) {
    return send("POST", processPath(processId) + "/publication", null, onBehalfOf, Map.of()).body();
  }

  /**
   * Opens {@code GET /v1/processes/{id}/events}, resuming after {@code after} (the
   * Last-Event-ID the consumer persisted). The stream ends when the process finishes.
   * Status errors (e.g. 429 {@code stream_limited}) are raised here, before any event.
   */
  public EventStream events(String processId, long after, boolean tree, String onBehalfOf) {
    if (after < 0) throw new IllegalArgumentException("invalid_event_cursor");
    String path = processPath(processId) + "/events?after=" + after + "&tree=" + tree;
    HttpRequest request = request("GET", path, null, onBehalfOf, Map.of("Accept", "text/event-stream"))
        .timeout(properties.getStreamTimeout()).build();
    HttpResponse<InputStream> response;
    try {
      response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
    } catch (IOException error) {
      throw new PraxisException("praxis_unavailable", error);
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new PraxisException("praxis_unavailable", error);
    }
    if (response.statusCode() != 200) {
      try (InputStream body = response.body()) {
        throw failure(response.statusCode(), readBounded(body), response.headers().firstValue("Retry-After").orElse(null));
      } catch (IOException error) {
        throw new PraxisException("praxis_unavailable", error);
      }
    }
    return new EventStream(response.body(), processId, after, tree, json);
  }

  // ---------------------------------------------------------------- transport

  record Reply(int status, JsonNode body) {}

  private Reply send(String method, String path, JsonNode body, String onBehalfOf, Map<String, String> headers) {
    HttpRequest request = request(method, path, body, onBehalfOf, headers).timeout(properties.getRequestTimeout()).build();
    try {
      HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      byte[] raw;
      try (InputStream stream = response.body()) {
        raw = readBounded(stream);
      }
      if (response.statusCode() >= 400) {
        throw failure(response.statusCode(), raw, response.headers().firstValue("Retry-After").orElse(null));
      }
      if (response.statusCode() >= 300) throw new PraxisException(response.statusCode(), "praxis_redirect_refused", null, null);
      JsonNode parsed = raw.length == 0 ? json.createObjectNode() : json.readTree(raw);
      if (!parsed.isObject()) throw new PraxisException(response.statusCode(), "praxis_invalid_response", null, null);
      return new Reply(response.statusCode(), parsed);
    } catch (PraxisException error) {
      throw error;
    } catch (IOException error) {
      throw new PraxisException("praxis_unavailable", error);
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new PraxisException("praxis_unavailable", error);
    }
  }

  private HttpRequest.Builder request(String method, String path, JsonNode body, String onBehalfOf,
      Map<String, String> headers) {
    HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path))
        .header("Authorization", "Bearer " + credentials.token())
        .header("Accept", "application/json");
    if (onBehalfOf != null) {
      if (!PRINCIPAL.matcher(onBehalfOf).matches()) throw new IllegalArgumentException("invalid_delegated_identity");
      builder.header("X-Praxis-On-Behalf-Of", onBehalfOf);
    }
    headers.forEach(builder::setHeader);
    if (body == null) {
      builder.method(method, "POST".equals(method)
          ? HttpRequest.BodyPublishers.ofString("{}") : HttpRequest.BodyPublishers.noBody());
      if ("POST".equals(method)) builder.header("Content-Type", "application/json");
    } else {
      try {
        builder.method(method, HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(body)))
            .header("Content-Type", "application/json");
      } catch (IOException error) {
        throw new IllegalArgumentException("invalid_request_body", error);
      }
    }
    return builder;
  }

  private PraxisException failure(int status, byte[] raw, String retryAfter) {
    String code = "praxis_http_" + status;
    JsonNode details = null;
    try {
      JsonNode parsed = json.readTree(raw);
      JsonNode error = parsed.path("error");
      JsonNode publication = parsed.path("publication");
      if (error.path("code").isTextual()) {
        code = error.path("code").asText();
        if (error.has("details")) details = error.get("details");
      } else if (publication.isObject()) {
        // A refused publication (409 rejected, 503 unavailable) answers with its receipt.
        code = publication.path("reason").isTextual() && !publication.path("reason").asText().isBlank()
            ? publication.path("reason").asText() : publication.path("status").asText(code);
        details = publication;
      }
    } catch (IOException | RuntimeException ignored) {
      // Non-JSON error bodies (a proxy page) keep the status-derived code.
    }
    return new PraxisException(status, code, details, retryAfter);
  }

  static String processPath(String processId) {
    if (processId == null || !PROCESS_ID.matcher(processId).matches()) {
      throw new IllegalArgumentException("invalid_process_identity");
    }
    return "/v1/processes/" + processId;
  }

  private static byte[] readBounded(InputStream stream) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buffer = new byte[8192];
    int read;
    while ((read = stream.read(buffer)) != -1) {
      if (out.size() + read > MAX_BODY) throw new IOException("praxis_response_too_large");
      out.write(buffer, 0, read);
    }
    return out.toByteArray();
  }

  // ---------------------------------------------------------------- events

  /** One stored Praxis event: its durable global cursor and the core event. */
  public record Event(long cursor, JsonNode event) {}

  /**
   * Server-sent events from Praxis ({@code id: <cursor>}, {@code event: praxis},
   * {@code data: {"cursor","event"}}). Cursors are global, so gaps are normal; they
   * must only increase. Callers persist a cursor after they have handled its event.
   */
  public static final class EventStream implements Closeable {
    private final InputStream source;
    private final BufferedReader lines;
    private final String processId;
    private final boolean tree;
    private final ObjectMapper json;
    private long after;

    EventStream(InputStream source, String processId, long after, boolean tree, ObjectMapper json) {
      this.source = source;
      this.lines = new BufferedReader(new InputStreamReader(source, StandardCharsets.UTF_8));
      this.processId = processId;
      this.after = after;
      this.tree = tree;
      this.json = json;
    }

    /** The next event, or empty when Praxis closed the stream (the process finished). */
    public Optional<Event> next() throws IOException {
      StringBuilder data = new StringBuilder();
      String name = "message";
      String line;
      while ((line = lines.readLine()) != null) {
        if (line.isEmpty()) {
          if (data.length() == 0) continue;
          if ("praxis".equals(name)) return Optional.of(parse(data.toString()));
          data.setLength(0);
          name = "message";
          continue;
        }
        if (line.startsWith(":")) continue;
        int colon = line.indexOf(':');
        String field = colon < 0 ? line : line.substring(0, colon);
        String value = colon < 0 ? "" : line.substring(colon + 1).replaceFirst("^ ", "");
        if ("data".equals(field)) {
          if (data.length() + value.length() > MAX_EVENT) throw new IOException("praxis_event_too_large");
          if (data.length() > 0) data.append('\n');
          data.append(value);
        } else if ("event".equals(field)) {
          name = value;
        }
      }
      return Optional.empty();
    }

    private Event parse(String data) throws IOException {
      JsonNode frame = json.readTree(data);
      JsonNode cursor = frame.path("cursor");
      JsonNode event = frame.path("event");
      if (!cursor.canConvertToLong() || !cursor.isIntegralNumber() || cursor.asLong() <= after || !event.isObject()
          || (!tree && !processId.equals(event.path("process_id").asText()))) {
        throw new IOException("praxis_invalid_event_stream");
      }
      after = cursor.asLong();
      return new Event(after, event);
    }

    @Override
    public void close() throws IOException {
      source.close();
    }
  }

}
