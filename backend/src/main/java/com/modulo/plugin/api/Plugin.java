package com.modulo.plugin.api;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Core plugin interface that all plugins must implement.
 * Provides lifecycle management and basic metadata.
 */
public interface Plugin {
    
    /**
     * Get plugin metadata
     * @return PluginInfo containing name, version, description, etc.
     */
    PluginInfo getInfo();
    
    /**
     * Initialize the plugin with configuration
     * @param config Plugin configuration map
     * @throws PluginException if initialization fails
     */
    void initialize(Map<String, Object> config) throws PluginException;
    
    /**
     * Start the plugin
     * @throws PluginException if startup fails
     */
    void start() throws PluginException;
    
    /**
     * Stop the plugin
     * @throws PluginException if shutdown fails
     */
    void stop() throws PluginException;
    
    /**
     * Check if plugin is healthy
     * @return HealthCheck result
     */
    HealthCheck healthCheck();
    
    /**
     * Get plugin capabilities
     * @return List of capability strings
     */
    List<String> getCapabilities();
    
    /**
     * Get required permissions
     * @return List of required permission strings
     */
    List<String> getRequiredPermissions();
    
    /**
     * Get events this plugin subscribes to
     * @return List of event type strings
     */
    List<String> getSubscribedEvents();
    
    /**
     * Get events this plugin can publish
     * @return List of event type strings
     */
    List<String> getPublishedEvents();
}
