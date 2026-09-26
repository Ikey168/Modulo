package com.modulo.state;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class GmailMailboxIntegrationTest {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
  static DriverManagerDataSource source;
  JdbcTemplate jdbc; AuthenticatedUserService users; PluginStateStore state; GmailApiClient google; GmailMailboxService service;
  ObjectMapper json = new ObjectMapper(); long owner = 1;
  @BeforeAll static void schema() throws Exception {
    source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var connection = source.getConnection()) { connection.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
      for (String file : new String[] {"V3__Versioned_plugin_state.sql", "V5__Plugin_state_grants_and_delivery.sql", "V23__Gmail_newsletter_connection.sql"}) ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/postgresql/" + file)); }
  }
  @BeforeEach void setup() throws Exception {
    jdbc = new JdbcTemplate(source); jdbc.execute("TRUNCATE users CASCADE"); jdbc.update("INSERT INTO users(id) VALUES (1),(2)");
    users = mock(AuthenticatedUserService.class); when(users.requireUserId()).thenAnswer(invocation -> owner);
    state = new PluginStateStore(jdbc, new DataSourceTransactionManager(source), users, json, PluginStateStore.Limits.defaults()); google = mock(GmailApiClient.class);
    service = new GmailMailboxService(jdbc, users, state, json, google, "client", "secret", "https://modulo.example/api/public/gmail/callback", "test-encryption-key-longer-than-32-characters");
    when(google.token(anyMap())).thenReturn(json.readTree("{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"scope\":\"https://www.googleapis.com/auth/gmail.readonly\"}"));
    when(google.get(eq("/gmail/v1/users/me/profile"), anyString())).thenReturn(json.readTree("{\"emailAddress\":\"reader@example.org\"}"));
    when(google.get(startsWith("/gmail/v1/users/me/messages?"), anyString())).thenReturn(json.readTree("{\"messages\":[{\"id\":\"abc123\"}]}"));
    String body = Base64.getUrlEncoder().withoutPadding().encodeToString("Newsletter content".getBytes(StandardCharsets.UTF_8));
    when(google.get(eq("/gmail/v1/users/me/messages/abc123?format=full"), anyString())).thenReturn(json.readTree("{\"id\":\"abc123\",\"payload\":{\"mimeType\":\"text/plain\",\"headers\":[{\"name\":\"Subject\",\"value\":\"News\"},{\"name\":\"Message-ID\",\"value\":\"<news@example.org>\"}],\"body\":{\"data\":\""+body+"\"}}}"));
  }
  @AfterEach void close() { service.close(); }
  String stateOf(GmailMailboxService.Start start) { return java.util.Arrays.stream(URI.create(start.url()).getQuery().split("&")).filter(part -> part.startsWith("state=")).findFirst().orElseThrow().substring(6); }
  @Test void callbackRequiresTheInitiatingBrowserAndIsSingleUse() {
    var start = service.start();
    assertThrows(ResponseStatusException.class, () -> service.callback(stateOf(start), "wrong-browser", "code", null)); verifyNoInteractions(google);
    service.callback(stateOf(start), start.cookie(), "code", null); assertTrue(service.status().connected()); assertFalse(service.status().enabled());
    assertThrows(ResponseStatusException.class, () -> service.callback(stateOf(start), start.cookie(), "code", null));
    owner = 2; assertFalse(service.status().connected()); assertThrows(ResponseStatusException.class, () -> service.configure("label:newsletters", true));
  }
  @Test void syncingPreservesTriageAndOwnerIsolationAndDisconnectStopsIt() {
    var start = service.start(); service.callback(stateOf(start), start.cookie(), "code", null); service.configure("label:newsletters", true); service.syncNow();
    assertEquals("", service.status().error()); assertEquals(1, service.status().importedCount());
    String key = "issue-" + GmailMessageDecoder.id("reader@example.org", "abc123"); var record = state.get("personal", "newsletter-inbox", key);
    var archived = record.value().deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode) archived).put("status", "Archived");
    state.put("personal", "newsletter-inbox", key, record.version(), "newsletter", 1, archived.toString());
    service.syncNow(); assertEquals("Archived", state.get("personal", "newsletter-inbox", key).value().path("status").asText()); assertEquals(1, service.status().importedCount());
    verify(google, times(1)).get(eq("/gmail/v1/users/me/messages/abc123?format=full"), anyString());
    owner = 2; assertThrows(ResponseStatusException.class, () -> state.get("personal", "newsletter-inbox", key));
    owner = 1; service.disconnect(); assertFalse(service.status().connected()); assertThrows(ResponseStatusException.class, () -> service.syncNow());
    assertEquals("Archived", state.get("personal", "newsletter-inbox", key).value().path("status").asText()); verify(google).revoke("refresh");
  }
}
