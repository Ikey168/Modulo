package com.modulo.plugin.event;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Base class for all plugin events
 */
public abstract class PluginEvent {
    
    private final String id;
    private final String type;
    private final Object source;
    private final LocalDateTime timestamp;
    private final Map<String, Object> metadata;
    
    protected PluginEvent(String type, Object source, Map<String, Object> metadata) {
        this.id = UUID.randomUUID().toString();
        this.type = type;
        this.source = source;
        this.timestamp = LocalDateTime.now();
        this.metadata = metadata;
    }
    
    protected PluginEvent(String type, Object source) {
        this(type, source, new java.util.HashMap<>());
    }
    
    // Getters
    public String getId() { return id; }
    public String getType() { return type; }
    public Object getSource() { return source; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public Map<String, Object> getMetadata() { return metadata; }
    
    // Metadata helpers
    public void addMetadata(String key, Object value) {
        metadata.put(key, value);
    }
    
    public Object getMetadata(String key) {
        return metadata.get(key);
    }
    
    @Override
    public String toString() {
        return String.format("PluginEvent{id='%s', type='%s', timestamp=%s}", 
                           id, type, timestamp);
    }
}
