package com.modulo.security;

import com.modulo.repository.NoteRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Component
public class OwnedSocketInterceptor implements ChannelInterceptor {
    private static final Pattern NOTE_DESTINATION = Pattern.compile("^/(?:topic|app)/notes/(\\d+)/(?:ydoc|presence|comments)$");
    private final AuthenticatedUserService users;
    private final NoteRepository notes;
    private final ObjectProvider<JwtDecoder> decoder;
    private final Map<String, OwnedSocketPrincipal> sessions = new ConcurrentHashMap<>();
    public OwnedSocketInterceptor(AuthenticatedUserService users, NoteRepository notes, ObjectProvider<JwtDecoder> decoder) {
        this.users = users; this.notes = notes; this.decoder = decoder;
    }
    @Override public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor frame = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (frame == null) throw new AccessDeniedException("STOMP frame required");
        if (frame.getCommand() == StompCommand.CONNECT) {
            Authentication authentication = frame.getUser() instanceof Authentication ? (Authentication) frame.getUser() : null;
            Instant expires = Instant.now().plusSeconds(300);
            String authorization = frame.getFirstNativeHeader("Authorization");
            if (authorization != null) {
                if (!authorization.startsWith("Bearer ") || decoder.getIfAvailable() == null) throw new AccessDeniedException("Invalid authentication");
                var jwt = decoder.getObject().decode(authorization.substring(7));
                authentication = new JwtAuthenticationToken(jwt); expires = jwt.getExpiresAt();
            }
            OwnedSocketPrincipal principal = new OwnedSocketPrincipal(users.requireUser(authentication).getId(), expires);
            if (principal.expired()) throw new AccessDeniedException("Session expired");
            frame.setUser(principal); sessions.put(frame.getSessionId(), principal);
        } else if (frame.getCommand() == StompCommand.DISCONNECT) {
            sessions.remove(frame.getSessionId());
        } else if (frame.getCommand() == StompCommand.SUBSCRIBE || frame.getCommand() == StompCommand.SEND) {
            OwnedSocketPrincipal principal = sessions.get(frame.getSessionId());
            if (!allowed(principal, frame.getDestination(), frame.getCommand() == StompCommand.SEND)) throw new AccessDeniedException("Destination not authorized");
        }
        return message;
    }
    private boolean allowed(OwnedSocketPrincipal principal, String destination, boolean send) {
        if (principal == null || principal.expired() || destination == null) return false;
        if (!send && (destination.equals("/user/queue/notes") || destination.equals("/user/queue/notifications"))) return true;
        if (!send && destination.equals("/topic/users/" + principal.getName() + "/notifications")) return true;
        var match = NOTE_DESTINATION.matcher(destination);
        if (!match.matches() || (send && (!destination.startsWith("/app/") || destination.endsWith("/comments")))) return false;
        if (!send && !destination.startsWith("/topic/")) return false;
        return notes.findByIdAndUserId(Long.valueOf(match.group(1)), principal.ownerId()).isPresent();
    }
    public ChannelInterceptor outbound() {
        return new ChannelInterceptor() {
            @Override public Message<?> preSend(Message<?> message, MessageChannel channel) {
                var frame = org.springframework.messaging.simp.SimpMessageHeaderAccessor.wrap(message);
                if (frame.getMessageType() != org.springframework.messaging.simp.SimpMessageType.MESSAGE) return message;
                var principal = sessions.get(frame.getSessionId());
                String destination = frame.getDestination();
                if (destination != null && (destination.startsWith("/queue/notes-user") || destination.startsWith("/queue/notifications-user"))) return principal != null && !principal.expired() ? message : null;
                return allowed(principal, destination, false) ? message : null;
            }
        };
    }
    @org.springframework.context.event.EventListener
    public void disconnected(org.springframework.web.socket.messaging.SessionDisconnectEvent event) { sessions.remove(event.getSessionId()); }
}
