package com.modulo.plugin.manager;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ServiceLoader;
import java.util.jar.JarFile;

/**
 * Plugin loader for JAR-based plugins
 */
@Component
public class PluginLoader {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginLoader.class);
    
    /**
     * Load a plugin from a JAR file or directory
     * @param pluginPath Path to plugin JAR file or directory
     * @return Loaded plugin instance
     * @throws PluginException if loading fails
     */
    public Plugin loadPlugin(String pluginPath) throws PluginException {
        logger.info("Loading plugin from: {}", pluginPath);
        
        File pluginFile = new File(pluginPath);
        if (!pluginFile.exists()) {
            throw new PluginException("Plugin file not found: " + pluginPath);
        }
        
        try {
            if (pluginFile.isFile() && pluginPath.endsWith(".jar")) {
                return loadJarPlugin(pluginFile);
            } else if (pluginFile.isDirectory()) {
                return loadDirectoryPlugin(pluginFile);
            } else {
                throw new PluginException("Unsupported plugin format: " + pluginPath);
            }
        } catch (Exception e) {
            logger.error("Failed to load plugin from: " + pluginPath, e);
            throw new PluginException("Failed to load plugin", e);
        }
    }
    
    /**
     * Load plugin from JAR file
     */
    private Plugin loadJarPlugin(File jarFile) throws PluginException {
        try {
            // Validate JAR file
            try (JarFile jar = new JarFile(jarFile)) {
                if (jar.getManifest() == null) {
                    throw new PluginException("JAR file missing manifest: " + jarFile.getName());
                }
            }
            
            // Create class loader for the JAR
            URL[] urls = { jarFile.toURI().toURL() };
            URLClassLoader classLoader = new URLClassLoader(urls, getClass().getClassLoader());
            
            // Use ServiceLoader to find Plugin implementations
            ServiceLoader<Plugin> serviceLoader = ServiceLoader.load(Plugin.class, classLoader);
            
            Plugin plugin = null;
            for (Plugin p : serviceLoader) {
                if (plugin != null) {
                    throw new PluginException("Multiple Plugin implementations found in JAR: " + jarFile.getName());
                }
                plugin = p;
            }
            
            if (plugin == null) {
                throw new PluginException("No Plugin implementation found in JAR: " + jarFile.getName());
            }
            
            logger.info("Successfully loaded JAR plugin: {}", plugin.getInfo().getName());
            return plugin;
            
        } catch (Exception e) {
            throw new PluginException("Failed to load JAR plugin: " + jarFile.getName(), e);
        }
    }
    
    /**
     * Load plugin from directory (for development)
     */
    private Plugin loadDirectoryPlugin(File directory) throws PluginException {
        try {
            // Look for compiled classes
            File classesDir = new File(directory, "classes");
            if (!classesDir.exists()) {
                classesDir = directory; // Assume classes are in the root directory
            }
            
            // Create class loader for the directory
            URL[] urls = { classesDir.toURI().toURL() };
            URLClassLoader classLoader = new URLClassLoader(urls, getClass().getClassLoader());
            
            // Use ServiceLoader to find Plugin implementations
            ServiceLoader<Plugin> serviceLoader = ServiceLoader.load(Plugin.class, classLoader);
            
            Plugin plugin = null;
            for (Plugin p : serviceLoader) {
                if (plugin != null) {
                    throw new PluginException("Multiple Plugin implementations found in directory: " + directory.getName());
                }
                plugin = p;
            }
            
            if (plugin == null) {
                throw new PluginException("No Plugin implementation found in directory: " + directory.getName());
            }
            
            logger.info("Successfully loaded directory plugin: {}", plugin.getInfo().getName());
            return plugin;
            
        } catch (Exception e) {
            throw new PluginException("Failed to load directory plugin: " + directory.getName(), e);
        }
    }
    
    /**
     * Validate plugin JAR file
     */
    private void validateJarFile(File jarFile) throws PluginException {
        if (!jarFile.getName().endsWith(".jar")) {
            throw new PluginException("File is not a JAR: " + jarFile.getName());
        }
        
        if (!jarFile.canRead()) {
            throw new PluginException("Cannot read JAR file: " + jarFile.getName());
        }
        
        // Additional validation can be added here
        // - Check for required META-INF/services/com.modulo.plugin.api.Plugin file
        // - Validate plugin manifest
        // - Check for security issues
    }
}
