package com.modulo.plugin.manager;

import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
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
     * Validate remote plugin for security compliance
     * @param pluginPath Path to the downloaded plugin
     * @param remoteUrl Original remote URL
     * @throws PluginException if security validation fails
     */
    public void validateRemotePlugin(String pluginPath, String remoteUrl) throws PluginException {
        logger.info("Validating remote plugin security: {} from {}", pluginPath, remoteUrl);
        
        try {
            // Validate file exists and is a valid JAR
            validatePluginFile(pluginPath);
            
            // Validate remote source
            validateRemoteSource(remoteUrl);
            
            // Check for malicious content patterns
            scanForMaliciousContent(pluginPath);
            
            // Validate JAR signature (if present)
            validateJarSignature(pluginPath);
            
            logger.info("Remote plugin security validation passed: {}", pluginPath);
            
        } catch (Exception e) {
            throw new PluginException("Remote plugin security validation failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Validate plugin file integrity
     */
    private void validatePluginFile(String pluginPath) throws PluginException {
        try {
            File pluginFile = new File(pluginPath);
            
            // Check file exists and is readable
            if (!pluginFile.exists() || !pluginFile.canRead()) {
                throw new PluginException("Plugin file does not exist or is not readable: " + pluginPath);
            }
            
            // Check file size (max 50MB for remote plugins)
            long maxSize = 50 * 1024 * 1024; // 50MB
            if (pluginFile.length() > maxSize) {
                throw new PluginException("Plugin file exceeds maximum size limit: " + pluginFile.length() + " bytes");
            }
            
            // Validate JAR file format
            try (java.util.jar.JarFile jarFile = new java.util.jar.JarFile(pluginFile)) {
                // Check for manifest
                if (jarFile.getManifest() == null) {
                    logger.warn("Plugin JAR has no manifest: {}", pluginPath);
                }
                
                // Count entries to detect zip bombs
                int entryCount = 0;
                long totalUncompressedSize = 0;
                java.util.Enumeration<java.util.jar.JarEntry> entries = jarFile.entries();
                
                while (entries.hasMoreElements()) {
                    java.util.jar.JarEntry entry = entries.nextElement();
                    entryCount++;
                    totalUncompressedSize += entry.getSize();
                    
                    // Prevent zip bomb attacks
                    if (entryCount > 10000) {
                        throw new PluginException("Plugin contains too many entries (potential zip bomb): " + entryCount);
                    }
                    
                    if (totalUncompressedSize > 500 * 1024 * 1024) { // 500MB uncompressed
                        throw new PluginException("Plugin uncompressed size too large (potential zip bomb): " + totalUncompressedSize);
                    }
                    
                    // Check for suspicious file paths
                    String entryName = entry.getName();
                    if (entryName.contains("..") || entryName.startsWith("/") || entryName.contains("\\")) {
                        throw new PluginException("Plugin contains suspicious file path: " + entryName);
                    }
                }
                
                logger.debug("Plugin file validation passed: {} entries, {} total size", entryCount, totalUncompressedSize);
            }
            
        } catch (Exception e) {
            throw new PluginException("Plugin file validation failed", e);
        }
    }
    
    /**
     * Validate remote source URL and domain
     */
    private void validateRemoteSource(String remoteUrl) throws PluginException {
        try {
            java.net.URL url = new java.net.URL(remoteUrl);
            String host = url.getHost().toLowerCase();
            
            // Check against whitelist of trusted plugin repositories
            if (!isTrustedPluginSource(host)) {
                logger.warn("Plugin downloaded from untrusted source: {}", host);
                // For now, just log warning. In production, you might want to reject
            }
            
            // Check for suspicious URL patterns
            if (containsSuspiciousPatterns(remoteUrl)) {
                throw new PluginException("Plugin URL contains suspicious patterns: " + remoteUrl);
            }
            
        } catch (java.net.MalformedURLException e) {
            throw new PluginException("Invalid remote URL format", e);
        }
    }
    
    /**
     * Check if the source is in the trusted plugin repositories
     */
    private boolean isTrustedPluginSource(String host) {
        // Define trusted plugin repositories
        Set<String> trustedSources = Set.of(
            "plugins.modulo.com",
            "github.com",
            "maven.apache.org",
            "repo.maven.apache.org",
            "central.sonatype.com"
        );
        
        return trustedSources.contains(host) || 
               trustedSources.stream().anyMatch(trusted -> host.endsWith("." + trusted));
    }
    
    /**
     * Check for suspicious URL patterns
     */
    private boolean containsSuspiciousPatterns(String url) {
        String[] suspiciousPatterns = {
            "javascript:",
            "data:",
            "vbscript:",
            "file:",
            "ftp:"
        };
        
        String lowerUrl = url.toLowerCase();
        for (String pattern : suspiciousPatterns) {
            if (lowerUrl.contains(pattern)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Scan plugin for malicious content patterns
     */
    private void scanForMaliciousContent(String pluginPath) throws PluginException {
        try (java.util.jar.JarFile jarFile = new java.util.jar.JarFile(pluginPath)) {
            java.util.Enumeration<java.util.jar.JarEntry> entries = jarFile.entries();
            
            while (entries.hasMoreElements()) {
                java.util.jar.JarEntry entry = entries.nextElement();
                
                // Skip directories
                if (entry.isDirectory()) {
                    continue;
                }
                
                String entryName = entry.getName().toLowerCase();
                
                // Check for suspicious file types
                if (entryName.endsWith(".exe") || entryName.endsWith(".dll") || 
                    entryName.endsWith(".so") || entryName.endsWith(".dylib") ||
                    entryName.endsWith(".bat") || entryName.endsWith(".sh") ||
                    entryName.endsWith(".ps1") || entryName.endsWith(".cmd")) {
                    throw new PluginException("Plugin contains potentially dangerous file: " + entry.getName());
                }
                
                // For .class files, check for suspicious imports/patterns
                if (entryName.endsWith(".class")) {
                    scanClassFile(jarFile, entry);
                }
            }
            
        } catch (Exception e) {
            throw new PluginException("Malicious content scan failed", e);
        }
    }
    
    /**
     * Scan class files for suspicious patterns
     */
    private void scanClassFile(java.util.jar.JarFile jarFile, java.util.jar.JarEntry entry) throws Exception {
        try (java.io.InputStream inputStream = jarFile.getInputStream(entry)) {
            byte[] classBytes = inputStream.readAllBytes();
            String classContent = new String(classBytes, "UTF-8");
            
            // Check for dangerous API usage patterns
            String[] dangerousPatterns = {
                "Runtime.getRuntime().exec",
                "ProcessBuilder",
                "System.exit",
                "Thread.stop",
                "sun.misc.Unsafe",
                "java.lang.reflect.AccessibleObject.setAccessible",
                "java.net.URLClassLoader",
                "java.io.FileInputStream",
                "java.io.FileOutputStream",
                "java.nio.file.Files.delete"
            };
            
            for (String pattern : dangerousPatterns) {
                if (classContent.contains(pattern)) {
                    logger.warn("Plugin class {} contains potentially dangerous pattern: {}", entry.getName(), pattern);
                    // For now just warn, but you could throw an exception for strict security
                }
            }
        }
    }
    
    /**
     * Validate JAR signature if present
     */
    private void validateJarSignature(String pluginPath) throws PluginException {
        try (java.util.jar.JarFile jarFile = new java.util.jar.JarFile(pluginPath, true)) {
            java.util.Enumeration<java.util.jar.JarEntry> entries = jarFile.entries();
            boolean hasSigned = false;
            
            while (entries.hasMoreElements()) {
                java.util.jar.JarEntry entry = entries.nextElement();
                
                // Skip directories and META-INF files
                if (entry.isDirectory() || entry.getName().startsWith("META-INF/")) {
                    continue;
                }
                
                // Read entry to trigger signature verification
                try (java.io.InputStream inputStream = jarFile.getInputStream(entry)) {
                    byte[] buffer = new byte[8192];
                    while (inputStream.read(buffer) != -1) {
                        // Just read through the stream to trigger verification
                    }
                }
                
                // Check if entry is signed
                if (entry.getCodeSigners() != null) {
                    hasSigned = true;
                    logger.debug("Found signed entry: {}", entry.getName());
                }
            }
            
            if (hasSigned) {
                logger.info("Plugin is digitally signed: {}", pluginPath);
            } else {
                logger.warn("Plugin is not digitally signed: {}", pluginPath);
                // For now just warn, but you could require signatures for remote plugins
            }
            
        } catch (SecurityException e) {
            throw new PluginException("Plugin signature validation failed", e);
        } catch (Exception e) {
            logger.warn("Could not validate plugin signature: {}", e.getMessage());
        }
    }
    
    /**
     * Initialize security manager
     */
    public void initialize() {
        logger.info("Plugin Security Manager initialized with {} valid permissions", VALID_PERMISSIONS.size());
    }
}
