package com.modulo.collab.presence;

import java.time.Instant;

public class PresenceMessage {

    public enum Type { JOIN, LEAVE, HEARTBEAT, CURSOR }

    private String type;
    private String userId;
    private String userName;
    private String color;
    private Long noteId;
    private Integer cursorOffset;
    private Integer selectionStart;
    private Integer selectionEnd;
    private String timestamp;

    public PresenceMessage() {}

    public static PresenceMessage cursor(String userId, String userName, String color,
                                        Long noteId, int offset, int selStart, int selEnd) {
        PresenceMessage m = new PresenceMessage();
        m.type = Type.CURSOR.name();
        m.userId = userId;
        m.userName = userName;
        m.color = color;
        m.noteId = noteId;
        m.cursorOffset = offset;
        m.selectionStart = selStart;
        m.selectionEnd = selEnd;
        m.timestamp = Instant.now().toString();
        return m;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public Integer getCursorOffset() { return cursorOffset; }
    public void setCursorOffset(Integer cursorOffset) { this.cursorOffset = cursorOffset; }
    public Integer getSelectionStart() { return selectionStart; }
    public void setSelectionStart(Integer selectionStart) { this.selectionStart = selectionStart; }
    public Integer getSelectionEnd() { return selectionEnd; }
    public void setSelectionEnd(Integer selectionEnd) { this.selectionEnd = selectionEnd; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
}
