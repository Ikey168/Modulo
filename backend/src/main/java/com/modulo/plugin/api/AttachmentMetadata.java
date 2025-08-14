package com.modulo.plugin.api;

import java.time.LocalDateTime;

/**
 * Attachment metadata for plugin API
 */
public class AttachmentMetadata {
    private Long id;
    private String filename;
    private String contentType;
    private Long size;
    private String url;
    private LocalDateTime createdAt;
    
    // Constructors
    public AttachmentMetadata() {}
    
    public AttachmentMetadata(Long id, String filename, String contentType, Long size, String url) {
        this.id = id;
        this.filename = filename;
        this.contentType = contentType;
        this.size = size;
        this.url = url;
        this.createdAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
    
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    
    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }
    
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
