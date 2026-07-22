package com.modulo.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;

/**
 * Fetches the daily knowledge brief from a Noesis instance (noesis-kb-v1
 * contract, {@code GET /api/v1/kb/brief}): per-domain news/economics/tech/web3
 * changes plus new research publications, as ready-to-file Markdown with every
 * line cited. Consumed by the {@code action.noesis.brief} blueprint node.
 * Degrades gracefully: an unreachable Noesis yields status "unavailable" with
 * empty content, never an exception — the flow continues.
 */
@Service
public class NoesisBriefService {

    /** Outcome of one brief fetch; {@code status} is ok | unavailable. */
    public record Brief(String status, String title, String markdown, int itemCount) {}

    private static final Logger logger = LoggerFactory.getLogger(NoesisBriefService.class);

    private final String baseUrl;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    public NoesisBriefService(@Value("${noesis.brief.url:http://localhost:8012}") String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /**
     * Fetch the brief. Both parameters are optional: {@code domains} is a
     * comma-separated subset (null/empty = all configured domains), and
     * {@code since} an ISO-8601 UTC floor (null/empty = last 24 hours).
     */
    public Brief fetchBrief(String domains, String since) {
        String title = "Noesis Brief — " + LocalDate.now();
        StringBuilder url = new StringBuilder(baseUrl + "/api/v1/kb/brief");
        String separator = "?";
        if (domains != null && !domains.isBlank()) {
            url.append(separator).append("domains=")
               .append(URLEncoder.encode(domains.trim(), StandardCharsets.UTF_8));
            separator = "&";
        }
        if (since != null && !since.isBlank()) {
            url.append(separator).append("since=")
               .append(URLEncoder.encode(since.trim(), StandardCharsets.UTF_8));
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .GET()
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                logger.warn("Noesis brief returned HTTP {}", response.statusCode());
                return new Brief("unavailable", title, "", 0);
            }
            JsonNode data = mapper.readTree(response.body()).path("data");
            String markdown = data.path("markdown").asText("");
            int kept = data.path("meta").path("kept").asInt(0);
            if (markdown.isBlank()) {
                logger.warn("Noesis brief response had no markdown");
                return new Brief("unavailable", title, "", 0);
            }
            return new Brief("ok", title, markdown, kept);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Brief("unavailable", title, "", 0);
        } catch (Exception e) {
            logger.warn("Noesis brief fetch failed: {}", e.getMessage());
            return new Brief("unavailable", title, "", 0);
        }
    }
}
