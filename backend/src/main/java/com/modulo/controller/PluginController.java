package com.modulo.controller;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginStatus;
import com.modulo.plugin.manager.RemotePluginLoader;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.plugin.registry.PluginRegistryEntry;
import com.modulo.plugin.repository.PluginRepositoryService;
import com.modulo.plugin.repository.RemotePluginEntry;
import com.modulo.util.LogSanitizer;
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
    
    @Autowired
    private RemotePluginLoader remotePluginLoader;
    
    @Autowired
    private PluginRepositoryService repositoryService;
    
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
            logger.error("Error getting plugin: {}", LogSanitizer.sanitize(pluginId), e);
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
            response.put("error", "File upload failed: " + LogSanitizer.sanitizeMessage(e.getMessage()));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during plugin installation", e);
            response.put("error", "Installation failed: " + LogSanitizer.sanitizeMessage(e.getMessage()));
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
            logger.error("Plugin uninstallation failed: {}", LogSanitizer.sanitize(pluginId), e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during plugin uninstallation: {}", LogSanitizer.sanitize(pluginId), e);
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
            logger.error("Plugin start failed: {}", LogSanitizer.sanitize(pluginId), e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error starting plugin: {}", LogSanitizer.sanitize(pluginId), e);
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
            logger.error("Plugin stop failed: {}", LogSanitizer.sanitize(pluginId), e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error stopping plugin: {}", LogSanitizer.sanitize(pluginId), e);
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
            logger.error("Error getting plugin status: {}", LogSanitizer.sanitize(pluginId), e);
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
            logger.error("Error getting plugin info: {}", LogSanitizer.sanitize(pluginId), e);
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
            logger.error("Error updating plugin config: {}", LogSanitizer.sanitize(pluginId), e);
            response.put("error", "Failed to update configuration: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Install a plugin from a remote URL
     */
    @PostMapping("/install-remote")
    public ResponseEntity<Map<String, Object>> installRemotePlugin(
            @RequestParam("url") String remoteUrl,
            @RequestParam(value = "checksum", required = false) String expectedChecksum,
            @RequestParam(value = "config", required = false) String configJson) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate URL parameter
            if (remoteUrl == null || remoteUrl.trim().isEmpty()) {
                response.put("error", "Remote URL is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Parse configuration
            Map<String, Object> config = parseConfig(configJson);
            
            // Load remote plugin
            Plugin plugin = remotePluginLoader.loadRemotePlugin(remoteUrl, expectedChecksum, config);
            
            // Install the plugin through PluginManager
            String pluginId = pluginManager.installRemotePlugin(plugin, remoteUrl, config);
            
            response.put("success", true);
            response.put("pluginId", pluginId);
            response.put("message", "Remote plugin installed successfully");
            response.put("source", "remote");
            response.put("url", remoteUrl);
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Remote plugin installation failed from URL: {}", remoteUrl, e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during remote plugin installation from URL: {}", remoteUrl, e);
            response.put("error", "Remote installation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get remote plugin cache information
     */
    @GetMapping("/cache/info")
    public ResponseEntity<Map<String, Object>> getRemotePluginCacheInfo() {
        try {
            Map<String, Object> cacheInfo = new HashMap<>();
            cacheInfo.put("cacheDirectory", remotePluginLoader.getCacheDirectory());
            
            // Get cache directory size and file count
            Path cacheDir = Paths.get(remotePluginLoader.getCacheDirectory());
            if (Files.exists(cacheDir)) {
                long totalSize = Files.walk(cacheDir)
                    .filter(Files::isRegularFile)
                    .mapToLong(file -> {
                        try {
                            return Files.size(file);
                        } catch (IOException e) {
                            return 0;
                        }
                    })
                    .sum();
                
                long fileCount = Files.walk(cacheDir)
                    .filter(Files::isRegularFile)
                    .count();
                
                cacheInfo.put("totalSize", totalSize);
                cacheInfo.put("fileCount", fileCount);
                cacheInfo.put("totalSizeMB", totalSize / (1024.0 * 1024.0));
            } else {
                cacheInfo.put("totalSize", 0);
                cacheInfo.put("fileCount", 0);
                cacheInfo.put("totalSizeMB", 0.0);
            }
            
            return ResponseEntity.ok(cacheInfo);
            
        } catch (Exception e) {
            logger.error("Error getting cache info", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Clear remote plugin cache
     */
    @DeleteMapping("/cache")
    public ResponseEntity<Map<String, Object>> clearRemotePluginCache() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            remotePluginLoader.clearCache();
            
            response.put("success", true);
            response.put("message", "Remote plugin cache cleared successfully");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error clearing remote plugin cache", e);
            response.put("error", "Failed to clear cache: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Validate a remote plugin URL without installing
     */
    @PostMapping("/validate-remote")
    public ResponseEntity<Map<String, Object>> validateRemotePlugin(
            @RequestParam("url") String remoteUrl,
            @RequestParam(value = "checksum", required = false) String expectedChecksum) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Validate URL parameter
            if (remoteUrl == null || remoteUrl.trim().isEmpty()) {
                response.put("error", "Remote URL is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Test download and validation without installing
            Plugin plugin = remotePluginLoader.loadRemotePlugin(remoteUrl, expectedChecksum, new HashMap<>());
            
            response.put("success", true);
            response.put("valid", true);
            response.put("pluginInfo", Map.of(
                "name", plugin.getInfo().getName(),
                "version", plugin.getInfo().getVersion(),
                "description", plugin.getInfo().getDescription(),
                "author", plugin.getInfo().getAuthor(),
                "type", plugin.getInfo().getType(),
                "runtime", plugin.getInfo().getRuntime()
            ));
            response.put("message", "Remote plugin validation successful");
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Remote plugin validation failed for URL: {}", remoteUrl, e);
            response.put("valid", false);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during remote plugin validation for URL: {}", remoteUrl, e);
            response.put("valid", false);
            response.put("error", "Validation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Browse available plugins in remote repositories
     */
    @GetMapping("/repository/search")
    public ResponseEntity<Map<String, Object>> searchRemotePlugins(
            @RequestParam(value = "q", required = false, defaultValue = "") String query,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "limit", required = false, defaultValue = "20") int limit) {
        
        try {
            List<RemotePluginEntry> plugins = repositoryService.searchPlugins(query, category, limit);
            
            Map<String, Object> response = new HashMap<>();
            response.put("plugins", plugins);
            response.put("total", plugins.size());
            response.put("query", query);
            response.put("category", category);
            response.put("limit", limit);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error searching remote plugins", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get available plugin categories
     */
    @GetMapping("/repository/categories")
    public ResponseEntity<List<String>> getPluginCategories() {
        try {
            List<String> categories = repositoryService.getAvailableCategories();
            return ResponseEntity.ok(categories);
            
        } catch (Exception e) {
            logger.error("Error getting plugin categories", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get featured plugins
     */
    @GetMapping("/repository/featured")
    public ResponseEntity<List<RemotePluginEntry>> getFeaturedPlugins(
            @RequestParam(value = "limit", required = false, defaultValue = "10") int limit) {
        
        try {
            List<RemotePluginEntry> featured = repositoryService.getFeaturedPlugins(limit);
            return ResponseEntity.ok(featured);
            
        } catch (Exception e) {
            logger.error("Error getting featured plugins", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get detailed information about a remote plugin
     */
    @GetMapping("/repository/plugin/{pluginId}")
    public ResponseEntity<RemotePluginEntry> getRemotePluginDetails(@PathVariable String pluginId) {
        try {
            RemotePluginEntry plugin = repositoryService.getPluginDetails(pluginId);
            return ResponseEntity.ok(plugin);
            
        } catch (Exception e) {
            logger.error("Error getting plugin details: {}", pluginId, e);
            return ResponseEntity.notFound().build();
        }
    }
    
    /**
     * Install plugin directly from repository by ID
     */
    @PostMapping("/repository/install/{pluginId}")
    public ResponseEntity<Map<String, Object>> installPluginFromRepository(
            @PathVariable String pluginId,
            @RequestParam(value = "config", required = false) String configJson) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Get plugin details from repository
            RemotePluginEntry remotePlugin = repositoryService.getPluginDetails(pluginId);
            
            // Parse configuration
            Map<String, Object> config = parseConfig(configJson);
            
            // Install using the remote URL
            Plugin plugin = remotePluginLoader.loadRemotePlugin(
                remotePlugin.getDownloadUrl(), 
                remotePlugin.getChecksum(), 
                config
            );
            
            String installedPluginId = pluginManager.installRemotePlugin(plugin, remotePlugin.getDownloadUrl(), config);
            
            response.put("success", true);
            response.put("pluginId", installedPluginId);
            response.put("message", "Plugin installed successfully from repository");
            response.put("source", "repository");
            response.put("repositoryId", pluginId);
            response.put("url", remotePlugin.getDownloadUrl());
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            logger.error("Repository plugin installation failed: {}", pluginId, e);
            response.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            logger.error("Unexpected error during repository plugin installation: {}", pluginId, e);
            response.put("error", "Installation failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get configured plugin repositories
     */
    @GetMapping("/repository/sources")
    public ResponseEntity<List<String>> getPluginRepositories() {
        try {
            List<String> repositories = repositoryService.getConfiguredRepositories();
            return ResponseEntity.ok(repositories);
            
        } catch (Exception e) {
            logger.error("Error getting plugin repositories", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Add a custom plugin repository
     */
    @PostMapping("/repository/sources")
    public ResponseEntity<Map<String, Object>> addPluginRepository(@RequestParam("url") String repositoryUrl) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            repositoryService.addRepository(repositoryUrl);
            
            response.put("success", true);
            response.put("message", "Repository added successfully");
            response.put("url", repositoryUrl);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error adding plugin repository: {}", repositoryUrl, e);
            response.put("error", "Failed to add repository: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Remove a plugin repository
     */
    @DeleteMapping("/repository/sources")
    public ResponseEntity<Map<String, Object>> removePluginRepository(@RequestParam("url") String repositoryUrl) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            repositoryService.removeRepository(repositoryUrl);
            
            response.put("success", true);
            response.put("message", "Repository removed successfully");
            response.put("url", repositoryUrl);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Error removing plugin repository: {}", repositoryUrl, e);
            response.put("error", "Failed to remove repository: " + e.getMessage());
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
