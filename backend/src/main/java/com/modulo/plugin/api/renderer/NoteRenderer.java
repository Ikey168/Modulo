package com.modulo.plugin.api.renderer;

import com.modulo.entity.Note;
import java.util.Map;

/**
 * Plugin interface for custom note renderers
 * Allows plugins to provide custom visualization of notes (mind maps, kanban boards, etc.)
 */
public interface NoteRenderer {
    
    /**
     * Get the unique identifier for this renderer
     * @return Renderer ID (e.g., "mindmap", "kanban", "timeline")
     */
    String getRendererId();
    
    /**
     * Get the display name for this renderer
     * @return Human-readable name (e.g., "Mind Map", "Kanban Board", "Timeline View")
     */
    String getDisplayName();
    
    /**
     * Get the description of what this renderer does
     * @return Description text
     */
    String getDescription();
    
    /**
     * Get the icon class or URL for this renderer
     * @return Icon identifier for UI display
     */
    String getIcon();
    
    /**
     * Check if this renderer can handle the given note
     * @param note The note to check
     * @return true if this renderer can render the note
     */
    boolean canRender(Note note);
    
    /**
     * Render the note content into a specific format
     * @param note The note to render
     * @param options Rendering options (zoom level, theme, etc.)
     * @return Rendered content as HTML, JSON, or other format
     */
    RendererOutput render(Note note, Map<String, Object> options);
    
    /**
     * Get the supported rendering options for this renderer
     * @return Map of option names to their types and default values
     */
    Map<String, RendererOption> getSupportedOptions();
    
    /**
     * Get the MIME types that this renderer outputs
     * @return Array of MIME types (e.g., "text/html", "application/json")
     */
    String[] getOutputTypes();
    
    /**
     * Check if this renderer supports interactive features
     * @return true if the renderer supports user interactions
     */
    boolean isInteractive();
    
    /**
     * Handle interactive events from the rendered view
     * @param note The note being displayed
     * @param eventType Type of event (click, hover, edit, etc.)
     * @param eventData Event-specific data
     * @return Response to the event
     */
    default RendererEventResponse handleEvent(Note note, String eventType, Map<String, Object> eventData) {
        return new RendererEventResponse(false, "Event not supported");
    }
    
    /**
     * Get the version of this renderer
     * @return Version string
     */
    String getVersion();
    
    /**
     * Get the author/creator of this renderer
     * @return Author information
     */
    String getAuthor();
    
    /**
     * Get any dependencies this renderer requires
     * @return Array of dependency identifiers
     */
    default String[] getDependencies() {
        return new String[0];
    }
    
    /**
     * Initialize the renderer with configuration
     * @param config Configuration parameters
     */
    default void initialize(Map<String, Object> config) {
        // Default implementation - no initialization needed
    }
    
    /**
     * Clean up resources when the renderer is unloaded
     */
    default void cleanup() {
        // Default implementation - no cleanup needed
    }
}
