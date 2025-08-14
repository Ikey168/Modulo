package com.modulo.plugin.api;

import java.time.LocalDateTime;

/**
 * Plugin metadata information
 */
public class PluginInfo {
    private final String name;
    private final String version;
    private final String description;
    private final String author;
    private final PluginType type;
    private final PluginRuntime runtime;
    private final LocalDateTime createdAt;
    
    public PluginInfo(String name, String version, String description, String author, 
                     PluginType type, PluginRuntime runtime) {
        this.name = name;
        this.version = version;
        this.description = description;
        this.author = author;
        this.type = type;
        this.runtime = runtime;
        this.createdAt = LocalDateTime.now();
    }
    
    // Getters
    public String getName() { return name; }
    public String getVersion() { return version; }
    public String getDescription() { return description; }
    public String getAuthor() { return author; }
    public PluginType getType() { return type; }
    public PluginRuntime getRuntime() { return runtime; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    
    @Override
    public String toString() {
        return String.format("PluginInfo{name='%s', version='%s', type=%s, runtime=%s}", 
                           name, version, type, runtime);
    }
}
