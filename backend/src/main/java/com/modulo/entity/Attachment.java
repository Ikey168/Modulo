package com.modulo.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "attachments", schema = "application")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "attachment_id")
    private Long id;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "blob_name", nullable = false, unique = true)
    private String blobName;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "container_name", nullable = false)
    private String containerName;

    @Column(name = "blob_url", nullable = false)
    private String blobUrl;

    @Column(name = "cdn_url")
    private String cdnUrl;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @Column(name = "uploaded_by")
    private String uploadedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "note_id", foreignKey = @ForeignKey(name = "fk_attachment_note"))
    private Note note;

    @Column(name = "is_active")
    private Boolean isActive = true;

    // Constructors
    public Attachment() {}

    public Attachment(Long id, String originalFilename, String blobName, String contentType, Long fileSize, 
                     String containerName, String blobUrl, String cdnUrl, LocalDateTime uploadedAt, 
                     String uploadedBy, Note note, Boolean isActive) {
        this.id = id;
        this.originalFilename = originalFilename;
        this.blobName = blobName;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.containerName = containerName;
        this.blobUrl = blobUrl;
        this.cdnUrl = cdnUrl;
        this.uploadedAt = uploadedAt;
        this.uploadedBy = uploadedBy;
        this.note = note;
        this.isActive = isActive != null ? isActive : true;
    }

    // Static builder method
    public static AttachmentBuilder builder() {
        return new AttachmentBuilder();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getBlobName() { return blobName; }
    public void setBlobName(String blobName) { this.blobName = blobName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getContainerName() { return containerName; }
    public void setContainerName(String containerName) { this.containerName = containerName; }
    public String getBlobUrl() { return blobUrl; }
    public void setBlobUrl(String blobUrl) { this.blobUrl = blobUrl; }
    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
    public String getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; }
    public Note getNote() { return note; }
    public void setNote(Note note) { this.note = note; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    @PrePersist
    protected void onCreate() {
        if (uploadedAt == null) {
            uploadedAt = LocalDateTime.now();
        }
        if (isActive == null) {
            isActive = true;
        }
    }

    // Builder class
    public static class AttachmentBuilder {
        private Long id;
        private String originalFilename;
        private String blobName;
        private String contentType;
        private Long fileSize;
        private String containerName;
        private String blobUrl;
        private String cdnUrl;
        private LocalDateTime uploadedAt;
        private String uploadedBy;
        private Note note;
        private Boolean isActive = true;

        public AttachmentBuilder id(Long id) { this.id = id; return this; }
        public AttachmentBuilder originalFilename(String originalFilename) { this.originalFilename = originalFilename; return this; }
        public AttachmentBuilder blobName(String blobName) { this.blobName = blobName; return this; }
        public AttachmentBuilder contentType(String contentType) { this.contentType = contentType; return this; }
        public AttachmentBuilder fileSize(Long fileSize) { this.fileSize = fileSize; return this; }
        public AttachmentBuilder containerName(String containerName) { this.containerName = containerName; return this; }
        public AttachmentBuilder blobUrl(String blobUrl) { this.blobUrl = blobUrl; return this; }
        public AttachmentBuilder cdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; return this; }
        public AttachmentBuilder uploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; return this; }
        public AttachmentBuilder uploadedBy(String uploadedBy) { this.uploadedBy = uploadedBy; return this; }
        public AttachmentBuilder note(Note note) { this.note = note; return this; }
        public AttachmentBuilder isActive(Boolean isActive) { this.isActive = isActive; return this; }

        public Attachment build() {
            return new Attachment(id, originalFilename, blobName, contentType, fileSize, 
                                containerName, blobUrl, cdnUrl, uploadedAt, uploadedBy, note, isActive);
        }
    }
}
