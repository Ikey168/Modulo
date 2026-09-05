package com.modulo.collab.presence;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;

@Controller
@RequiredArgsConstructor
public class PresenceController {

    private static final Logger log = LoggerFactory.getLogger(PresenceController.class);

    private final SimpMessagingTemplate messaging;

    @MessageMapping("/notes/{noteId}/presence")
    public void relay(@DestinationVariable Long noteId, @Payload PresenceMessage message, java.security.Principal principal) {
        if (!(principal instanceof com.modulo.security.OwnedSocketPrincipal) || ((com.modulo.security.OwnedSocketPrincipal) principal).expired())
            throw new org.springframework.security.access.AccessDeniedException("Authenticated socket required");
        message.setUserId(principal.getName());
        message.setUserName(principal.getName());
        message.setTimestamp(Instant.now().toString());
        message.setNoteId(noteId);
        if (message.getTimestamp() == null) {
            message.setTimestamp(Instant.now().toString());
        }
        String destination = "/topic/notes/" + noteId + "/presence";
        try {
            messaging.convertAndSend(destination, message);
        } catch (Exception e) {
            log.error("Failed to relay presence message for note {}", noteId, e);
        }
    }
}
