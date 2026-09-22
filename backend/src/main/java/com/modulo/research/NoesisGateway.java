package com.modulo.research;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Fixed, operator-configured public KB endpoint. Never forwards the user's Modulo token. */
@Service
public class NoesisGateway {
  private final String base;
  private final ObjectMapper json;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  public NoesisGateway(@Value("${noesis.research.url:http://noesis:8000}") String base, ObjectMapper json) {
    this.base = base.replaceAll("/+$", ""); this.json = json;
  }
  public JsonNode domains() { return request("/domains", null).path("data"); }
  public JsonNode answer(String domain, String question) {
    // Domain is selected from the public domain catalog, not interpolated as an arbitrary URL.
    if (!domain.matches("[a-zA-Z0-9_-]{1,80}") || domain.equals("local"))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public domain required");
    var body = json.createObjectNode(); body.put("question", question); body.putArray("domains").add(domain);
    body.put("all_authorized", false); body.put("limit", 10); body.put("per_domain_limit", 10); body.put("minimum_relevance", 0.34);
    // The cross-domain public surface enforces Noesis domain visibility, including future private domains.
    return request("/cross-domain/answer", body);
  }
  private JsonNode request(String path, JsonNode body) {
    try {
      var builder = HttpRequest.newBuilder(URI.create(base + "/api/v1/kb" + path))
          .timeout(Duration.ofSeconds(40)).header("Accept", "application/json")
          .header("User-Agent", "Modulo Research Integration/1.0");
      var request = body == null ? builder.GET().build() : builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
      var response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
      try (var stream = response.body()) {
        if (response.statusCode() != 200) throw new IllegalStateException("upstream status");
        byte[] bytes = stream.readNBytes(512_001);
        if (bytes.length > 512_000) throw new IllegalStateException("oversized response");
        JsonNode result = json.readTree(bytes);
        if (!"noesis-kb-v1".equals(result.path("contract").asText())) throw new IllegalStateException("contract");
        return result;
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Noesis unavailable; previous result preserved");
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Noesis unavailable; previous result preserved");
    }
  }
}
