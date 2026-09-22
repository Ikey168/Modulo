package com.modulo.state;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class GmailMailboxServiceTest {
  private final ObjectMapper json = new ObjectMapper();
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final AuthenticatedUserService users = mock(AuthenticatedUserService.class);
  private final PluginStateStore store = mock(PluginStateStore.class);
  private final GmailApiClient google = mock(GmailApiClient.class);
  private static final String KEY = "test-key-long-enough-for-encryption-32";
  private GmailMailboxService service() {
    when(users.requireUserId()).thenReturn(7L);
    return new GmailMailboxService(jdbc, users, store, json, google, "client.apps.googleusercontent.com", "client-secret", "https://modulo.example/api/public/gmail/callback", KEY);
  }
  @Test void tokensAreEncryptedAndBoundToTheOwner() {
    var cipher = new GmailTokenCipher(KEY); String encrypted = cipher.encrypt(7, "refresh-token");
    assertFalse(encrypted.contains("refresh-token")); assertEquals("refresh-token", cipher.decrypt(7, encrypted));
    assertThrows(IllegalStateException.class, () -> cipher.decrypt(8, encrypted));
    assertNotEquals(encrypted, cipher.encrypt(7, "refresh-token"));
  }
  @Test void connectingRequestsOnlyReadAccessWithPkceAndBrowserBinding() {
    var start = service().start(); var query = query(start.url());
    assertEquals("https://www.googleapis.com/auth/gmail.readonly", query.get("scope"));
    assertEquals("S256", query.get("code_challenge_method")); assertEquals("offline", query.get("access_type"));
    assertEquals(43, query.get("state").length()); assertNotEquals(query.get("state"), start.cookie());
    verify(jdbc).update(startsWith("INSERT INTO gmail_newsletter_oauth"), eq(GmailMessageDecoder.digest(query.get("state"))), eq(7L), eq(GmailMessageDecoder.digest(start.cookie())), anyString());
  }
  @Test void invalidOrReplayedCallbackNeverExchangesTokens() {
    var service = service();
    when(jdbc.queryForList(startsWith("DELETE FROM gmail_newsletter_oauth"), anyString(), anyString())).thenReturn(List.of());
    assertThrows(ResponseStatusException.class, () -> service.callback("state", null, "code", null));
    assertThrows(ResponseStatusException.class, () -> service.callback("state", "cookie", "code", null));
    verifyNoInteractions(google);
  }
  @Test void validCallbackStoresEncryptedRefreshTokenForPendingOwnerWithSyncPaused() throws Exception {
    var service = service();
    when(jdbc.queryForList(startsWith("DELETE FROM gmail_newsletter_oauth"), anyString(), anyString())).thenReturn(List.of(Map.of("owner_id", 7L, "verifier", new GmailTokenCipher(KEY).encrypt(7, "verifier"))));
    when(google.token(anyMap())).thenReturn(json.readTree("{\"scope\":\"https://www.googleapis.com/auth/gmail.readonly\",\"refresh_token\":\"refresh\",\"access_token\":\"access\"}"));
    when(google.get("/gmail/v1/users/me/profile", "access")).thenReturn(json.readTree("{\"emailAddress\":\"reader@example.org\"}"));
    service.callback("state", "cookie", "authorization-code", null);
    ArgumentCaptor<String> encrypted = ArgumentCaptor.forClass(String.class);
    verify(jdbc).update(contains("enabled=FALSE"), eq(7L), anyString(), eq("reader@example.org"), encrypted.capture());
    assertEquals("refresh", new GmailTokenCipher(KEY).decrypt(7, encrypted.getValue()));
  }
  @Test void decoderUsesStableIdsAndReadablePlainText() throws Exception {
    String payload = Base64.getUrlEncoder().withoutPadding().encodeToString("Newsletter body".getBytes(StandardCharsets.UTF_8));
    var message = json.readTree("{\"id\":\"abc\",\"internalDate\":\"1000\",\"payload\":{\"mimeType\":\"text/plain\",\"headers\":[{\"name\":\"Subject\",\"value\":\"News\"},{\"name\":\"Message-ID\",\"value\":\"<one@example.org>\"}],\"body\":{\"data\":\""+payload+"\"}}}");
    var issue = GmailMessageDecoder.decode(json, "reader@example.org", message);
    assertEquals("Newsletter body", issue.path("body").asText()); assertEquals("Unread", issue.path("status").asText()); assertEquals("<one@example.org>", issue.path("messageId").asText());
    assertNotEquals(GmailMessageDecoder.id("other@example.org", "abc"), issue.path("id").asText());
    assertEquals(issue.path("id").asText(), GmailMessageDecoder.id("READER@example.org", "abc"));
  }
  @Test void htmlDoesNotRetainExecutableContent() {
    String text = GmailMessageDecoder.htmlText("<p>Hello &amp; welcome</p><script>alert(1)</script><style>body{color:red}</style><p>Reader</p>");
    assertTrue(text.contains("Hello & welcome")); assertTrue(text.contains("Reader")); assertFalse(text.contains("alert")); assertFalse(text.contains("color:red"));
  }
  private static Map<String, String> query(String url) { Map<String,String> values = new HashMap<>(); for (String part : URI.create(url).getRawQuery().split("&")) { String[] pair = part.split("=",2); values.put(pair[0], URLDecoder.decode(pair[1], StandardCharsets.UTF_8)); } return values; }
}
