package com.modulo.remote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.modulo.security.AuthenticatedUserService;
import com.sun.net.httpserver.HttpServer;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class RemoteServicesTest {
  private HttpServer server;
  private final AtomicReference<String> page = new AtomicReference<>("<p>Price 10</p>");
  private final AtomicReference<String> lastRequest = new AtomicReference<>();
  private final Map<String, String> stored = new HashMap<>();
  private RemoteServices services;
  private String base;

  @BeforeEach
  void start() throws Exception {
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
    server.createContext("/", exchange -> {
      lastRequest.set(exchange.getRequestMethod() + " " + exchange.getRequestURI() + " "
          + exchange.getRequestHeaders().getFirst("Authorization") + " "
          + new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      String path = exchange.getRequestURI().getPath();
      String body = switch (path) {
        case "/feed" -> "<rss><channel><title>T</title><item><guid>1</guid><title>A</title></item></channel></rss>";
        case "/cal" -> "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:u\nSUMMARY:S\nDTSTART:20260101\nEND:VEVENT\nEND:VCALENDAR";
        case "/ntfy" -> "{\"id\":\"n1\",\"time\":1}";
        case "/bookmarks" -> "{\"bookmarks\":[{\"id\":\"b1\",\"title\":\"Kept\",\"url\":\"https://k.example\"},{\"id\":\"b2\"}]}";
        default -> page.get();
      };
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    server.start();
    base = "http://127.0.0.1:" + server.getAddress().getPort();
    RemoteCredentialStore credentials = new RemoteCredentialStore(mock(JdbcTemplate.class), mock(AuthenticatedUserService.class),
        Base64.getEncoder().encodeToString(new byte[32])) {
      @Override
      public Map<String, String> current() {
        return stored;
      }
    };
    services = new RemoteServices(new SafeHttpFetcher(true), credentials);
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  @Test
  void fetchesFeeds() {
    assertThat(services.feeds("RSS", base + "/feed")).extracting(item -> item.get("title")).containsExactly("A");
  }

  @Test
  void detectsWebWatchChangesStatelessly() {
    Map<String, Object> first = services.checkWatch(new HashMap<>(Map.of("id", "w", "url", base + "/page")));
    assertThat(first).containsEntry("status", "Active").containsKey("lastHash");
    page.set("<p>Price 12</p>");
    Map<String, Object> second = services.checkWatch(first);
    assertThat(second).containsEntry("status", "Changed").containsEntry("previousHash", first.get("lastHash"))
        .containsEntry("addedLines", List.of("Price 12"));
    Map<String, Object> failed = services.checkWatch(new HashMap<>(Map.of("id", "x", "url", "ftp://nope")));
    assertThat(failed).containsEntry("status", "Failed").containsEntry("error", "URL_SCHEME_NOT_ALLOWED");
  }

  @Test
  void caldavNeedsServerHeldCredentialsAndSendsThemOnlyToTheCalendar() {
    assertThat(reason(() -> services.caldav(base + "/cal"))).isEqualTo("CREDENTIAL_MISSING_CALDAV");
    stored.put("caldavUsername", "ada");
    stored.put("caldavPassword", "secret");
    assertThat(services.caldav(base + "/cal")).extracting(event -> event.get("remoteId")).containsExactly("u");
    assertThat(lastRequest.get()).startsWith("REPORT /cal Basic " + Base64.getEncoder().encodeToString("ada:secret".getBytes()));
  }

  @Test
  void publishesNtfyWithToken() {
    stored.put("ntfyToken", "tok");
    assertThat(services.ntfy(Map.of("endpoint", base + "/ntfy", "topic", "alerts", "message", "Hi")).path("id").asText()).isEqualTo("n1");
    assertThat(lastRequest.get()).contains("Bearer tok").contains("\"topic\":\"alerts\"").contains("\"message\":\"Hi\"");
    assertThat(reason(() -> services.ntfy(Map.of("endpoint", base + "/ntfy")))).isEqualTo("NTFY_TOPIC_REQUIRED");
  }

  @Test
  void importsBookmarksWithServerHeldToken() {
    stored.put("karakeepToken", "kk");
    assertThat(services.importArchive("Karakeep", base + "/bookmarks")).extracting(item -> item.get("externalId")).containsExactly("b1");
    assertThat(lastRequest.get()).contains("Bearer kk");
  }

  @Test
  void refusesUnknownMetadataProviders() {
    assertThat(reason(() -> services.metadata("Nope", "x"))).isEqualTo("METADATA_PROVIDER_UNSUPPORTED");
    assertThat(reason(() -> services.metadata("TMDB", "dune"))).isEqualTo("CREDENTIAL_MISSING_TMDB");
  }

  @Test
  void credentialCiphertextIsBoundToOwnerAndKey() {
    RemoteCredentialStore store = new RemoteCredentialStore(mock(JdbcTemplate.class), mock(AuthenticatedUserService.class),
        Base64.getEncoder().encodeToString(new byte[32]));
    byte[] sealed = store.encrypt(7, "ntfyToken", "tok");
    assertThat(store.decrypt(7, "ntfyToken", sealed)).contains("tok");
    assertThat(store.decrypt(8, "ntfyToken", sealed)).isEmpty();
    assertThat(store.decrypt(7, "tmdbToken", sealed)).isEmpty();
    AuthenticatedUserService users = mock(AuthenticatedUserService.class);
    when(users.requireUserId()).thenReturn(7L);
    assertThat(reason(() -> new RemoteCredentialStore(mock(JdbcTemplate.class), users, "").set("ntfyToken", "x")))
        .startsWith("REMOTE_CREDENTIALS_UNCONFIGURED");
    assertThat(reason(() -> store.set("password", "x"))).isEqualTo("CREDENTIAL_KEY_UNSUPPORTED");
  }

  private static String reason(Runnable action) {
    try {
      action.run();
      return "no error";
    } catch (ResponseStatusException error) {
      return error.getReason();
    }
  }
}
