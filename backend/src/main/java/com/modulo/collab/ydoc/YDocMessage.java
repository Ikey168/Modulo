package com.modulo.collab.ydoc;

public class YDocMessage {

    public enum Type { UPDATE, AWARENESS, SYNC_STEP1, SYNC_STEP2 }

    private String type;
    private Long noteId;
    private String userId;
    private String update;

    public YDocMessage() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUpdate() { return update; }
    public void setUpdate(String update) { this.update = update; }
}
