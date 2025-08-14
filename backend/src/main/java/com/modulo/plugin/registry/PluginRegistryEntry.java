package com.modulo.plugin.registry;

import com.modulo.plugin.manager.PluginStatus;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Plugin registry entry
 */
public class PluginRegistryEntry {
    private Long id;
    private String name;
    private String version;
    private String description;
    private String author;
    private String type;
    private String runtime;
    private PluginStatus status;
    private String path;
    private String endpoint;
    private Map<String, Object> config;
    private Map<String, Object> configSchema;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // Constructors
    public PluginRegistryEntry() {}
    
    public PluginRegistryEntry(String name, String version, String type, String runtime) {
        this.name = name;
        this.version = version;
        this.type = type;
        this.runtime = runtime;
        this.status = PluginStatus.INACTIVE;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public String getRuntime() { return runtime; }
    public void setRuntime(String runtime) { this.runtime = runtime; }
    
    public PluginStatus getStatus() { return status; }
    public void setStatus(PluginStatus status) { this.status = status; }
    
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    
    public Map<String, Object> getConfig() { return config; }
    public void setConfig(Map<String, Object> config) { this.config = config; }
    
    public Map<String, Object> getConfigSchema() { return configSchema; }
    public void setConfigSchema(Map<String, Object> configSchema) { this.configSchema = configSchema; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    
    @Override
    public String toString() {
        return String.format("PluginRegistryEntry{name='%s', version='%s', type='%s', status=%s}", 
                           name, version, type, status);
    }
}
