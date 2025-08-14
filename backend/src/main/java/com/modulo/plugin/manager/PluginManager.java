package com.modulo.plugin.manager;

import com.modulo.plugin.api.*;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.SystemEvent;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.plugin.registry.PluginRegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Central plugin manager that handles plugin lifecycle, registration, and coordination
 */
@Component
public class PluginManager {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginManager.class);
    
    private final Map<String, Plugin> activePlugins = new ConcurrentHashMap<>();
    private final Map<String, PluginStatus> pluginStatuses = new ConcurrentHashMap<>();
    
    @Autowired
    private PluginRegistry pluginRegistry;
    
    @Autowired
    private PluginEventBus eventBus;
    
    @Autowired
    private PluginLoader pluginLoader;
    
    @Autowired
    private PluginSecurityManager securityManager;
    
    /**
     * Initialize plugin manager on application startup
     */
    @EventListener(ApplicationReadyEvent.class)
    public void initialize() {
        logger.info("Initializing Plugin Manager");
        
        try {
            // Load and start registered plugins
            loadRegisteredPlugins();
            
            // Publish application started event
            eventBus.publish(new SystemEvent.ApplicationStarted());
            
            logger.info("Plugin Manager initialized successfully");
        } catch (Exception e) {
            logger.error("Failed to initialize Plugin Manager", e);
        }
    }
    
    /**
     * Install a new plugin
     * @param pluginPath Path to plugin file or directory
     * @param config Plugin configuration
     * @return Plugin ID if successful
     * @throws PluginException if installation fails
     */
    public String installPlugin(String pluginPath, Map<String, Object> config) throws PluginException {
        logger.info("Installing plugin from: {}", pluginPath);
        
        try {
            // Load plugin
            Plugin plugin = pluginLoader.loadPlugin(pluginPath);
            PluginInfo info = plugin.getInfo();
            String pluginId = info.getName();
            
            // Validate plugin
            validatePlugin(plugin);
            
            // Check security permissions
            if (!securityManager.canInstallPlugin(pluginId, plugin.getRequiredPermissions())) {
                throw new PluginException("Insufficient permissions to install plugin: " + pluginId);
            }
            
            // Register plugin
            pluginRegistry.registerPlugin(plugin, config);
            
            // Initialize and start plugin
            plugin.initialize(config);
            plugin.start();
            
            // Track plugin
            activePlugins.put(pluginId, plugin);
            pluginStatuses.put(pluginId, PluginStatus.ACTIVE);
            
            // Subscribe to events
            subscribeToEvents(plugin);
            
            // Publish installation event
            eventBus.publish(new SystemEvent.PluginInstalled(pluginId, info.getVersion()));
            
            logger.info("Plugin {} installed and started successfully", pluginId);
            return pluginId;
            
        } catch (Exception e) {
            logger.error("Failed to install plugin from: " + pluginPath, e);
            throw new PluginException("Failed to install plugin", e);
        }
    }
    
    /**
     * Uninstall a plugin
     * @param pluginId Plugin ID to uninstall
     * @throws PluginException if uninstallation fails
     */
    public void uninstallPlugin(String pluginId) throws PluginException {
        logger.info("Uninstalling plugin: {}", pluginId);
        
        Plugin plugin = activePlugins.get(pluginId);
        if (plugin == null) {
            throw new PluginException("Plugin not found: " + pluginId);
        }
        
        try {
            // Stop plugin
            stopPlugin(pluginId);
            
            // Unsubscribe from events
            unsubscribeFromEvents(plugin);
            
            // Remove from registry
            pluginRegistry.unregisterPlugin(pluginId);
            
            // Remove from tracking
            activePlugins.remove(pluginId);
            pluginStatuses.remove(pluginId);
            
            // Revoke security permissions
            securityManager.revokePluginAccess(pluginId);
            
            // Publish uninstallation event
            eventBus.publish(new SystemEvent.PluginUninstalled(pluginId));
            
            logger.info("Plugin {} uninstalled successfully", pluginId);
            
        } catch (Exception e) {
            logger.error("Failed to uninstall plugin: " + pluginId, e);
            throw new PluginException("Failed to uninstall plugin", e);
        }
    }
    
    /**
     * Start a plugin
     * @param pluginId Plugin ID to start
     * @throws PluginException if start fails
     */
    public void startPlugin(String pluginId) throws PluginException {
        Plugin plugin = activePlugins.get(pluginId);
        if (plugin == null) {
            throw new PluginException("Plugin not found: " + pluginId);
        }
        
        try {
            plugin.start();
            pluginStatuses.put(pluginId, PluginStatus.ACTIVE);
            subscribeToEvents(plugin);
            logger.info("Plugin {} started", pluginId);
        } catch (Exception e) {
            pluginStatuses.put(pluginId, PluginStatus.ERROR);
            logger.error("Failed to start plugin: " + pluginId, e);
            throw new PluginException("Failed to start plugin", e);
        }
    }
    
    /**
     * Stop a plugin
     * @param pluginId Plugin ID to stop
     * @throws PluginException if stop fails
     */
    public void stopPlugin(String pluginId) throws PluginException {
        Plugin plugin = activePlugins.get(pluginId);
        if (plugin == null) {
            throw new PluginException("Plugin not found: " + pluginId);
        }
        
        try {
            unsubscribeFromEvents(plugin);
            plugin.stop();
            pluginStatuses.put(pluginId, PluginStatus.INACTIVE);
            logger.info("Plugin {} stopped", pluginId);
        } catch (Exception e) {
            pluginStatuses.put(pluginId, PluginStatus.ERROR);
            logger.error("Failed to stop plugin: " + pluginId, e);
            throw new PluginException("Failed to stop plugin", e);
        }
    }
    
    /**
     * Get plugin by ID
     * @param pluginId Plugin ID
     * @return Plugin instance or null if not found
     */
    public Plugin getPlugin(String pluginId) {
        return activePlugins.get(pluginId);
    }
    
    /**
     * Get all active plugins
     * @return Map of plugin ID to Plugin instance
     */
    public Map<String, Plugin> getActivePlugins() {
        return new HashMap<>(activePlugins);
    }
    
    /**
     * Get plugin status
     * @param pluginId Plugin ID
     * @return Plugin status
     */
    public PluginStatus getPluginStatus(String pluginId) {
        return pluginStatuses.getOrDefault(pluginId, PluginStatus.UNKNOWN);
    }
    
    /**
     * Get all plugin statuses
     * @return Map of plugin ID to status
     */
    public Map<String, PluginStatus> getAllPluginStatuses() {
        return new HashMap<>(pluginStatuses);
    }
    
    /**
     * Check plugin health
     * @param pluginId Plugin ID
     * @return Health check result
     */
    public HealthCheck checkPluginHealth(String pluginId) {
        Plugin plugin = activePlugins.get(pluginId);
        if (plugin == null) {
            return HealthCheck.unknown("Plugin not found: " + pluginId);
        }
        
        try {
            return plugin.healthCheck();
        } catch (Exception e) {
            logger.error("Health check failed for plugin: " + pluginId, e);
            return HealthCheck.unhealthy("Health check failed: " + e.getMessage());
        }
    }
    
    /**
     * Check health of all plugins
     * @return Map of plugin ID to health check result
     */
    public Map<String, HealthCheck> checkAllPluginHealth() {
        Map<String, HealthCheck> healthResults = new HashMap<>();
        
        for (String pluginId : activePlugins.keySet()) {
            healthResults.put(pluginId, checkPluginHealth(pluginId));
        }
        
        return healthResults;
    }
    
    /**
     * Load plugins registered in the database
     */
    private void loadRegisteredPlugins() {
        List<PluginRegistryEntry> registeredPlugins = pluginRegistry.getAllRegisteredPlugins();
        
        for (PluginRegistryEntry entry : registeredPlugins) {
            if (entry.getStatus() == PluginStatus.ACTIVE) {
                try {
                    // Load plugin
                    Plugin plugin = pluginLoader.loadPlugin(entry.getPath());
                    
                    // Initialize with stored config
                    plugin.initialize(entry.getConfig());
                    plugin.start();
                    
                    // Track plugin
                    activePlugins.put(entry.getName(), plugin);
                    pluginStatuses.put(entry.getName(), PluginStatus.ACTIVE);
                    
                    // Subscribe to events
                    subscribeToEvents(plugin);
                    
                    logger.info("Loaded registered plugin: {}", entry.getName());
                    
                } catch (Exception e) {
                    logger.error("Failed to load registered plugin: " + entry.getName(), e);
                    pluginStatuses.put(entry.getName(), PluginStatus.ERROR);
                }
            }
        }
    }
    
    /**
     * Validate plugin before installation
     */
    private void validatePlugin(Plugin plugin) throws PluginException {
        PluginInfo info = plugin.getInfo();
        
        if (info.getName() == null || info.getName().trim().isEmpty()) {
            throw new PluginException("Plugin name cannot be empty");
        }
        
        if (info.getVersion() == null || info.getVersion().trim().isEmpty()) {
            throw new PluginException("Plugin version cannot be empty");
        }
        
        if (activePlugins.containsKey(info.getName())) {
            throw new PluginException("Plugin already installed: " + info.getName());
        }
        
        // Validate capabilities
        List<String> capabilities = plugin.getCapabilities();
        if (capabilities == null || capabilities.isEmpty()) {
            logger.warn("Plugin {} has no declared capabilities", info.getName());
        }
        
        // Validate permissions
        List<String> permissions = plugin.getRequiredPermissions();
        if (permissions != null) {
            for (String permission : permissions) {
                if (!securityManager.isValidPermission(permission)) {
                    throw new PluginException("Invalid permission: " + permission);
                }
            }
        }
    }
    
    /**
     * Subscribe plugin to its declared events
     */
    private void subscribeToEvents(Plugin plugin) {
        List<String> subscribedEvents = plugin.getSubscribedEvents();
        if (subscribedEvents != null) {
            for (String eventType : subscribedEvents) {
                eventBus.subscribe(eventType, event -> {
                    try {
                        // Notify plugin of event (if it implements event handling)
                        if (plugin instanceof PluginEventHandler) {
                            ((PluginEventHandler) plugin).handleEvent(event);
                        }
                    } catch (Exception e) {
                        logger.error("Plugin {} failed to handle event {}", 
                                   plugin.getInfo().getName(), eventType, e);
                    }
                });
            }
        }
    }
    
    /**
     * Unsubscribe plugin from events
     */
    private void unsubscribeFromEvents(Plugin plugin) {
        // Note: In a real implementation, we'd need to track listeners per plugin
        // For now, this is a placeholder
        logger.debug("Unsubscribing plugin {} from events", plugin.getInfo().getName());
    }
    
    /**
     * Shutdown all plugins
     */
    @PreDestroy
    public void shutdown() {
        logger.info("Shutting down Plugin Manager");
        
        // Publish application stopping event
        eventBus.publish(new SystemEvent.ApplicationStopping());
        
        // Stop all plugins
        for (Map.Entry<String, Plugin> entry : activePlugins.entrySet()) {
            try {
                logger.info("Stopping plugin: {}", entry.getKey());
                entry.getValue().stop();
            } catch (Exception e) {
                logger.error("Failed to stop plugin: " + entry.getKey(), e);
            }
        }
        
        activePlugins.clear();
        pluginStatuses.clear();
        
        logger.info("Plugin Manager shutdown complete");
    }
}
