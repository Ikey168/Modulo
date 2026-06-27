package com.modulo.collab.notification;

import java.time.LocalDateTime;

public class NotificationDto {

    private Long id;
    private String userId;
    private String type;
    private String message;
    private Long noteId;
    private Long commentId;
    private boolean read;
    private LocalDateTime createdAt;

    public NotificationDto() {}

    public static NotificationDto from(Notification n) {
        NotificationDto dto = new NotificationDto();
        dto.id = n.getId();
        dto.userId = n.getUserId();
        dto.type = n.getType();
        dto.message = n.getMessage();
        dto.noteId = n.getNoteId();
        dto.commentId = n.getCommentId();
        dto.read = n.isRead();
        dto.createdAt = n.getCreatedAt();
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public Long getCommentId() { return commentId; }
    public void setCommentId(Long commentId) { this.commentId = commentId; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
