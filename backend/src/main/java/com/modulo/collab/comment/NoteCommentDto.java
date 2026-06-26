package com.modulo.collab.comment;

import java.time.LocalDateTime;
import java.util.List;

public class NoteCommentDto {

    private Long id;
    private Long noteId;
    private Long parentId;
    private String authorId;
    private String authorName;
    private String content;
    private Integer anchorStart;
    private Integer anchorEnd;
    private boolean resolved;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> mentionedUserIds;

    public NoteCommentDto() {}

    public static NoteCommentDto from(NoteComment c) {
        NoteCommentDto dto = new NoteCommentDto();
        dto.id = c.getId();
        dto.noteId = c.getNoteId();
        dto.parentId = c.getParentId();
        dto.authorId = c.getAuthorId();
        dto.authorName = c.getAuthorName();
        dto.content = c.getContent();
        dto.anchorStart = c.getAnchorStart();
        dto.anchorEnd = c.getAnchorEnd();
        dto.resolved = c.isResolved();
        dto.createdAt = c.getCreatedAt();
        dto.updatedAt = c.getUpdatedAt();
        dto.mentionedUserIds = c.getMentionedUserIds();
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long parentId) { this.parentId = parentId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Integer getAnchorStart() { return anchorStart; }
    public void setAnchorStart(Integer anchorStart) { this.anchorStart = anchorStart; }
    public Integer getAnchorEnd() { return anchorEnd; }
    public void setAnchorEnd(Integer anchorEnd) { this.anchorEnd = anchorEnd; }
    public boolean isResolved() { return resolved; }
    public void setResolved(boolean resolved) { this.resolved = resolved; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<String> getMentionedUserIds() { return mentionedUserIds; }
    public void setMentionedUserIds(List<String> mentionedUserIds) { this.mentionedUserIds = mentionedUserIds; }
}
