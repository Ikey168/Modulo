package com.modulo.dto;

import java.time.LocalDateTime;

public class AttachmentDto {
    private Long id;
    private String originalFilename;
    private String contentType;
    private Long fileSize;
    private String blobUrl;
    private String cdnUrl;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
    private Long noteId;
    private Boolean isActive;

    // Constructors
    public AttachmentDto() {}

    public AttachmentDto(Long id, String originalFilename, String contentType, Long fileSize, String blobUrl, 
                        String cdnUrl, LocalDateTime uploadedAt, String uploadedBy, Long noteId, Boolean isActive) {
        this.id = id;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.blobUrl = blobUrl;
        this.cdnUrl = cdnUrl;
        this.uploadedAt = uploadedAt;
        this.uploadedBy = uploadedBy;
        this.noteId = noteId;
        this.isActive = isActive;
    }

    // Static builder method
    public static AttachmentDtoBuilder builder() {
        return new AttachmentDtoBuilder();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getBlobUrl() { return blobUrl; }
    public void setBlobUrl(String blobUrl) { this.blobUrl = blobUrl; }
    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    // Builder class
    public static class AttachmentDtoBuilder {
        private Long id;
        private String originalFilename;
        private String contentType;
        private Long fileSize;
        private String blobUrl;
        private String cdnUrl;
        private LocalDateTime uploadedAt;
        private String uploadedBy;
        private Long noteId;
        private Boolean isActive;

        public AttachmentDtoBuilder id(Long id) { this.id = id; return this; }
        public AttachmentDtoBuilder originalFilename(String originalFilename) { this.originalFilename = originalFilename; return this; }
        public AttachmentDtoBuilder contentType(String contentType) { this.contentType = contentType; return this; }
        public AttachmentDtoBuilder fileSize(Long fileSize) { this.fileSize = fileSize; return this; }
        public AttachmentDtoBuilder blobUrl(String blobUrl) { this.blobUrl = blobUrl; return this; }
        public AttachmentDtoBuilder cdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; return this; }
        public AttachmentDtoBuilder uploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; return this; }
        public AttachmentDtoBuilder uploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; return this; }
        public AttachmentDtoBuilder noteId(Long noteId) { this.noteId = noteId; return this; }
        public AttachmentDtoBuilder isActive(Boolean isActive) { this.isActive = isActive; return this; }

        public AttachmentDto build() {
            return new AttachmentDto(id, originalFilename, contentType, fileSize, blobUrl, 
                                   cdnUrl, uploadedAt, uploadedBy, noteId, isActive);
        }
    }
}
