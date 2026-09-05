package com.modulo.service;

import com.modulo.dto.NoteUpdateMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Service for handling real-time note synchronization via WebSocket
 */
@Service
@RequiredArgsConstructor
public class WebSocketNotificationService {
    
    private static final Logger log = LoggerFactory.getLogger(WebSocketNotificationService.class);
    
    private final SimpMessagingTemplate messagingTemplate;
    private final com.modulo.security.AuthenticatedUserService users;
    
    private static final String NOTES_TOPIC = "/queue/notes";
    
    /**
     * Broadcast note creation to all connected clients
     */
    public void broadcastNoteCreated(Long noteId, String title, String content, 
                                   List<String> tagNames, String userId) {
        userId = users.actor();
        try {
            NoteUpdateMessage message = NoteUpdateMessage.noteCreated(noteId, title, content, tagNames, userId);
            messagingTemplate.convertAndSendToUser(userId, NOTES_TOPIC, message);
            log.info("Broadcasted note creation: noteId={}, userId={}", noteId, userId);
        } catch (Exception e) {
            log.error("Failed to broadcast note creation: noteId={}", noteId, e);
        }
    }
    
    /**
     * Broadcast note update to all connected clients
     */
    public void broadcastNoteUpdated(Long noteId, String title, String content, 
                                   List<String> tagNames, String userId) {
        userId = users.actor();
        try {
            NoteUpdateMessage message = NoteUpdateMessage.noteUpdated(noteId, title, content, tagNames, userId);
            messagingTemplate.convertAndSendToUser(userId, NOTES_TOPIC, message);
            log.info("Broadcasted note update: noteId={}, userId={}", noteId, userId);
        } catch (Exception e) {
            log.error("Failed to broadcast note update: noteId={}", noteId, e);
        }
    }
    
    /**
     * Broadcast note deletion to all connected clients
     */
    public void broadcastNoteDeleted(Long noteId, String userId) {
        userId = users.actor();
        try {
            NoteUpdateMessage message = NoteUpdateMessage.noteDeleted(noteId, userId);
            messagingTemplate.convertAndSendToUser(userId, NOTES_TOPIC, message);
            log.info("Broadcasted note deletion: noteId={}, userId={}", noteId, userId);
        } catch (Exception e) {
            log.error("Failed to broadcast note deletion: noteId={}", noteId, e);
        }
    }
    
    /**
     * Broadcast note link creation to all connected clients
     */
    public void broadcastNoteLinkCreated(UUID linkId, Long sourceNoteId, Long targetNoteId, 
                                       String linkType, String userId) {
        userId = users.actor();
        try {
            NoteUpdateMessage message = NoteUpdateMessage.noteLinkCreated(linkId, sourceNoteId, 
                                                                         targetNoteId, linkType, userId);
            messagingTemplate.convertAndSendToUser(userId, NOTES_TOPIC, message);
            log.info("Broadcasted note link creation: linkId={}, userId={}", linkId, userId);
        } catch (Exception e) {
            log.error("Failed to broadcast note link creation: linkId={}", linkId, e);
        }
    }
    
    /**
     * Broadcast note link deletion to all connected clients
     */
    public void broadcastNoteLinkDeleted(UUID linkId, Long sourceNoteId, Long targetNoteId, String userId) {
        userId = users.actor();
        try {
            NoteUpdateMessage message = NoteUpdateMessage.noteLinkDeleted(linkId, sourceNoteId, 
                                                                         targetNoteId, userId);
            messagingTemplate.convertAndSendToUser(userId, NOTES_TOPIC, message);
            log.info("Broadcasted note link deletion: linkId={}, userId={}", linkId, userId);
        } catch (Exception e) {
            log.error("Failed to broadcast note link deletion: linkId={}", linkId, e);
        }
    }
}
