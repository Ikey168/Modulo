package com.modulo.controller;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginStatus;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.plugin.registry.PluginRegistryEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST controller for plugin management
 */
@RestController
@RequestMapping("/api/plugins")
@PreAuthorize("hasRole('ADMIN')")
public class PluginController {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginController.class);
    
    @Autowired
    private PluginManager pluginManager;
    
    @Autowired
    private PluginRegistry pluginRegistry;
    
    private final String PLUGIN_UPLOAD_DIR = "/tmp/plugins";
    
    /**
     * Get all plugins
     */
    @GetMapping
    public ResponseEntity<List<PluginRegistryEntry>> getAllPlugins() {
        try {
            List<PluginRegistryEntry> plugins = pluginRegistry.getAllRegisteredPlugins();
            return ResponseEntity.ok(plugins);
        } catch (Exception e) {
            logger.error("Error getting all plugins", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get plugin by name
     */
    @GetMapping("/{pluginId}")
    public ResponseEntity<PluginRegistryEntry> getPlugin(@PathVariable String pluginId) {
        try {
            return pluginRegistry.getByName(pluginId)
                .map(plugin -> ResponseEntity.ok(plugin))
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            logger.error("Error getting plugin: " + pluginId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Install a plugin from uploaded file
     */
    @PostMapping("/install")
    public ResponseEntity<Map<String, Object>> installPlugin(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "config", required = false) String configJson) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate file
            if (file.isEmpty()) {
                response.put("error", "No file uploaded");
                return ResponseEntity.badRequest().body(response);
            }
            
            if (!file.getOriginalFilename().endsWith(".jar")) {
                response.put("error", "Only JAR files are supported");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Create upload directory if it doesn't exist
            Path uploadDir = Paths.get(PLUGIN_UPLOAD_DIR);
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }
            
            // Save uploaded file
            String filename = file.getOriginalFilename();
            Path filePath = uploadDir.resolve(filename);
            file.transferTo(filePath.toFile());
            
            // Parse configuration
            Map<String, Object> config = parseConfig(configJson);
            
            // Install plugin
            String pluginId = pluginManager.installPlugin(filePath.toString(), config);
            
            response.put("success", true);
            response.put("pluginId", pluginId);
            response.put("message", "Plugin installed successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Plugin installation failed", e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (IOException e) {
            logger.error("File upload failed", e);
            response.put("error", "File upload failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during plugin installation", e);
            response.put("error", "Installation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Uninstall a plugin
     */
    @DeleteMapping("/{pluginId}")
    public ResponseEntity<Map<String, Object>> uninstallPlugin(@PathVariable String pluginId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            pluginManager.uninstallPlugin(pluginId);
            
            response.put("success", true);
            response.put("message", "Plugin uninstalled successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Plugin uninstallation failed: " + pluginId, e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during plugin uninstallation: " + pluginId, e);
            response.put("error", "Uninstallation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Start a plugin
     */
    @PostMapping("/{pluginId}/start")
    public ResponseEntity<Map<String, Object>> startPlugin(@PathVariable String pluginId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            pluginManager.startPlugin(pluginId);
            
            response.put("success", true);
            response.put("message", "Plugin started successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Plugin start failed: " + pluginId, e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error starting plugin: " + pluginId, e);
            response.put("error", "Start failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Stop a plugin
     */
    @PostMapping("/{pluginId}/stop")
    public ResponseEntity<Map<String, Object>> stopPlugin(@PathVariable String pluginId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            pluginManager.stopPlugin(pluginId);
            
            response.put("success", true);
            response.put("message", "Plugin stopped successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Plugin stop failed: " + pluginId, e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error stopping plugin: " + pluginId, e);
            response.put("error", "Stop failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get plugin status
     */
    @GetMapping("/{pluginId}/status")
    public ResponseEntity<Map<String, Object>> getPluginStatus(@PathVariable String pluginId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            PluginStatus status = pluginManager.getPluginStatus(pluginId);
            HealthCheck healthCheck = pluginManager.checkPluginHealth(pluginId);
            
            response.put("pluginId", pluginId);
            response.put("status", status);
            response.put("health", Map.of(
                "status", healthCheck.getStatus(),
                "message", healthCheck.getMessage(),
                "timestamp", healthCheck.getTimestamp(),
                "healthy", healthCheck.isHealthy()
            ));
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting plugin status: " + pluginId, e);
            response.put("error", "Failed to get status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get all plugin statuses
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getAllPluginStatuses() {
        try {
            Map<String, PluginStatus> statuses = pluginManager.getAllPluginStatuses();
            Map<String, HealthCheck> healthChecks = pluginManager.checkAllPluginHealth();
            
            Map<String, Object> response = new HashMap<>();
            for (String pluginId : statuses.keySet()) {
                Map<String, Object> pluginInfo = new HashMap<>();
                pluginInfo.put("status", statuses.get(pluginId));
                
                HealthCheck health = healthChecks.get(pluginId);
                if (health != null) {
                    pluginInfo.put("health", Map.of(
                        "status", health.getStatus(),
                        "message", health.getMessage(),
                        "timestamp", health.getTimestamp(),
                        "healthy", health.isHealthy()
                    ));
                }
                
                response.put(pluginId, pluginInfo);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error getting all plugin statuses", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get plugin information
     */
    @GetMapping("/{pluginId}/info")
    public ResponseEntity<Map<String, Object>> getPluginInfo(@PathVariable String pluginId) {
        try {
            Plugin plugin = pluginManager.getPlugin(pluginId);
            if (plugin == null) {
                return ResponseEntity.notFound().build();
            }
            
            Map<String, Object> info = new HashMap<>();
            info.put("name", plugin.getInfo().getName());
            info.put("version", plugin.getInfo().getVersion());
            info.put("description", plugin.getInfo().getDescription());
            info.put("author", plugin.getInfo().getAuthor());
            info.put("type", plugin.getInfo().getType());
            info.put("runtime", plugin.getInfo().getRuntime());
            info.put("capabilities", plugin.getCapabilities());
            info.put("requiredPermissions", plugin.getRequiredPermissions());
            info.put("subscribedEvents", plugin.getSubscribedEvents());
            info.put("publishedEvents", plugin.getPublishedEvents());
            
            return ResponseEntity.ok(info);
            
        } catch (Exception e) {
            logger.error("Error getting plugin info: " + pluginId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update plugin configuration
     */
    @PutMapping("/{pluginId}/config")
    public ResponseEntity<Map<String, Object>> updatePluginConfig(
            @PathVariable String pluginId,
            @RequestBody Map<String, Object> config) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            pluginRegistry.updatePluginConfig(pluginId, config);
            
            response.put("success", true);
            response.put("message", "Plugin configuration updated successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error updating plugin config: " + pluginId, e);
            response.put("error", "Failed to update configuration: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Parse configuration JSON string
     */
    private Map<String, Object> parseConfig(String configJson) {
        if (configJson == null || configJson.trim().isEmpty()) {
            return new HashMap<>();
        }
        
        // In a real implementation, use a proper JSON parser like Jackson
        // For now, return empty config
        return new HashMap<>();
    }
}
