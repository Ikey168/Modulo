package com.modulo.collab.ydoc;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class YDocController {

    private static final Logger log = LoggerFactory.getLogger(YDocController.class);

    private final SimpMessagingTemplate messaging;

    /**
     * Relays Yjs document updates to all subscribers of the note's ydoc topic.
     * The server is a dumb relay; Yjs CRDT merge happens entirely on clients.
     */
    @MessageMapping("/notes/{noteId}/ydoc")
    public void relay(@DestinationVariable Long noteId, @Payload YDocMessage message) {
        message.setNoteId(noteId);
        String destination = "/topic/notes/" + noteId + "/ydoc";
        try {
            messaging.convertAndSend(destination, message);
        } catch (Exception e) {
            log.error("Failed to relay ydoc update for note {}", noteId, e);
        }
    }
}
