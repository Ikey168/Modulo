package com.modulo.plugin.submission;

import javax.validation.constraints.*;

/**
 * Request object for plugin submission
 */
public class PluginSubmissionRequest {
    
    @NotBlank(message = "Plugin name is required")
    @Size(max = 100, message = "Plugin name must be 100 characters or less")
    private String pluginName;
    
    @NotBlank(message = "Version is required")
    @Pattern(regexp = "\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?", message = "Version must follow semantic versioning (e.g., 1.0.0)")
    private String version;
    
    @NotBlank(message = "Description is required")
    @Size(max = 1000, message = "Description must be 1000 characters or less")
    private String description;
    
    @Size(max = 50, message = "Category must be 50 characters or less")
    private String category;
    
    @NotBlank(message = "Developer name is required")
    @Size(max = 100, message = "Developer name must be 100 characters or less")
    private String developerName;
    
    @NotBlank(message = "Developer email is required")
    @Email(message = "Invalid email format")
    private String developerEmail;
    
    @Pattern(regexp = "^https?://.*", message = "Homepage URL must start with http:// or https://")
    private String homepageUrl;
    
    @Pattern(regexp = "^https?://.*", message = "Documentation URL must start with http:// or https://")
    private String documentationUrl;
    
    @Size(max = 50, message = "License type must be 50 characters or less")
    private String licenseType;
    
    @Size(max = 500, message = "Tags must be 500 characters or less")
    private String tags;
    
    @Pattern(regexp = "\\d+\\.\\d+\\.\\d+", message = "Minimum platform version must follow semantic versioning")
    private String minPlatformVersion;
    
    @Pattern(regexp = "\\d+\\.\\d+\\.\\d+", message = "Maximum platform version must follow semantic versioning")
    private String maxPlatformVersion;
    
    // Default constructor
    public PluginSubmissionRequest() {}
    
    // Constructor with required fields
    public PluginSubmissionRequest(String pluginName, String version, String description, 
                                  String developerName, String developerEmail) {
        this.pluginName = pluginName;
        this.version = version;
        this.description = description;
        this.developerName = developerName;
        this.developerEmail = developerEmail;
    }
    
    // Getters and setters
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
    
    public String getLicenseType() {
        return licenseType;
    }
    
    public void setLicenseType(String licenseType) {
        this.licenseType = licenseType;
    }
    
    public String getTags() {
        return tags;
    }
    
    public void setTags(String tags) {
        this.tags = tags;
    }
    
    public String getMinPlatformVersion() {
        return minPlatformVersion;
    }
    
    public void setMinPlatformVersion(String minPlatformVersion) {
        this.minPlatformVersion = minPlatformVersion;
    }
    
    public String getMaxPlatformVersion() {
        return maxPlatformVersion;
    }
    
    public void setMaxPlatformVersion(String maxPlatformVersion) {
        this.maxPlatformVersion = maxPlatformVersion;
    }
    
    @Override
    public String toString() {
        return "PluginSubmissionRequest{" +
                "pluginName='" + pluginName + '\'' +
                ", version='" + version + '\'' +
                ", developerName='" + developerName + '\'' +
                ", developerEmail='" + developerEmail + '\'' +
                ", category='" + category + '\'' +
                '}';
    }
}
