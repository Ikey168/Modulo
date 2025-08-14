package com.modulo.plugin.event;

import com.modulo.entity.Note;
import java.util.Map;

/**
 * Events related to note operations
 */
public abstract class NoteEvent extends PluginEvent {
    
    private final Note note;
    
    protected NoteEvent(String type, Note note, Map<String, Object> metadata) {
        super(type, note, metadata);
        this.note = note;
    }
    
    protected NoteEvent(String type, Note note) {
        super(type, note);
        this.note = note;
    }
    
    public Note getNote() { return note; }
    
    /**
     * Event fired when a note is created
     */
    public static class NoteCreated extends NoteEvent {
        public NoteCreated(Note note) {
            super("note.created", note);
        }
        
        public NoteCreated(Note note, Map<String, Object> metadata) {
            super("note.created", note, metadata);
        }
    }
    
    /**
     * Event fired when a note is updated
     */
    public static class NoteUpdated extends NoteEvent {
        private final Note previousNote;
        
        public NoteUpdated(Note note, Note previousNote) {
            super("note.updated", note);
            this.previousNote = previousNote;
            addMetadata("previousNote", previousNote);
        }
        
        public Note getPreviousNote() { return previousNote; }
    }
    
    /**
     * Event fired when a note is deleted
     */
    public static class NoteDeleted extends NoteEvent {
        public NoteDeleted(Note note) {
            super("note.deleted", note);
        }
    }
    
    /**
     * Event fired when a note is shared
     */
    public static class NoteShared extends NoteEvent {
        private final String shareType;
        private final String recipient;
        
        public NoteShared(Note note, String shareType, String recipient) {
            super("note.shared", note);
            this.shareType = shareType;
            this.recipient = recipient;
            addMetadata("shareType", shareType);
            addMetadata("recipient", recipient);
        }
        
        public String getShareType() { return shareType; }
        public String getRecipient() { return recipient; }
    }
    
    /**
     * Event fired when a note is viewed
     */
    public static class NoteViewed extends NoteEvent {
        private final Long viewerId;
        
        public NoteViewed(Note note, Long viewerId) {
            super("note.viewed", note);
            this.viewerId = viewerId;
            addMetadata("viewerId", viewerId);
        }
        
        public Long getViewerId() { return viewerId; }
    }
    
    /**
     * Event fired when a note attachment is added
     */
    public static class NoteAttachmentAdded extends NoteEvent {
        private final String attachmentId;
        private final String filename;
        
        public NoteAttachmentAdded(Note note, String attachmentId, String filename) {
            super("note.attachment.added", note);
            this.attachmentId = attachmentId;
            this.filename = filename;
            addMetadata("attachmentId", attachmentId);
            addMetadata("filename", filename);
        }
        
        public String getAttachmentId() { return attachmentId; }
        public String getFilename() { return filename; }
    }
}
