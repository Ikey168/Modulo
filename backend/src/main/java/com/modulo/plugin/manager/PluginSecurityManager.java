package com.modulo.plugin.manager;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Security manager for plugin operations
 */
@Component
public class PluginSecurityManager {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginSecurityManager.class);
    
    // Define valid permissions
    private static final Set<String> VALID_PERMISSIONS = Set.of(
        // Note permissions
        "notes.read",
        "notes.write",
        "notes.delete",
        "notes.share",
        "notes.search",
        
        // User permissions
        "users.read",
        "users.write",
        "users.preferences",
        
        // System permissions
        "system.config",
        "system.events.publish",
        "system.events.subscribe",
        "system.metrics",
        
        // Attachment permissions
        "attachments.read",
        "attachments.write",
        "attachments.delete",
        
        // Blockchain permissions
        "blockchain.read",
        "blockchain.write",
        
        // Admin permissions
        "admin.plugins",
        "admin.users",
        "admin.system"
    );
    
    private final Map<String, Set<String>> pluginPermissions = new ConcurrentHashMap<>();
    private final Map<String, String> pluginTokens = new ConcurrentHashMap<>();
    
    /**
     * Check if a plugin can be installed with the given permissions
     * @param pluginId Plugin ID
     * @param requiredPermissions Required permissions
     * @return true if installation is allowed
     */
    public boolean canInstallPlugin(String pluginId, List<String> requiredPermissions) {
        if (requiredPermissions == null || requiredPermissions.isEmpty()) {
            return true;
        }
        
        // Check if all required permissions are valid
        for (String permission : requiredPermissions) {
            if (!isValidPermission(permission)) {
                logger.warn("Plugin {} requests invalid permission: {}", pluginId, permission);
                return false;
            }
        }
        
        // Additional security checks can be added here
        // - Check against security policies
        // - Validate plugin signature
        // - Check blacklist/whitelist
        
        logger.info("Plugin {} installation approved with permissions: {}", pluginId, requiredPermissions);
        return true;
    }
    
    /**
     * Check if a permission is valid
     * @param permission Permission to check
     * @return true if permission is valid
     */
    public boolean isValidPermission(String permission) {
        return VALID_PERMISSIONS.contains(permission);
    }
    
    /**
     * Check if a plugin has a specific permission
     * @param pluginId Plugin ID
     * @param permission Permission to check
     * @return true if plugin has permission
     */
    public boolean hasPermission(String pluginId, String permission) {
        Set<String> permissions = pluginPermissions.get(pluginId);
        return permissions != null && permissions.contains(permission);
    }
    
    /**
     * Grant permissions to a plugin
     * @param pluginId Plugin ID
     * @param permissions Permissions to grant
     */
    public void grantPermissions(String pluginId, List<String> permissions) {
        Set<String> pluginPerms = pluginPermissions.computeIfAbsent(pluginId, k -> new HashSet<>());
        
        for (String permission : permissions) {
            if (isValidPermission(permission)) {
                pluginPerms.add(permission);
                logger.debug("Granted permission {} to plugin {}", permission, pluginId);
            } else {
                logger.warn("Attempted to grant invalid permission {} to plugin {}", permission, pluginId);
            }
        }
    }
    
    /**
     * Revoke permissions from a plugin
     * @param pluginId Plugin ID
     * @param permissions Permissions to revoke
     */
    public void revokePermissions(String pluginId, List<String> permissions) {
        Set<String> pluginPerms = pluginPermissions.get(pluginId);
        if (pluginPerms != null) {
            for (String permission : permissions) {
                if (pluginPerms.remove(permission)) {
                    logger.debug("Revoked permission {} from plugin {}", permission, pluginId);
                }
            }
        }
    }
    
    /**
     * Revoke all access for a plugin
     * @param pluginId Plugin ID
     */
    public void revokePluginAccess(String pluginId) {
        pluginPermissions.remove(pluginId);
        pluginTokens.remove(pluginId);
        logger.info("Revoked all access for plugin {}", pluginId);
    }
    
    /**
     * Generate a security token for a plugin
     * @param pluginId Plugin ID
     * @return Security token
     */
    public String generatePluginToken(String pluginId) {
        String token = UUID.randomUUID().toString();
        pluginTokens.put(pluginId, token);
        logger.debug("Generated security token for plugin {}", pluginId);
        return token;
    }
    
    /**
     * Validate a plugin security token
     * @param token Token to validate
     * @return Plugin ID if token is valid, null otherwise
     */
    public String validatePluginToken(String token) {
        for (Map.Entry<String, String> entry : pluginTokens.entrySet()) {
            if (entry.getValue().equals(token)) {
                return entry.getKey();
            }
        }
        return null;
    }
    
    /**
     * Check if a plugin token is valid
     * @param token Token to check
     * @return true if token is valid
     */
    public boolean isValidPluginToken(String token) {
        return validatePluginToken(token) != null;
    }
    
    /**
     * Get all permissions for a plugin
     * @param pluginId Plugin ID
     * @return Set of permissions
     */
    public Set<String> getPluginPermissions(String pluginId) {
        return new HashSet<>(pluginPermissions.getOrDefault(pluginId, Collections.emptySet()));
    }
    
    /**
     * Get all valid permissions
     * @return Set of all valid permissions
     */
    public Set<String> getAllValidPermissions() {
        return new HashSet<>(VALID_PERMISSIONS);
    }
    
    /**
     * Check if plugin can access a specific resource
     * @param pluginId Plugin ID
     * @param resourceType Resource type (e.g., "note", "user")
     * @param action Action (e.g., "read", "write")
     * @return true if access is allowed
     */
    public boolean canAccessResource(String pluginId, String resourceType, String action) {
        String permission = resourceType + "." + action;
        return hasPermission(pluginId, permission);
    }
    
    /**
     * Validate plugin API call
     * @param pluginId Plugin ID
     * @param apiEndpoint API endpoint being called
     * @param action HTTP action (GET, POST, etc.)
     * @return true if API call is allowed
     */
    public boolean validateApiCall(String pluginId, String apiEndpoint, String action) {
        // Map API endpoints to required permissions
        Map<String, String> endpointPermissions = Map.of(
            "/api/notes", "notes.read",
            "/api/notes/create", "notes.write",
            "/api/notes/update", "notes.write",
            "/api/notes/delete", "notes.delete",
            "/api/users", "users.read",
            "/api/users/profile", "users.write"
        );
        
        String requiredPermission = endpointPermissions.get(apiEndpoint);
        if (requiredPermission == null) {
            // Default deny for unknown endpoints
            logger.warn("Plugin {} attempted to access unknown endpoint: {}", pluginId, apiEndpoint);
            return false;
        }
        
        boolean hasAccess = hasPermission(pluginId, requiredPermission);
        if (!hasAccess) {
            logger.warn("Plugin {} denied access to {} - missing permission: {}", 
                       pluginId, apiEndpoint, requiredPermission);
        }
        
        return hasAccess;
    }
    
    /**
     * Initialize security manager
     */
    public void initialize() {
        logger.info("Plugin Security Manager initialized with {} valid permissions", VALID_PERMISSIONS.size());
    }
}
