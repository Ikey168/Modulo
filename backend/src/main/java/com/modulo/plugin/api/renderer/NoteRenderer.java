package com.modulo.plugin.api.renderer;

import java.util.List;
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
    String getName();

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
     * Get the note types/formats this renderer supports
     * @return List of supported note types (e.g., "markdown", "md", "text")
     */
    List<String> getSupportedNoteTypes();

    /**
     * Check if this renderer can handle the given content
     * @param content The note content to check
     * @param noteType The note type/format
     * @return true if this renderer can render the content
     */
    boolean canRender(String content, String noteType);

    /**
     * Render the note content into a specific format
     * @param content The note content to render
     * @param noteType The note type/format
     * @param options Rendering options (zoom level, theme, etc.)
     * @return Rendered content as HTML, JSON, or other format
     */
    RendererOutput render(String content, String noteType, Map<String, Object> options);

    /**
     * Get the supported rendering options for this renderer
     * @return List of available rendering options
     */
    List<RendererOption> getAvailableOptions();

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
     * @param eventType Type of event (click, hover, edit, etc.)
     * @param eventData Event-specific data
     * @param context Additional context for the event
     * @return Response to the event
     */
    default RendererEventResponse handleEvent(String eventType, Map<String, Object> eventData,
                                              Map<String, Object> context) {
        return RendererEventResponse.message("Event not supported");
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
