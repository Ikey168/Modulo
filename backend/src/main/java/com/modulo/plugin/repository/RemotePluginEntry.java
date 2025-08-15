package com.modulo.plugin.repository;

/**
 * Represents a plugin entry in the remote repository
 */
public class RemotePluginEntry {
    private String id;
    private String name;
    private String version;
    private String description;
    private String author;
    private String downloadUrl;
    private String checksum;
    private long fileSize;
    private String category;
    private String[] tags;
    private String[] screenshots;
    private String homepageUrl;
    private String documentationUrl;
    private String licenseType;
    private String minPlatformVersion;
    private String[] requiredPermissions;
    private java.time.LocalDateTime publishedAt;
    private java.time.LocalDateTime updatedAt;
    private long downloadCount;
    private double rating;
    private int reviewCount;
    private boolean verified;
    private boolean deprecated;
    
    // Constructors
    public RemotePluginEntry() {}
    
    public RemotePluginEntry(String id, String name, String version, String downloadUrl) {
        this.id = id;
        this.name = name;
        this.version = version;
        this.downloadUrl = downloadUrl;
    }
    
    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    
    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }
    
    public String getChecksum() { return checksum; }
    public void setChecksum(String checksum) { this.checksum = checksum; }
    
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    
    public String[] getTags() { return tags; }
    public void setTags(String[] tags) { this.tags = tags; }
    
    public String[] getScreenshots() { return screenshots; }
    public void setScreenshots(String[] screenshots) { this.screenshots = screenshots; }
    
    public String getHomepageUrl() { return homepageUrl; }
    public void setHomepageUrl(String homepageUrl) { this.homepageUrl = homepageUrl; }
    
    public String getDocumentationUrl() { return documentationUrl; }
    public void setDocumentationUrl(String documentationUrl) { this.documentationUrl = documentationUrl; }
    
    public String getLicenseType() { return licenseType; }
    public void setLicenseType(String licenseType) { this.licenseType = licenseType; }
    
    public String getMinPlatformVersion() { return minPlatformVersion; }
    public void setMinPlatformVersion(String minPlatformVersion) { this.minPlatformVersion = minPlatformVersion; }
    
    public String[] getRequiredPermissions() { return requiredPermissions; }
    public void setRequiredPermissions(String[] requiredPermissions) { this.requiredPermissions = requiredPermissions; }
    
    public java.time.LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(java.time.LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    
    public java.time.LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    
    public long getDownloadCount() { return downloadCount; }
    public void setDownloadCount(long downloadCount) { this.downloadCount = downloadCount; }
    
    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }
    
    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }
    
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    
    public boolean isDeprecated() { return deprecated; }
    public void setDeprecated(boolean deprecated) { this.deprecated = deprecated; }
    
    @Override
    public String toString() {
        return String.format("RemotePluginEntry{id='%s', name='%s', version='%s', author='%s'}", 
                           id, name, version, author);
    }
}
