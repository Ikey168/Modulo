package com.modulo.research;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class NoesisGatewayTest {
  @Test void usesPublicScopedPostWithoutForwardingModuloCredentialsAndRejectsRedirects() throws Exception {
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    AtomicReference<String> body = new AtomicReference<>(); AtomicReference<String> auth = new AtomicReference<>(); AtomicReference<String> method = new AtomicReference<>();
    server.createContext("/api/v1/kb/cross-domain/answer", exchange -> {
      body.set(new String(exchange.getRequestBody().readAllBytes())); auth.set(exchange.getRequestHeaders().getFirst("Authorization")); method.set(exchange.getRequestMethod());
      byte[] response = "{\"contract\":\"noesis-kb-v1\",\"data\":{}}".getBytes(); exchange.sendResponseHeaders(200, response.length); exchange.getResponseBody().write(response); exchange.close();
    });
    server.createContext("/api/v1/kb/domains", exchange -> { exchange.getResponseHeaders().set("Location", "/private"); exchange.sendResponseHeaders(302, -1); exchange.close(); });
    server.start();
    try {
      var gateway = new NoesisGateway("http://127.0.0.1:" + server.getAddress().getPort(), new ObjectMapper());
      gateway.answer("technology", "Public question?");
      assertEquals("POST", method.get()); assertNull(auth.get()); assertTrue(body.get().contains("\"domains\":[\"technology\"]")); assertTrue(body.get().contains("\"all_authorized\":false"));
      assertThrows(ResponseStatusException.class, () -> gateway.answer("local", "private"));
      assertThrows(ResponseStatusException.class, () -> gateway.answer("../private", "private"));
      assertThrows(ResponseStatusException.class, gateway::domains);
    } finally { server.stop(0); }
  }
}
