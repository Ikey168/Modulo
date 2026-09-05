package com.modulo.security;

import com.modulo.entity.*;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.*;
import java.time.Instant;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OwnedSocketInterceptorTest {
    AuthenticatedUserService users = mock(AuthenticatedUserService.class);
    NoteRepository notes = mock(NoteRepository.class);
    JwtDecoder decoder = mock(JwtDecoder.class);
    @SuppressWarnings("unchecked") ObjectProvider<JwtDecoder> decoders = mock(ObjectProvider.class);
    OwnedSocketInterceptor interceptor;
    OwnedSocketInterceptorTest() {
        when(decoders.getIfAvailable()).thenReturn(decoder); when(decoders.getObject()).thenReturn(decoder);
        var jwt = Jwt.withTokenValue("verified").header("alg", "RS256").subject("alice").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).build();
        when(decoder.decode("verified")).thenReturn(jwt); User user = new User(); user.setId(1L);
        when(users.requireUser(any())).thenReturn(user);
        interceptor = new OwnedSocketInterceptor(users, notes, decoders);
    }
    Message<byte[]> frame(StompCommand command, String destination) {
        var headers = StompHeaderAccessor.create(command); headers.setSessionId("session"); headers.setLeaveMutable(true);
        if (destination != null) headers.setDestination(destination);
        headers.addNativeHeader("Authorization", "Bearer verified"); headers.addNativeHeader("X-User-Id", "2");
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }
    void connect() { interceptor.preSend(frame(StompCommand.CONNECT, null), null); }
    @Test void verifiedIdentityReplacesSpoofedHeadersAndGlobalSubscriptionIsRejected() {
        var connect = frame(StompCommand.CONNECT, null); interceptor.preSend(connect, null);
        assertEquals("1", StompHeaderAccessor.wrap(connect).getUser().getName());
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/notes"), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/notes"), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/users/2/notifications"), null));
    }
    @Test void subscriptionsAndUpdatesRequireOwnershipAndAreRecheckedForOutboundDelivery() {
        connect(); when(notes.findByIdAndUserId(101L, 1L)).thenReturn(Optional.of(new Note()));
        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/notes/101/ydoc"), null));
        assertNotNull(interceptor.preSend(frame(StompCommand.SEND, "/app/notes/101/ydoc"), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(frame(StompCommand.SEND, "/app/notes/202/ydoc"), null));
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(frame(StompCommand.SEND, "/topic/notes/101/ydoc"), null));
        var outbound = frame(StompCommand.MESSAGE, "/topic/notes/101/ydoc");
        assertNotNull(interceptor.outbound().preSend(outbound, null));
        when(notes.findByIdAndUserId(101L, 1L)).thenReturn(Optional.empty());
        assertNull(interceptor.outbound().preSend(outbound, null));
    }
    @Test void expiredAndDisconnectedSessionsCannotReceiveOrSubscribe() {
        var expired = Jwt.withTokenValue("verified").header("alg", "RS256").subject("alice").expiresAt(Instant.now().minusSeconds(1)).build();
        when(decoder.decode("verified")).thenReturn(expired);
        assertThrows(AccessDeniedException.class, this::connect);
        assertThrows(AccessDeniedException.class, () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/notes"), null));
    }
}
