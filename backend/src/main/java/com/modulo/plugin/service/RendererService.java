package com.modulo.plugin.service;

import com.modulo.plugin.api.renderer.NoteRenderer;
import com.modulo.plugin.api.renderer.RendererOutput;
import com.modulo.plugin.api.renderer.RendererEventResponse;
import com.modulo.plugin.registry.RendererPluginRegistry;
import com.modulo.entity.Note;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Service for managing note renderer operations
 */
@Service
public class RendererService {
    
    private static final Logger logger = LoggerFactory.getLogger(RendererService.class);
    
    @Autowired
    private RendererPluginRegistry rendererRegistry;
    
    /**
     * Render a note using a specific renderer
     * @param note The note to render
     * @param rendererId The ID of the renderer to use
     * @param options Rendering options
     * @return The rendered output, or null if rendering failed
     */
    public RendererOutput renderNote(Note note, String rendererId, Map<String, Object> options) {
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            if (renderer == null) {
                logger.warn("Renderer not found: {}", rendererId);
                return null;
            }
            
            if (!renderer.canRender(note.getContent(), getNoteType(note))) {
                logger.warn("Renderer {} cannot handle note type {}", rendererId, getNoteType(note));
                return null;
            }
            
            return renderer.render(note.getContent(), getNoteType(note), options != null ? options : new HashMap<>());
            
        } catch (Exception e) {
            logger.error("Failed to render note {} with renderer {}: {}", note.getId(), rendererId, e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Get the default renderer for a note
     * @param note The note
     * @return The best matching renderer, or null if none found
     */
    public NoteRenderer getDefaultRenderer(Note note) {
        List<NoteRenderer> compatibleRenderers = rendererRegistry.getCompatibleRenderers(
            note.getContent(), 
            note.getType()
        );
        
        if (compatibleRenderers.isEmpty()) {
            return null;
        }
        
        // For now, return the first compatible renderer
        // In the future, we could implement priority/preference logic
        return compatibleRenderers.get(0);
    }
    
    /**
     * Get all renderers compatible with a note
     * @param note The note
     * @return List of compatible renderers
     */
    public List<NoteRenderer> getCompatibleRenderers(Note note) {
        return rendererRegistry.getCompatibleRenderers(note.getContent(), getNoteType(note));
    }
    
    /**
     * Handle a renderer event
     * @param rendererId The renderer ID
     * @param eventType The event type
     * @param eventData The event data
     * @param context Additional context
     * @return The event response
     */
    public RendererEventResponse handleRendererEvent(String rendererId, String eventType, 
                                                   Map<String, Object> eventData, 
                                                   Map<String, Object> context) {
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            if (renderer == null) {
                logger.warn("Renderer not found for event handling: {}", rendererId);
                return RendererEventResponse.none();
            }
            
            return renderer.handleEvent(eventType, eventData, context);
            
        } catch (Exception e) {
            logger.error("Failed to handle renderer event for {}: {}", rendererId, e.getMessage(), e);
            return RendererEventResponse.message("Failed to handle event: " + e.getMessage());
        }
    }
    
    /**
     * Get rendering options for a specific renderer
     * @param rendererId The renderer ID
     * @return List of available options
     */
    public List<com.modulo.plugin.api.renderer.RendererOption> getRendererOptions(String rendererId) {
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            if (renderer == null) {
                return new ArrayList<>();
            }
            
            return renderer.getAvailableOptions();
            
        } catch (Exception e) {
            logger.error("Failed to get options for renderer {}: {}", rendererId, e.getMessage(), e);
            return new ArrayList<>();
        }
    }
    
    /**
     * Validate rendering options for a renderer
     * @param rendererId The renderer ID
     * @param options The options to validate
     * @return Map of option name to validation error (empty if all valid)
     */
    public Map<String, String> validateRendererOptions(String rendererId, Map<String, Object> options) {
        Map<String, String> errors = new HashMap<>();
        
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            if (renderer == null) {
                errors.put("renderer", "Renderer not found: " + rendererId);
                return errors;
            }
            
            List<com.modulo.plugin.api.renderer.RendererOption> availableOptions = renderer.getAvailableOptions();
            
            // Validate each provided option
            for (Map.Entry<String, Object> entry : options.entrySet()) {
                String optionName = entry.getKey();
                Object value = entry.getValue();
                
                // Find the option definition
                com.modulo.plugin.api.renderer.RendererOption option = availableOptions.stream()
                    .filter(opt -> opt.getName().equals(optionName))
                    .findFirst()
                    .orElse(null);
                
                if (option == null) {
                    errors.put(optionName, "Unknown option");
                } else if (!option.isValidValue(value)) {
                    errors.put(optionName, "Invalid value for option");
                }
            }
            
            // Check for missing required options
            for (com.modulo.plugin.api.renderer.RendererOption option : availableOptions) {
                if (option.isRequired() && !options.containsKey(option.getName())) {
                    errors.put(option.getName(), "Required option missing");
                }
            }
            
        } catch (Exception e) {
            logger.error("Failed to validate options for renderer {}: {}", rendererId, e.getMessage(), e);
            errors.put("validation", "Validation failed: " + e.getMessage());
        }
        
        return errors;
    }
    
    /**
     * Get renderer statistics
     * @return Map of renderer statistics
     */
    public Map<String, Object> getRendererStatistics() {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            stats.put("totalRenderers", rendererRegistry.getRendererCount());
            stats.put("enabledRenderers", rendererRegistry.getEnabledRenderers().size());
            
            Map<String, Integer> typeCount = new HashMap<>();
            for (NoteRenderer renderer : rendererRegistry.getAllRenderers().values()) {
                String type = renderer.getClass().getSimpleName();
                typeCount.put(type, typeCount.getOrDefault(type, 0) + 1);
            }
            stats.put("rendererTypes", typeCount);
            
        } catch (Exception e) {
            logger.error("Failed to get renderer statistics: {}", e.getMessage(), e);
        }
        
        return stats;
    }
    
    /**
     * Test if a renderer can handle specific content
     * @param rendererId The renderer ID
     * @param content The content to test
     * @param type The content type
     * @return true if the renderer can handle the content
     */
    public boolean canRender(String rendererId, String content, String type) {
        try {
            NoteRenderer renderer = rendererRegistry.getRenderer(rendererId);
            return renderer != null && renderer.canRender(content, type);
        } catch (Exception e) {
            logger.error("Failed to check render capability for {}: {}", rendererId, e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get the type of a note (defaults to markdown if not specified)
     * @param note The note
     * @return The note type
     */
    private String getNoteType(Note note) {
        // For now, assume all notes are markdown
        // In the future, this could be based on note metadata, file extension, or content analysis
        return "markdown";
    }
}
