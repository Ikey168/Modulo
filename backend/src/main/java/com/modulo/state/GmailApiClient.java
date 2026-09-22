package com.modulo.state;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class GmailApiClient {
  private final ObjectMapper json;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
  public GmailApiClient(ObjectMapper json) { this.json = json; }
  static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
  public JsonNode token(Map<String, String> fields) {
    String body = fields.entrySet().stream().map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue())).collect(Collectors.joining("&"));
    try { return send(HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token")).header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(body)).build()); } catch (GmailFailure failure) { if (failure.status == 400) throw new GmailFailure(401); throw failure; }
  }
  public JsonNode get(String path, String token) {
    if (!path.startsWith("/gmail/v1/users/me/") || path.contains("\r") || path.contains("\n")) throw new IllegalArgumentException("Invalid Gmail resource");
    return send(HttpRequest.newBuilder(URI.create("https://gmail.googleapis.com" + path)).header("Authorization", "Bearer " + token).GET().build());
  }
  public void revoke(String token) {
    try { send(HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/revoke")).header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString("token=" + encode(token))).build()); }
    catch (GmailFailure failure) { if (failure.status != 400) throw failure; }
  }
  private JsonNode send(HttpRequest original) {
    HttpRequest request = HttpRequest.newBuilder(original, (name, value) -> true).timeout(Duration.ofSeconds(25)).build();
    try {
      HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      try (InputStream stream = response.body()) {
        byte[] body = stream.readNBytes(3_000_001);
        if (response.statusCode() / 100 != 2) throw new GmailFailure(response.statusCode());
        if (body.length > 3_000_000) throw new IllegalStateException("Gmail message is too large to import");
        return body.length == 0 ? json.createObjectNode() : json.readTree(body);
      }
    } catch (GmailFailure failure) { throw failure; }
    catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new IllegalStateException("Gmail request interrupted"); }
    catch (Exception failure) { throw new IllegalStateException("Gmail could not be reached; retry syncing"); }
  }
  public static class GmailFailure extends RuntimeException {
    final int status;
    GmailFailure(int status) { super(status == 401 ? "Google authorization expired; reconnect Gmail" : status == 400 ? "Google rejected the search or page cursor; save the search again" : status == 403 ? "Google denied access; check Gmail API and account permissions" : status == 429 ? "Gmail rate limit reached; try again later" : "Gmail request failed; try again later"); this.status = status; }
  }
}
