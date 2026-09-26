package com.modulo.remote;

import com.fasterxml.jackson.databind.JsonNode;
import com.modulo.files.WorkspaceFileStore;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Authenticated server-side replacements for the desktop shell's network and
 * document services (#495). Clients without Electron (Android, browsers) use
 * these; results have the same shape as the desktop services.
 */
@RestController
@RequestMapping("/api/remote")
public class RemoteServicesController {
  private static final int MAX_WATCHES_PER_CHECK = 25;
  private final RemoteServices services;
  private final RemoteCredentialStore credentials;
  private final WorkspaceFileStore files;

  public RemoteServicesController(RemoteServices services, RemoteCredentialStore credentials, WorkspaceFileStore files) {
    this.services = services;
    this.credentials = credentials;
    this.files = files;
  }

  private static String text(Map<String, Object> body, String key) {
    Object value = body.get(key);
    if (!(value instanceof String s) || s.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key.toUpperCase() + "_REQUIRED");
    return s;
  }

  @GetMapping("/status")
  public Map<String, Object> status() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("services", List.of("feeds", "archive", "webWatch", "caldav", "ntfy", "metadata", "pdf"));
    result.put("credentialsAvailable", credentials.available());
    result.put("configured", credentials.configured());
    return result;
  }

  @GetMapping("/credentials")
  public Map<String, Object> credentialStatus() {
    return Map.of("available", credentials.available(), "configured", credentials.configured());
  }

  @PutMapping("/credentials/{key}")
  public Map<String, Object> setCredential(@PathVariable String key, @RequestBody Map<String, Object> body) {
    Object value = body.get("value");
    return Map.of("configured", credentials.set(key, value instanceof String s ? s : ""));
  }

  @PostMapping("/feeds")
  public List<Map<String, String>> feeds(@RequestBody Map<String, Object> body) {
    return services.feeds("Miniflux".equals(body.get("kind")) ? "Miniflux" : "RSS", text(body, "url"));
  }

  /** Captures a page into the workspace file store, so every device can open the archived copy. */
  @PostMapping("/archive/capture")
  public Map<String, Object> capture(@RequestBody Map<String, Object> body) {
    Map<String, Object> result = services.capture(text(body, "url"));
    String html = (String) result.remove("html");
    String id = "web-archive-" + UUID.randomUUID();
    files.put("personal", id, result.get("title") + ".html", "text/html; charset=utf-8", html.getBytes(StandardCharsets.UTF_8));
    result.put("id", id);
    result.put("fileId", id);
    return result;
  }

  @PostMapping("/archive/import")
  public List<Map<String, String>> importArchive(@RequestBody Map<String, Object> body) {
    return services.importArchive("ArchiveBox".equals(body.get("provider")) ? "ArchiveBox" : "Karakeep", text(body, "url"));
  }

  @PostMapping("/web-watch/check")
  public List<Map<String, Object>> checkWatches(@RequestBody Map<String, Object> body) {
    if (!(body.get("items") instanceof List<?> items) || items.size() > MAX_WATCHES_PER_CHECK) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WATCH_ITEMS_INVALID");
    }
    List<Map<String, Object>> results = new ArrayList<>();
    for (Object item : items) {
      if (!(item instanceof Map<?, ?> raw)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WATCH_ITEMS_INVALID");
      Map<String, Object> watch = new LinkedHashMap<>();
      raw.forEach((key, value) -> watch.put(String.valueOf(key), value));
      if (!(watch.get("url") instanceof String)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WATCH_ITEMS_INVALID");
      results.add(services.checkWatch(watch));
    }
    return results;
  }

  @PostMapping("/caldav")
  public List<Map<String, String>> caldav(@RequestBody Map<String, Object> body) {
    return services.caldav(text(body, "url"));
  }

  @PostMapping("/ntfy")
  public JsonNode ntfy(@RequestBody Map<String, Object> body) {
    return services.ntfy(body);
  }

  @GetMapping("/metadata")
  public List<Map<String, String>> metadata(@RequestParam String provider, @RequestParam String q) {
    return services.metadata(provider, q);
  }

  @PostMapping(value = "/pdf", consumes = "multipart/form-data")
  public ResponseEntity<byte[]> pdf(@RequestParam String operation, @RequestParam("files") List<MultipartFile> uploads) throws IOException {
    if (uploads.size() > PdfTools.MAX_FILES) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF_FILE_COUNT");
    List<byte[]> contents = new ArrayList<>();
    for (MultipartFile upload : uploads) {
      if (upload.getSize() > PdfTools.MAX_FILE_BYTES) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "PDF_TOO_LARGE");
      contents.add(upload.getBytes());
    }
    PdfTools.Output output = PdfTools.run(operation, contents);
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .header(HttpHeaders.CONTENT_TYPE, output.contentType())
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + URLEncoder.encode(output.fileName(), StandardCharsets.UTF_8))
        .header("X-Modulo-Details", output.details())
        .body(output.content());
  }
}
