package com.modulo.plugin.api.renderer;

import java.util.Map;
import java.util.HashMap;

/**
 * Response from handling a renderer event
 */
public class RendererEventResponse {
    
    public enum ResponseType {
        NONE,          // No response needed
        UPDATE_NOTE,   // Update the note content
        REFRESH_VIEW,  // Refresh the current view
        NAVIGATION,    // Navigate to a different note/view
        MESSAGE        // Show a message to user
    }
    
    private final ResponseType type;
    private final Map<String, Object> data;
    private final String message;
    private final String navigationTarget;
    
    private RendererEventResponse(ResponseType type, Map<String, Object> data, String message, String navigationTarget) {
        this.type = type;
        this.data = data != null ? new HashMap<>(data) : new HashMap<>();
        this.message = message;
        this.navigationTarget = navigationTarget;
    }
    
    // Getters
    public ResponseType getType() { return type; }
    public Map<String, Object> getData() { return new HashMap<>(data); }
    public String getMessage() { return message; }
    public String getNavigationTarget() { return navigationTarget; }
    
    // Convenience methods for data access
    public Object getData(String key) {
        return data.get(key);
    }
    
    public String getStringData(String key) {
        Object value = data.get(key);
        return value instanceof String ? (String) value : null;
    }
    
    public Integer getIntegerData(String key) {
        Object value = data.get(key);
        return value instanceof Integer ? (Integer) value : null;
    }
    
    public Boolean getBooleanData(String key) {
        Object value = data.get(key);
        return value instanceof Boolean ? (Boolean) value : null;
    }
    
    // Static factory methods
    public static RendererEventResponse none() {
        return new RendererEventResponse(ResponseType.NONE, null, null, null);
    }
    
    public static RendererEventResponse updateNote(Map<String, Object> noteData) {
        return new RendererEventResponse(ResponseType.UPDATE_NOTE, noteData, null, null);
    }
    
    public static RendererEventResponse refreshView() {
        return new RendererEventResponse(ResponseType.REFRESH_VIEW, null, null, null);
    }
    
    public static RendererEventResponse navigate(String target) {
        return new RendererEventResponse(ResponseType.NAVIGATION, null, null, target);
    }
    
    public static RendererEventResponse message(String message) {
        return new RendererEventResponse(ResponseType.MESSAGE, null, message, null);
    }
    
    public static RendererEventResponse custom(ResponseType type, Map<String, Object> data) {
        return new RendererEventResponse(type, data, null, null);
    }
    
    /**
     * Builder for creating complex responses
     */
    public static class Builder {
        private ResponseType type;
        private Map<String, Object> data = new HashMap<>();
        private String message;
        private String navigationTarget;
        
        public Builder(ResponseType type) {
            this.type = type;
        }
        
        public Builder data(String key, Object value) {
            this.data.put(key, value);
            return this;
        }
        
        public Builder data(Map<String, Object> data) {
            this.data.putAll(data);
            return this;
        }
        
        public Builder message(String message) {
            this.message = message;
            return this;
        }
        
        public Builder navigationTarget(String navigationTarget) {
            this.navigationTarget = navigationTarget;
            return this;
        }
        
        public RendererEventResponse build() {
            return new RendererEventResponse(type, data, message, navigationTarget);
        }
    }
}
