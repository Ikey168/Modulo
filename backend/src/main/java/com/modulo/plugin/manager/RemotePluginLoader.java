package com.modulo.plugin.manager;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.*;
import java.net.URL;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

/**
 * Remote plugin loader for downloading and loading plugins from remote URLs
 */
@Component
public class RemotePluginLoader {
    
    private static final Logger logger = LoggerFactory.getLogger(RemotePluginLoader.class);
    
    @Autowired
    private PluginLoader pluginLoader;
    
    @Autowired
    private PluginSecurityManager securityManager;
    
    private static final String REMOTE_PLUGIN_CACHE_DIR = "/tmp/remote-plugins";
    private static final long MAX_PLUGIN_SIZE = 50 * 1024 * 1024; // 50MB
    private static final int CONNECTION_TIMEOUT = 30000; // 30 seconds
    private static final int READ_TIMEOUT = 60000; // 60 seconds
    
    /**
     * Download and load a plugin from a remote URL
     * @param remoteUrl URL to download the plugin from
     * @param expectedChecksum Expected SHA-256 checksum for verification (optional)
     * @param config Plugin configuration
     * @return Loaded plugin
     * @throws PluginException if download or loading fails
     */
    public Plugin loadRemotePlugin(String remoteUrl, String expectedChecksum, Map<String, Object> config) 
            throws PluginException {
        logger.info("Loading remote plugin from URL: {}", remoteUrl);
        
        // Validate URL and security constraints
        validateRemoteUrl(remoteUrl);
        
        try {
            // Download plugin to cache directory
            Path cachedPluginPath = downloadPlugin(remoteUrl, expectedChecksum);
            
            // Perform security validation
            securityManager.validateRemotePlugin(cachedPluginPath.toString(), remoteUrl);
            
            // Load the plugin using the existing plugin loader
            Plugin plugin = pluginLoader.loadPlugin(cachedPluginPath.toString());
            
            logger.info("Successfully loaded remote plugin: {} from {}", plugin.getInfo().getName(), remoteUrl);
            return plugin;
            
        } catch (Exception e) {
            throw new PluginException("Failed to load remote plugin from " + remoteUrl, e);
        }
    }
    
    /**
     * Download plugin from remote URL with security checks
     */
    private Path downloadPlugin(String remoteUrl, String expectedChecksum) throws PluginException {
        try {
            // Create cache directory if it doesn't exist
            Path cacheDir = Paths.get(REMOTE_PLUGIN_CACHE_DIR);
            if (!Files.exists(cacheDir)) {
                Files.createDirectories(cacheDir);
            }
            
            // Generate cache file name based on URL hash
            String urlHash = generateUrlHash(remoteUrl);
            String fileName = urlHash + ".jar";
            Path cachedFile = cacheDir.resolve(fileName);
            
            // Check if already cached and valid
            if (Files.exists(cachedFile) && isValidCachedFile(cachedFile, expectedChecksum)) {
                logger.info("Using cached plugin file: {}", cachedFile);
                return cachedFile;
            }
            
            // Download the plugin
            logger.info("Downloading plugin from: {}", remoteUrl);
            URL url = new URL(remoteUrl);
            URLConnection connection = url.openConnection();
            
            // Set timeouts
            connection.setConnectTimeout(CONNECTION_TIMEOUT);
            connection.setReadTimeout(READ_TIMEOUT);
            
            // Set user agent
            connection.setRequestProperty("User-Agent", "Modulo-Plugin-Loader/1.0");
            
            // Check content length
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_PLUGIN_SIZE) {
                throw new PluginException("Plugin size exceeds maximum allowed size: " + contentLength + " bytes");
            }
            
            // Download with progress tracking
            try (InputStream input = connection.getInputStream();
                 OutputStream output = Files.newOutputStream(cachedFile)) {
                
                byte[] buffer = new byte[8192];
                long totalBytesRead = 0;
                int bytesRead;
                
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                    totalBytesRead += bytesRead;
                    
                    // Check size limit during download
                    if (totalBytesRead > MAX_PLUGIN_SIZE) {
                        Files.deleteIfExists(cachedFile);
                        throw new PluginException("Plugin size exceeds maximum allowed size during download");
                    }
                }
                
                logger.info("Downloaded {} bytes to {}", totalBytesRead, cachedFile);
            }
            
            // Verify checksum if provided
            if (expectedChecksum != null && !expectedChecksum.isEmpty()) {
                String actualChecksum = calculateFileChecksum(cachedFile);
                if (!expectedChecksum.equalsIgnoreCase(actualChecksum)) {
                    Files.deleteIfExists(cachedFile);
                    throw new PluginException("Checksum verification failed. Expected: " + expectedChecksum + 
                                           ", Actual: " + actualChecksum);
                }
                logger.info("Checksum verification passed: {}", expectedChecksum);
            }
            
            return cachedFile;
            
        } catch (IOException e) {
            throw new PluginException("Failed to download plugin from " + remoteUrl, e);
        }
    }
    
    /**
     * Validate remote URL for security constraints
     */
    private void validateRemoteUrl(String remoteUrl) throws PluginException {
        if (remoteUrl == null || remoteUrl.trim().isEmpty()) {
            throw new PluginException("Remote URL cannot be null or empty");
        }
        
        try {
            URL url = new URL(remoteUrl);
            String protocol = url.getProtocol().toLowerCase();
            
            // Only allow HTTPS for security
            if (!"https".equals(protocol)) {
                throw new PluginException("Only HTTPS URLs are allowed for remote plugin loading. Got: " + protocol);
            }
            
            // Validate file extension
            String path = url.getPath();
            if (!path.toLowerCase().endsWith(".jar")) {
                throw new PluginException("Remote URL must point to a JAR file. Got: " + path);
            }
            
            // Check for blocked domains/IPs (you can extend this)
            String host = url.getHost().toLowerCase();
            if (isBlockedHost(host)) {
                throw new PluginException("Host is blocked for security reasons: " + host);
            }
            
            logger.debug("Remote URL validation passed: {}", remoteUrl);
            
        } catch (Exception e) {
            throw new PluginException("Invalid remote URL: " + remoteUrl, e);
        }
    }
    
    /**
     * Check if host is in blocked list
     */
    private boolean isBlockedHost(String host) {
        // Block localhost, private IPs, and known malicious domains
        return host.equals("localhost") || 
               host.equals("127.0.0.1") ||
               host.equals("0.0.0.0") ||
               host.startsWith("192.168.") ||
               host.startsWith("10.") ||
               host.startsWith("172.16.") ||
               host.startsWith("172.17.") ||
               host.startsWith("172.18.") ||
               host.startsWith("172.19.") ||
               host.startsWith("172.20.") ||
               host.startsWith("172.21.") ||
               host.startsWith("172.22.") ||
               host.startsWith("172.23.") ||
               host.startsWith("172.24.") ||
               host.startsWith("172.25.") ||
               host.startsWith("172.26.") ||
               host.startsWith("172.27.") ||
               host.startsWith("172.28.") ||
               host.startsWith("172.29.") ||
               host.startsWith("172.30.") ||
               host.startsWith("172.31.");
    }
    
    /**
     * Generate a hash for the URL to use as cache filename
     */
    private String generateUrlHash(String url) throws PluginException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(url.getBytes());
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString().substring(0, 16); // First 16 chars
            
        } catch (NoSuchAlgorithmException e) {
            throw new PluginException("Failed to generate URL hash", e);
        }
    }
    
    /**
     * Calculate SHA-256 checksum of a file
     */
    private String calculateFileChecksum(Path filePath) throws PluginException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            
            try (InputStream inputStream = Files.newInputStream(filePath)) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    digest.update(buffer, 0, bytesRead);
                }
            }
            
            byte[] hash = digest.digest();
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            
            return hexString.toString();
            
        } catch (Exception e) {
            throw new PluginException("Failed to calculate file checksum", e);
        }
    }
    
    /**
     * Check if cached file is valid and matches expected checksum
     */
    private boolean isValidCachedFile(Path cachedFile, String expectedChecksum) {
        try {
            if (!Files.exists(cachedFile) || Files.size(cachedFile) == 0) {
                return false;
            }
            
            // If no checksum provided, assume cached file is valid if it exists
            if (expectedChecksum == null || expectedChecksum.isEmpty()) {
                return true;
            }
            
            // Verify checksum
            String actualChecksum = calculateFileChecksum(cachedFile);
            return expectedChecksum.equalsIgnoreCase(actualChecksum);
            
        } catch (Exception e) {
            logger.warn("Failed to validate cached file: {}", cachedFile, e);
            return false;
        }
    }
    
    /**
     * Clear the plugin cache
     */
    public void clearCache() {
        try {
            Path cacheDir = Paths.get(REMOTE_PLUGIN_CACHE_DIR);
            if (Files.exists(cacheDir)) {
                Files.walk(cacheDir)
                     .filter(Files::isRegularFile)
                     .forEach(file -> {
                         try {
                             Files.delete(file);
                             logger.debug("Deleted cached file: {}", file);
                         } catch (IOException e) {
                             logger.warn("Failed to delete cached file: {}", file, e);
                         }
                     });
                logger.info("Plugin cache cleared");
            }
        } catch (IOException e) {
            logger.error("Failed to clear plugin cache", e);
        }
    }
    
    /**
     * Get cache directory path
     */
    public String getCacheDirectory() {
        return REMOTE_PLUGIN_CACHE_DIR;
    }
}
