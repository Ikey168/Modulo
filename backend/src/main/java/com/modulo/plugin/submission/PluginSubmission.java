package com.modulo.plugin.submission;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Represents a plugin submission from a developer
 */
@Entity
@Table(name = "plugin_submissions")
public class PluginSubmission {
    
    @Id
    private String submissionId;
    
    @Column(nullable = false, length = 100)
    private String pluginName;
    
    @Column(nullable = false, length = 50)
    private String version;
    
    @Column(nullable = false, length = 1000)
    private String description;
    
    @Column(length = 50)
    private String category;
    
    @Column(nullable = false, length = 100)
    private String developerName;
    
    @Column(nullable = false, length = 255)
    private String developerEmail;
    
    @Column(length = 500)
    private String homepageUrl;
    
    @Column(length = 500)
    private String documentationUrl;
    
    @Column(length = 500)
    private String sourceCodeUrl;
    
    @Column(length = 50)
    private String licenseType;
    
    @Column(length = 500)
    private String tags;
    
    @Column(length = 500)
    private String requiredPermissions;
    
    @Column(length = 50)
    private String minPlatformVersion;
    
    @Column(length = 50)
    private String maxPlatformVersion;
    
    @Column(length = 1000)
    private String jarFilePath;
    
    @Column(length = 500)
    private String iconFilePath;
    
    @Column(length = 2000)
    private String screenshotPaths;
    
    private long fileSize;
    
    @Column(length = 64)
    private String checksum;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubmissionStatus status;
    
    @Column(nullable = false)
    private LocalDateTime submittedAt;
    
    private LocalDateTime reviewStartedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime rejectedAt;
    private LocalDateTime publishedAt;
    private LocalDateTime reviewedAt;
    
    @Column(length = 2000)
    private String reviewNotes;
    
    @Column(length = 2000)
    private String validationErrors;
    
    @Column(length = 2000)
    private String validationWarnings;
    
    @Column(nullable = false)
    private boolean securityCheckPassed = false;
    
    @Column(nullable = false)
    private boolean compatibilityCheckPassed = false;
    
    private String reviewerId;
    
    // Constructors
    public PluginSubmission() {
        this.submittedAt = LocalDateTime.now();
        this.status = SubmissionStatus.PENDING_REVIEW;
    }
    
    public PluginSubmission(String pluginName, String version, String developerEmail) {
        this();
        this.pluginName = pluginName;
        this.version = version;
        this.developerEmail = developerEmail;
    }
    
    // Getters and Setters
    public String getSubmissionId() {
        return submissionId;
    }
    
    public void setSubmissionId(String submissionId) {
        this.submissionId = submissionId;
    }
    
    public String getDeveloperName() {
        return developerName;
    }
    
    public void setDeveloperName(String developerName) {
        this.developerName = developerName;
    }
    
    public String getDeveloperEmail() {
        return developerEmail;
    }
    
    public void setDeveloperEmail(String developerEmail) {
        this.developerEmail = developerEmail;
    }
    
    public String getPluginName() {
        return pluginName;
    }
    
    public void setPluginName(String pluginName) {
        this.pluginName = pluginName;
    }
    
    public String getVersion() {
        return version;
    }
    
    public void setVersion(String version) {
        this.version = version;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public String getCategory() {
        return category;
    }
    
    public void setCategory(String category) {
        this.category = category;
    }
    
    public String getTags() {
        return tags;
    }
    
    public void setTags(String tags) {
        this.tags = tags;
    }
    
    public String getHomepageUrl() {
        return homepageUrl;
    }
    
    public void setHomepageUrl(String homepageUrl) {
        this.homepageUrl = homepageUrl;
    }
    
    public String getDocumentationUrl() {
        return documentationUrl;
    }
    
    public void setDocumentationUrl(String documentationUrl) {
        this.documentationUrl = documentationUrl;
    }
    
    public String getSourceCodeUrl() {
        return sourceCodeUrl;
    }
    
    public void setSourceCodeUrl(String sourceCodeUrl) {
        this.sourceCodeUrl = sourceCodeUrl;
    }
    
    public String getLicenseType() {
        return licenseType;
    }
    
    public void setLicenseType(String licenseType) {
        this.licenseType = licenseType;
    }
    
    public String getMinPlatformVersion() {
        return minPlatformVersion;
    }
    
    public void setMinPlatformVersion(String minPlatformVersion) {
        this.minPlatformVersion = minPlatformVersion;
    }
    
    public String getRequiredPermissions() {
        return requiredPermissions;
    }
    
    public void setRequiredPermissions(String requiredPermissions) {
        this.requiredPermissions = requiredPermissions;
    }
    
    public String getMaxPlatformVersion() {
        return maxPlatformVersion;
    }
    
    public void setMaxPlatformVersion(String maxPlatformVersion) {
        this.maxPlatformVersion = maxPlatformVersion;
    }
    
    public String getJarFilePath() {
        return jarFilePath;
    }
    
    public void setJarFilePath(String jarFilePath) {
        this.jarFilePath = jarFilePath;
    }
    
    public String getIconFilePath() {
        return iconFilePath;
    }
    
    public void setIconFilePath(String iconFilePath) {
        this.iconFilePath = iconFilePath;
    }
    
    public String getScreenshotPaths() {
        return screenshotPaths;
    }
    
    public void setScreenshotPaths(String screenshotPaths) {
        this.screenshotPaths = screenshotPaths;
    }
    
    public long getFileSize() {
        return fileSize;
    }
    
    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }
    
    public String getChecksum() {
        return checksum;
    }
    
    public void setChecksum(String checksum) {
        this.checksum = checksum;
    }
    
    public SubmissionStatus getStatus() {
        return status;
    }
    
    public void setStatus(SubmissionStatus status) {
        this.status = status;
    }
    
    public String getReviewNotes() {
        return reviewNotes;
    }
    
    public void setReviewNotes(String reviewNotes) {
        this.reviewNotes = reviewNotes;
    }
    
    public String getReviewerId() {
        return reviewerId;
    }
    
    public void setReviewerId(String reviewerId) {
        this.reviewerId = reviewerId;
    }
    
    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }
    
    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }
    
    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }
    
    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }
    
    public LocalDateTime getReviewStartedAt() {
        return reviewStartedAt;
    }
    
    public void setReviewStartedAt(LocalDateTime reviewStartedAt) {
        this.reviewStartedAt = reviewStartedAt;
    }
    
    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }
    
    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }
    
    public LocalDateTime getRejectedAt() {
        return rejectedAt;
    }
    
    public void setRejectedAt(LocalDateTime rejectedAt) {
        this.rejectedAt = rejectedAt;
    }
    
    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }
    
    public void setPublishedAt(LocalDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }
    
    public boolean isSecurityCheckPassed() {
        return securityCheckPassed;
    }
    
    public void setSecurityCheckPassed(boolean securityCheckPassed) {
        this.securityCheckPassed = securityCheckPassed;
    }
    
    public boolean isCompatibilityCheckPassed() {
        return compatibilityCheckPassed;
    }
    
    public void setCompatibilityCheckPassed(boolean compatibilityCheckPassed) {
        this.compatibilityCheckPassed = compatibilityCheckPassed;
    }
    
    public String getValidationErrors() {
        return validationErrors;
    }
    
    public void setValidationErrors(String validationErrors) {
        this.validationErrors = validationErrors;
    }
    
    public String getValidationWarnings() {
        return validationWarnings;
    }
    
    public void setValidationWarnings(String validationWarnings) {
        this.validationWarnings = validationWarnings;
    }
    
    /**
     * Check if the submission has passed all validations
     */
    public boolean isValidationPassed() {
        return securityCheckPassed && compatibilityCheckPassed && 
               (validationErrors == null || validationErrors.trim().isEmpty());
    }
    
    /**
     * Check if the submission is ready for publication
     */
    public boolean isReadyForPublication() {
        return status == SubmissionStatus.APPROVED && isValidationPassed();
    }
}
