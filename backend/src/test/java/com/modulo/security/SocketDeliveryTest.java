package com.modulo.security;

import com.modulo.config.WebSocketConfig;
import com.modulo.collab.ydoc.YDocController;
import com.modulo.entity.*;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(classes = SocketDeliveryTest.Config.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {"server.servlet.context-path=", "spring.main.allow-bean-definition-overriding=true", "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration,org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration,org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration,org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration"})
class SocketDeliveryTest {
    @Configuration @EnableAutoConfiguration
    @Import({WebSocketConfig.class, OwnedSocketInterceptor.class, YDocController.class})
    static class Config {
        @Bean JwtDecoder jwtDecoder() {
            JwtDecoder decoder = mock(JwtDecoder.class);
            for (String subject : List.of("1", "2")) when(decoder.decode(subject)).thenReturn(Jwt.withTokenValue(subject)
                .header("alg","RS256").subject(subject).expiresAt(Instant.now().plusSeconds(120)).build());
            return decoder;
        }
        @Bean AuthenticatedUserService users() {
            var users = mock(AuthenticatedUserService.class);
            when(users.requireUser(any())).thenAnswer(call -> {
                var authentication = (org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken) call.getArgument(0);
                User user = new User(); user.setId(Long.valueOf(authentication.getToken().getSubject())); return user;
            }); return users;
        }
        @Bean NoteRepository notes() {
            var notes = mock(NoteRepository.class);
            when(notes.findByIdAndUserId(101L,1L)).thenReturn(Optional.of(new Note())); return notes;
        }
    }
    @LocalServerPort int port;
    @Autowired SimpMessagingTemplate messages;
    @Autowired org.springframework.messaging.simp.user.SimpUserRegistry registry;
    static class Peer implements WebSocket.Listener, AutoCloseable {
        final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        final StringBuilder parts = new StringBuilder();
        WebSocket socket;
        @Override public void onOpen(WebSocket socket) { this.socket = socket; socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            parts.append(data); if (last) { frames.add(parts.toString()); parts.setLength(0); } socket.request(1); return null;
        }
        void send(String frame) { socket.sendText(frame + '\0', true).join(); }
        @Override public void close() { socket.abort(); }
    }
    Peer connect(String token) throws Exception {
        var peer = new Peer();
        HttpClient.newHttpClient().newWebSocketBuilder().buildAsync(URI.create("ws://localhost:"+port+"/ws/websocket"), peer).get(5,TimeUnit.SECONDS);
        peer.send("CONNECT\naccept-version:1.2\nhost:localhost\nAuthorization:Bearer "+token+"\n\n");
        String connected = peer.frames.poll(5,TimeUnit.SECONDS);
        assertNotNull(connected); assertTrue(connected.startsWith("CONNECTED"), connected); return peer;
    }
    @Test void brokerDeliversPrivateUserQueuesOnlyToTheirAuthenticatedOwner() throws Exception {
        try (Peer alice=connect("1"); Peer bob=connect("2")) {
            alice.send("SUBSCRIBE\nid:a\ndestination:/user/queue/notes\n\n");
            bob.send("SUBSCRIBE\nid:b\ndestination:/user/queue/notes\n\n");
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime()<deadline && registry.findSubscriptions(s -> s.getDestination().equals("/user/queue/notes")).size()<2) Thread.sleep(10);
            assertEquals(2,registry.findSubscriptions(s -> s.getDestination().equals("/user/queue/notes")).size());
            messages.convertAndSendToUser("1","/queue/notes","alice-private");
            String delivered=alice.frames.poll(5,TimeUnit.SECONDS);
            assertNotNull(delivered); assertTrue(delivered.contains("alice-private"),delivered);
            assertNull(bob.frames.poll(300,TimeUnit.MILLISECONDS));
            bob.send("SUBSCRIBE\nid:foreign\ndestination:/topic/notes/101/ydoc\n\n");
            String denied=bob.frames.poll(5,TimeUnit.SECONDS);
            assertNotNull(denied); assertTrue(denied.startsWith("ERROR"),denied);
        }
    }
}
