package com.modulo.dto;

public class AttachmentUploadResponse {
    private Long attachmentId;
    private String originalFilename;
    private String blobUrl;
    private String cdnUrl;
    private Long fileSize;
    private String contentType;
    private String message;
    private boolean success;

    // Constructors
    public AttachmentUploadResponse() {}

    public AttachmentUploadResponse(Long attachmentId, String originalFilename, String blobUrl, String cdnUrl, 
                                   Long fileSize, String contentType, String message, boolean success) {
        this.attachmentId = attachmentId;
        this.originalFilename = originalFilename;
        this.blobUrl = blobUrl;
        this.cdnUrl = cdnUrl;
        this.fileSize = fileSize;
        this.contentType = contentType;
        this.message = message;
        this.success = success;
    }

    // Static builder method
    public static AttachmentUploadResponseBuilder builder() {
        return new AttachmentUploadResponseBuilder();
    }

    // Getters and Setters
    public Long getAttachmentId() { return attachmentId; }
    public void setAttachmentId(Long attachmentId) { this.attachmentId = attachmentId; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getBlobUrl() { return blobUrl; }
    public void setBlobUrl(String blobUrl) { this.blobUrl = blobUrl; }
    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    // Builder class
    public static class AttachmentUploadResponseBuilder {
        private Long attachmentId;
        private String originalFilename;
        private String blobUrl;
        private String cdnUrl;
        private Long fileSize;
        private String contentType;
        private String message;
        private boolean success;

        public AttachmentUploadResponseBuilder attachmentId(Long attachmentId) { this.attachmentId = attachmentId; return this; }
        public AttachmentUploadResponseBuilder originalFilename(String originalFilename) { this.originalFilename = originalFilename; return this; }
        public AttachmentUploadResponseBuilder blobUrl(String blobUrl) { this.blobUrl = blobUrl; return this; }
        public AttachmentUploadResponseBuilder cdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; return this; }
        public AttachmentUploadResponseBuilder fileSize(Long fileSize) { this.fileSize = fileSize; return this; }
        public AttachmentUploadResponseBuilder contentType(String contentType) { this.contentType = contentType; return this; }
        public AttachmentUploadResponseBuilder message(String message) { this.message = message; return this; }
        public AttachmentUploadResponseBuilder success(boolean success) { this.success = success; return this; }

        public AttachmentUploadResponse build() {
            return new AttachmentUploadResponse(attachmentId, originalFilename, blobUrl, cdnUrl, 
                                              fileSize, contentType, message, success);
        }
    }
}
