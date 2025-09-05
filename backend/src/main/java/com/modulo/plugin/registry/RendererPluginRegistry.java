package com.modulo.plugin.registry;

import com.modulo.plugin.api.renderer.NoteRenderer;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry for managing note renderer plugins
 */
@Component
public class RendererPluginRegistry {
    
    private static final Logger logger = LoggerFactory.getLogger(RendererPluginRegistry.class);
    
    private final Map<String, NoteRenderer> renderers = new ConcurrentHashMap<>();
    private final Map<String, RendererMetadata> metadata = new ConcurrentHashMap<>();
    
    /**
     * Metadata for a registered renderer
     */
    public static class RendererMetadata {
        private final String id;
        private final String name;
        private final String description;
        private final String version;
        private final boolean enabled;
        private final Date registrationTime;
        
        public RendererMetadata(String id, String name, String description, String version, boolean enabled) {
            this.id = id;
            this.name = name;
            this.description = description;
            this.version = version;
            this.enabled = enabled;
            this.registrationTime = new Date();
        }
        
        // Getters
        public String getId() { return id; }
        public String getName() { return name; }
        public String getDescription() { return description; }
        public String getVersion() { return version; }
        public boolean isEnabled() { return enabled; }
        public Date getRegistrationTime() { return registrationTime; }
    }
    
    /**
     * Register a note renderer plugin
     * @param renderer The renderer to register
     * @return true if successfully registered
     */
    public boolean registerRenderer(NoteRenderer renderer) {
        try {
            String id = renderer.getRendererId();
            
            if (id == null || id.trim().isEmpty()) {
                logger.warn("Cannot register renderer with null or empty ID");
                return false;
            }
            
            if (renderers.containsKey(id)) {
                logger.warn("Renderer with ID '{}' already registered", id);
                return false;
            }
            
            // Register the renderer
            renderers.put(id, renderer);
            
            // Create metadata
            RendererMetadata meta = new RendererMetadata(
                id,
                renderer.getName(),
                renderer.getDescription(),
                renderer.getVersion(),
                true
            );
            metadata.put(id, meta);
            
            logger.info("Registered note renderer: {} ({})", renderer.getName(), id);
            return true;
            
        } catch (Exception e) {
            logger.error("Failed to register renderer: {}", e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Unregister a note renderer plugin
     * @param rendererId The ID of the renderer to unregister
     * @return true if successfully unregistered
     */
    public boolean unregisterRenderer(String rendererId) {
        try {
            NoteRenderer renderer = renderers.remove(rendererId);
            metadata.remove(rendererId);
            
            if (renderer != null) {
                logger.info("Unregistered note renderer: {}", rendererId);
                return true;
            } else {
                logger.warn("Attempted to unregister non-existent renderer: {}", rendererId);
                return false;
            }
        } catch (Exception e) {
            logger.error("Failed to unregister renderer {}: {}", rendererId, e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get a renderer by ID
     * @param rendererId The renderer ID
     * @return The renderer, or null if not found
     */
    public NoteRenderer getRenderer(String rendererId) {
        return renderers.get(rendererId);
    }
    
    /**
     * Get all registered renderers
     * @return Map of renderer ID to renderer
     */
    public Map<String, NoteRenderer> getAllRenderers() {
        return new HashMap<>(renderers);
    }
    
    /**
     * Get all enabled renderers
     * @return List of enabled renderers
     */
    public List<NoteRenderer> getEnabledRenderers() {
        return renderers.values().stream()
            .filter(renderer -> {
                RendererMetadata meta = metadata.get(renderer.getRendererId());
                return meta != null && meta.isEnabled();
            })
            .toList();
    }
    
    /**
     * Get renderers that can handle a specific note type
     * @param noteContent The note content
     * @param noteType The note type/format
     * @return List of compatible renderers
     */
    public List<NoteRenderer> getCompatibleRenderers(String noteContent, String noteType) {
        return getEnabledRenderers().stream()
            .filter(renderer -> renderer.canRender(noteContent, noteType))
            .toList();
    }
    
    /**
     * Get renderer metadata
     * @param rendererId The renderer ID
     * @return The metadata, or null if not found
     */
    public RendererMetadata getRendererMetadata(String rendererId) {
        return metadata.get(rendererId);
    }
    
    /**
     * Get all renderer metadata
     * @return Map of renderer ID to metadata
     */
    public Map<String, RendererMetadata> getAllRendererMetadata() {
        return new HashMap<>(metadata);
    }
    
    /**
     * Check if a renderer is registered
     * @param rendererId The renderer ID
     * @return true if registered
     */
    public boolean isRegistered(String rendererId) {
        return renderers.containsKey(rendererId);
    }
    
    /**
     * Get the number of registered renderers
     * @return The count of registered renderers
     */
    public int getRendererCount() {
        return renderers.size();
    }
    
    /**
     * Enable/disable a renderer
     * @param rendererId The renderer ID
     * @param enabled Whether to enable or disable
     * @return true if successfully updated
     */
    public boolean setRendererEnabled(String rendererId, boolean enabled) {
        RendererMetadata currentMeta = metadata.get(rendererId);
        if (currentMeta == null) {
            return false;
        }
        
        RendererMetadata newMeta = new RendererMetadata(
            currentMeta.getId(),
            currentMeta.getName(),
            currentMeta.getDescription(),
            currentMeta.getVersion(),
            enabled
        );
        
        metadata.put(rendererId, newMeta);
        logger.info("Renderer {} {}", rendererId, enabled ? "enabled" : "disabled");
        return true;
    }
    
    /**
     * Clear all registered renderers
     */
    public void clear() {
        renderers.clear();
        metadata.clear();
        logger.info("Cleared all registered renderers");
    }
}
