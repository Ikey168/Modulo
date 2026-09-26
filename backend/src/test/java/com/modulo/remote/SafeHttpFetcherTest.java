package com.modulo.remote;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class SafeHttpFetcherTest {
  private HttpServer server;

  @AfterEach
  void stop() {
    if (server != null) server.stop(0);
  }

  private String serve(String path, int status, String location, String body) throws Exception {
    if (server == null) {
      server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
      server.start();
    }
    server.createContext(path, exchange -> {
      if (location != null) exchange.getResponseHeaders().add("Location", location);
      byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
      if (bytes.length > 0) exchange.getResponseBody().write(bytes);
      exchange.close();
    });
    return "http://127.0.0.1:" + server.getAddress().getPort() + path;
  }

  private static String reason(Runnable action) {
    try {
      action.run();
      return "no error";
    } catch (ResponseStatusException error) {
      return error.getReason();
    }
  }

  @Test
  void classifiesAddresses() throws Exception {
    for (String address : new String[] {"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
        "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "64:ff9b::a9fe:a9fe"}) {
      assertThat(SafeHttpFetcher.isPublic(InetAddress.getByName(address))).as(address).isFalse();
    }
    for (String address : new String[] {"93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"}) {
      assertThat(SafeHttpFetcher.isPublic(InetAddress.getByName(address))).as(address).isTrue();
    }
  }

  @Test
  void rejectsSchemesPortsAndEmbeddedCredentials() {
    SafeHttpFetcher fetcher = new SafeHttpFetcher();
    assertThat(reason(() -> fetcher.validate("file:///etc/passwd"))).isEqualTo("URL_SCHEME_NOT_ALLOWED");
    assertThat(reason(() -> fetcher.validate("gopher://example.org/"))).isEqualTo("URL_SCHEME_NOT_ALLOWED");
    assertThat(reason(() -> fetcher.validate("https://user:pass@example.org/"))).isEqualTo("URL_CREDENTIALS_NOT_ALLOWED");
    assertThat(reason(() -> fetcher.validate("http://example.org:6379/"))).isEqualTo("URL_PORT_NOT_ALLOWED");
    assertThat(fetcher.validate("webcal://example.org/cal.ics").toString()).isEqualTo("https://example.org/cal.ics");
  }

  @Test
  void refusesLoopbackAtConnectTime() {
    SafeHttpFetcher fetcher = new SafeHttpFetcher();
    assertThat(reason(() -> fetcher.get("http://127.0.0.1:8080/", Map.of()))).isEqualTo("URL_ADDRESS_NOT_ALLOWED");
    assertThat(reason(() -> fetcher.get("http://localhost:8080/", Map.of()))).isEqualTo("URL_ADDRESS_NOT_ALLOWED");
  }

  @Test
  void followsRedirectsOnlyToAllowedSchemesAndCapsSize() throws Exception {
    SafeHttpFetcher fetcher = new SafeHttpFetcher(true);
    String target = serve("/target", 200, null, "hello");
    String hop = serve("/hop", 302, target, "");
    SafeHttpFetcher.Response response = fetcher.get(hop, Map.of());
    assertThat(response.text()).isEqualTo("hello");
    assertThat(response.finalUri().toString()).isEqualTo(target);

    String escape = serve("/escape", 302, "file:///etc/passwd", "");
    assertThat(reason(() -> fetcher.get(escape, Map.of()))).isEqualTo("REMOTE_PROTOCOL_ERROR");

    String huge = serve("/huge", 200, null, "x".repeat(SafeHttpFetcher.MAX_BYTES + 10));
    assertThat(reason(() -> fetcher.get(huge, Map.of()))).isEqualTo("REMOTE_RESPONSE_TOO_LARGE");
  }

  @Test
  void neverThrowsForUnparseableInput() {
    assertThatThrownBy(() -> new SafeHttpFetcher().validate("http://exa mple.org")).isInstanceOf(ResponseStatusException.class);
  }
}
