package com.modulo.state;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GmailMailboxService {
  static final String SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
  static final String SCHEMA = """
      {"type":"object","required":["id","title","sender","body","url","receivedAt","messageId","status"],"additionalProperties":false,"properties":{
      "id":{"type":"string"},"title":{"type":"string","maxLength":1000},"sender":{"type":"string","maxLength":1000},"body":{"type":"string","maxLength":200000},"url":{"type":"string","maxLength":4000},"receivedAt":{"type":"string"},"messageId":{"type":"string","maxLength":1000},"status":{"type":"string","enum":["Unread","Saved","Archived"]}}}
      """;
  private final JdbcTemplate jdbc;
  private final AuthenticatedUserService users;
  private final PluginStateStore store;
  private final ObjectMapper json;
  private final GmailApiClient google;
  private final String clientId, clientSecret, redirectUri;
  private final GmailTokenCipher cipher;
  private final AtomicBoolean polling = new AtomicBoolean();
  private final ExecutorService worker = Executors.newSingleThreadExecutor(task -> { Thread thread = new Thread(task, "gmail-newsletter-sync"); thread.setDaemon(true); return thread; });
  @PreDestroy public void close() { worker.shutdownNow(); }
  public GmailMailboxService(JdbcTemplate jdbc, AuthenticatedUserService users, PluginStateStore store, ObjectMapper json, GmailApiClient google,
      @Value("${modulo.gmail.client-id:}") String clientId, @Value("${modulo.gmail.client-secret:}") String clientSecret,
      @Value("${modulo.gmail.redirect-uri:}") String redirectUri, @Value("${modulo.security.encryption-key:}") String encryptionKey) {
    this.jdbc = jdbc; this.users = users; this.store = store; this.json = json; this.google = google;
    this.clientId = clientId; this.clientSecret = clientSecret; this.redirectUri = redirectUri;
    this.cipher = encryptionKey.length() >= 32 ? new GmailTokenCipher(encryptionKey) : null;
  }
  public boolean configured() { return !clientId.isBlank() && !clientSecret.isBlank() && redirectUri.startsWith("https://") && redirectUri.endsWith("/api/public/gmail/callback") && cipher != null; }
  private void requireConfigured() { if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google OAuth is not configured on this Modulo server"); }
  public record Status(boolean configured, boolean connected, String email, String searchQuery, boolean enabled, String lastSync, String error, long importedCount, String connectionId) {}
  public Status status() {
    long owner = users.requireUserId();
    if (!configured()) return new Status(false, false, "", "label:newsletters newer_than:30d", false, "", "", 0, "");
    var rows = connections(owner);
    if (rows.isEmpty()) return new Status(true, false, "", "label:newsletters newer_than:30d", false, "", "", 0, "");
    var row = rows.get(0);
    return new Status(true, true, text(row, "email"), text(row, "search_query"), Boolean.TRUE.equals(row.get("enabled")), row.get("last_sync") instanceof java.sql.Timestamp timestamp ? timestamp.toInstant().toString() : "", text(row, "last_error"), ((Number) row.get("imported_count")).longValue(), text(row, "connection_id"));
  }
  public record Start(String url, String cookie) {}
  public Start start() {
    requireConfigured(); long owner = users.requireUserId(); store.registerSchema("personal", "newsletter-inbox", "newsletter", 1, SCHEMA);
    String state = random(), cookie = random(), verifier = random();
    jdbc.update("DELETE FROM gmail_newsletter_oauth WHERE owner_id=? OR expires_at<CURRENT_TIMESTAMP", owner);
    jdbc.update("INSERT INTO gmail_newsletter_oauth(state_hash,owner_id,cookie_hash,verifier,expires_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP + INTERVAL '10 minutes')", GmailMessageDecoder.digest(state), owner, GmailMessageDecoder.digest(cookie), cipher.encrypt(owner, verifier));
    String challenge;
    try { challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII))); }
    catch (Exception failure) { throw new IllegalStateException("Could not begin Google sign-in"); }
    String url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + GmailApiClient.encode(clientId) + "&redirect_uri=" + GmailApiClient.encode(redirectUri)
        + "&response_type=code&scope=" + GmailApiClient.encode(SCOPE) + "&access_type=offline&prompt=consent&state=" + state + "&code_challenge_method=S256&code_challenge=" + challenge;
    return new Start(url, cookie);
  }
  public void callback(String state, String cookie, String code, String error) {
    requireConfigured();
    if (state == null || cookie == null || state.length() > 200 || cookie.length() > 200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google sign-in expired or was opened in another browser. Start again from Modulo.");
    var pending = jdbc.queryForList("DELETE FROM gmail_newsletter_oauth WHERE state_hash=? AND cookie_hash=? AND expires_at>CURRENT_TIMESTAMP RETURNING owner_id,verifier", GmailMessageDecoder.digest(state), GmailMessageDecoder.digest(cookie));
    if (pending.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google sign-in expired or has already been used");
    if (error != null || code == null || code.length() > 4096) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google connection was cancelled");
    long owner = ((Number) pending.get(0).get("owner_id")).longValue();
    JsonNode tokens = google.token(Map.of("client_id", clientId, "client_secret", clientSecret, "redirect_uri", redirectUri, "grant_type", "authorization_code", "code", code, "code_verifier", cipher.decrypt(owner, text(pending.get(0), "verifier"))));
    if (!Arrays.asList(tokens.path("scope").asText().split(" ")).contains(SCOPE) || tokens.path("refresh_token").asText().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Allow read-only Gmail access to connect this account");
    String email = google.get("/gmail/v1/users/me/profile", tokens.path("access_token").asText()).path("emailAddress").asText();
    if (email.isBlank() || email.length() > 320) throw new IllegalStateException("Google did not identify the mailbox");
    jdbc.update("INSERT INTO gmail_newsletter_connections(owner_id,connection_id,email,refresh_token) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET connection_id=EXCLUDED.connection_id,email=EXCLUDED.email,refresh_token=EXCLUDED.refresh_token,enabled=FALSE,page_token=NULL,last_error=NULL,lease_until=NULL,next_sync=CURRENT_TIMESTAMP", owner, UUID.randomUUID().toString(), email, cipher.encrypt(owner, tokens.path("refresh_token").asText()));
  }
  public void configure(String query, boolean enabled) {
    requireConfigured(); long owner = users.requireUserId();
    if (query == null || query.isBlank() || query.length() > 500 || query.contains("\n") || query.contains("\r")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a Gmail label or search, up to 500 characters");
    if (jdbc.update("UPDATE gmail_newsletter_connections SET search_query=?,enabled=?,page_token=NULL,next_sync=CURRENT_TIMESTAMP,last_error=NULL WHERE owner_id=?", query.trim(), enabled, owner) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect Gmail first");
  }
  public void disconnect() {
    requireConfigured(); long owner = users.requireUserId(); var rows = connections(owner);
    jdbc.update("DELETE FROM gmail_newsletter_connections WHERE owner_id=?", owner); jdbc.update("DELETE FROM gmail_newsletter_oauth WHERE owner_id=?", owner);
    if (!rows.isEmpty()) try { google.revoke(cipher.decrypt(owner, text(rows.get(0), "refresh_token"))); } catch (RuntimeException ignored) { /* Local credentials are already gone. Google account settings can revoke an unreachable grant. */ }
  }
  public void syncNow() { requireConfigured(); long owner = users.requireUserId(); var rows = connections(owner); if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("enabled"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "Choose a Gmail search and enable syncing first"); sync(owner); }
  @Scheduled(fixedDelayString = "${modulo.gmail.poll-ms:60000}")
  public void scheduledSync() {
    if (!configured() || !polling.compareAndSet(false, true)) return;
    worker.execute(() -> { try {
      for (Long owner : jdbc.queryForList("SELECT owner_id FROM gmail_newsletter_connections WHERE enabled=TRUE AND next_sync<=CURRENT_TIMESTAMP AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) ORDER BY next_sync LIMIT 10", Long.class)) sync(owner);
      jdbc.update("DELETE FROM gmail_newsletter_oauth WHERE expires_at<CURRENT_TIMESTAMP");
    } finally { polling.set(false); } });
  }

  void sync(long owner) {
    var claimed = jdbc.queryForList("UPDATE gmail_newsletter_connections SET lease_until=CURRENT_TIMESTAMP + INTERVAL '10 minutes' WHERE owner_id=? AND enabled=TRUE AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) RETURNING *", owner);
    if (claimed.isEmpty()) return; var row = claimed.get(0); String connection = text(row, "connection_id"); long imported = 0;
    try {
      JsonNode token = google.token(Map.of("client_id", clientId, "client_secret", clientSecret, "grant_type", "refresh_token", "refresh_token", cipher.decrypt(owner, text(row, "refresh_token"))));
      String access = token.path("access_token").asText();
      if (!token.path("refresh_token").asText().isBlank()) jdbc.update("UPDATE gmail_newsletter_connections SET refresh_token=? WHERE owner_id=? AND connection_id=?", cipher.encrypt(owner, token.path("refresh_token").asText()), owner, connection);
      String path = "/gmail/v1/users/me/messages?maxResults=10&q=" + GmailApiClient.encode(text(row, "search_query"));
      if (!text(row, "page_token").isBlank()) path += "&pageToken=" + GmailApiClient.encode(text(row, "page_token"));
      JsonNode page = google.get(path, access);
      PluginStateStore scoped = store.delegated((workspace, namespace, write) -> { if (!"personal".equals(workspace) || !"newsletter-inbox".equals(namespace)) throw new IllegalStateException("Invalid mailbox storage scope"); return new PluginStateStore.Access(owner, "gmail-newsletter-sync"); });
      for (JsonNode entry : page.path("messages")) {
        if (jdbc.queryForObject("SELECT count(*) FROM gmail_newsletter_connections WHERE owner_id=? AND connection_id=? AND enabled=TRUE AND search_query=?", Integer.class, owner, connection, text(row, "search_query")) == 0) return;
        String id = entry.path("id").asText(); if (!id.matches("[A-Za-z0-9_-]{1,128}")) throw new IllegalStateException("Invalid Gmail message ID");
        String key = "issue-" + GmailMessageDecoder.id(text(row, "email"), id);
        try { scoped.get("personal", "newsletter-inbox", key); continue; } catch (ResponseStatusException missing) { if (missing.getStatus() != HttpStatus.NOT_FOUND) throw missing; }
        var issue = GmailMessageDecoder.decode(json, text(row, "email"), google.get("/gmail/v1/users/me/messages/" + id + "?format=full", access));
        if (jdbc.queryForObject("SELECT count(*) FROM plugin_state WHERE owner_id=? AND workspace_id='personal' AND namespace='newsletter-inbox' AND deleted=FALSE AND value->>'messageId'=?", Long.class, owner, issue.path("messageId").asText()) > 0) continue;
        try { scoped.put("personal", "newsletter-inbox", key, 0, "newsletter", 1, issue.toString()); imported++; } catch (PluginStateStore.VersionConflict raced) { /* Another sync already imported this issue. Preserve its triage. */ }
      }
      jdbc.update("UPDATE gmail_newsletter_connections SET page_token=?,last_sync=CURRENT_TIMESTAMP,next_sync=CURRENT_TIMESTAMP + CASE WHEN ? THEN INTERVAL '1 minute' ELSE INTERVAL '15 minutes' END,last_error=NULL,imported_count=imported_count+? WHERE owner_id=? AND connection_id=? AND search_query=?", page.path("nextPageToken").asText(null), page.hasNonNull("nextPageToken"), imported, owner, connection, text(row, "search_query"));
    } catch (RuntimeException failure) {
      String error = failure instanceof GmailApiClient.GmailFailure ? failure.getMessage() : "Newsletter sync failed. Retry or reconnect Gmail.";
      boolean reconnect = failure instanceof GmailApiClient.GmailFailure googleFailure && googleFailure.status == 401;
      jdbc.update("UPDATE gmail_newsletter_connections SET last_error=?,enabled=CASE WHEN ? THEN FALSE ELSE enabled END,next_sync=CURRENT_TIMESTAMP + INTERVAL '15 minutes',imported_count=imported_count+? WHERE owner_id=? AND connection_id=?", error, reconnect, imported, owner, connection);
    } finally { jdbc.update("UPDATE gmail_newsletter_connections SET lease_until=NULL WHERE owner_id=? AND connection_id=?", owner, connection); }
  }
  private List<Map<String, Object>> connections(long owner) { return jdbc.queryForList("SELECT * FROM gmail_newsletter_connections WHERE owner_id=?", owner); }
  private static String text(Map<String, Object> row, String key) { Object value = row.get(key); return value == null ? "" : value.toString(); }
  private static String random() { byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
}
