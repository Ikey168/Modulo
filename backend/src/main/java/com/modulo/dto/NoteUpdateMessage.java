package com.modulo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO for real-time note update messages via WebSocket
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NoteUpdateMessage {
    
    public enum EventType {
        NOTE_CREATED,
        NOTE_UPDATED,
        NOTE_DELETED,
        NOTE_LINK_CREATED,
        NOTE_LINK_DELETED,
        TAG_CREATED,
        TAG_DELETED
    }
    
    private EventType eventType;
    private Long noteId;  // Changed from UUID to Long for Note compatibility
    private String title;
    private String content;
    private List<String> tagNames;
    private LocalDateTime timestamp;
    private String userId;  // ID of the user who made the change
    
    // Additional fields for link operations
    private UUID linkId;
    private Long sourceNoteId;  // Changed from UUID to Long
    private Long targetNoteId;  // Changed from UUID to Long
    private String linkType;
    
    // Additional fields for tag operations
    private UUID tagId;
    private String tagName;
    
    public static NoteUpdateMessage noteCreated(Long noteId, String title, String content, 
                                              List<String> tagNames, String userId) {
        NoteUpdateMessage message = new NoteUpdateMessage();
        message.setEventType(EventType.NOTE_CREATED);
        message.setNoteId(noteId);
        message.setTitle(title);
        message.setContent(content);
        message.setTagNames(tagNames);
        message.setTimestamp(LocalDateTime.now());
        message.setUserId(userId);
        return message;
    }
    
    public static NoteUpdateMessage noteUpdated(Long noteId, String title, String content, 
                                              List<String> tagNames, String userId) {
        NoteUpdateMessage message = new NoteUpdateMessage();
        message.setEventType(EventType.NOTE_UPDATED);
        message.setNoteId(noteId);
        message.setTitle(title);
        message.setContent(content);
        message.setTagNames(tagNames);
        message.setTimestamp(LocalDateTime.now());
        message.setUserId(userId);
        return message;
    }
    
    public static NoteUpdateMessage noteDeleted(Long noteId, String userId) {
        NoteUpdateMessage message = new NoteUpdateMessage();
        message.setEventType(EventType.NOTE_DELETED);
        message.setNoteId(noteId);
        message.setTimestamp(LocalDateTime.now());
        message.setUserId(userId);
        return message;
    }
    
    public static NoteUpdateMessage noteLinkCreated(UUID linkId, Long sourceNoteId, 
                                                   Long targetNoteId, String linkType, String userId) {
        NoteUpdateMessage message = new NoteUpdateMessage();
        message.setEventType(EventType.NOTE_LINK_CREATED);
        message.setLinkId(linkId);
        message.setSourceNoteId(sourceNoteId);
        message.setTargetNoteId(targetNoteId);
        message.setLinkType(linkType);
        message.setTimestamp(LocalDateTime.now());
        message.setUserId(userId);
        return message;
    }
    
    public static NoteUpdateMessage noteLinkDeleted(UUID linkId, Long sourceNoteId, 
                                                   Long targetNoteId, String userId) {
        NoteUpdateMessage message = new NoteUpdateMessage();
        message.setEventType(EventType.NOTE_LINK_DELETED);
        message.setLinkId(linkId);
        message.setSourceNoteId(sourceNoteId);
        message.setTargetNoteId(targetNoteId);
        message.setTimestamp(LocalDateTime.now());
        message.setUserId(userId);
        return message;
    }
}
