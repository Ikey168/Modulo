package com.modulo.plugin.api;

import java.util.Map;

/**
 * User preferences for plugin customization
 */
public class UserPreferences {
    private Map<String, Object> preferences;
    private String theme;
    private String language;
    private Map<String, Object> pluginSettings;
    
    // Constructors
    public UserPreferences() {}
    
    public UserPreferences(Map<String, Object> preferences) {
        this.preferences = preferences;
    }
    
    // Getters and Setters
    public Map<String, Object> getPreferences() { return preferences; }
    public void setPreferences(Map<String, Object> preferences) { this.preferences = preferences; }
    
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    
    public Map<String, Object> getPluginSettings() { return pluginSettings; }
    public void setPluginSettings(Map<String, Object> pluginSettings) { this.pluginSettings = pluginSettings; }
    
    // Convenience methods
    public Object getPreference(String key) {
        return preferences != null ? preferences.get(key) : null;
    }
    
    public void setPreference(String key, Object value) {
        if (preferences == null) {
            preferences = new java.util.HashMap<>();
        }
        preferences.put(key, value);
    }
    
    public Object getPluginSetting(String pluginId, String key) {
        if (pluginSettings == null) return null;
        @SuppressWarnings("unchecked")
        Map<String, Object> settings = (Map<String, Object>) pluginSettings.get(pluginId);
        return settings != null ? settings.get(key) : null;
    }
    
    public void setPluginSetting(String pluginId, String key, Object value) {
        if (pluginSettings == null) {
            pluginSettings = new java.util.HashMap<>();
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> settings = (Map<String, Object>) pluginSettings.computeIfAbsent(
            pluginId, k -> new java.util.HashMap<>());
        settings.put(key, value);
    }
}
