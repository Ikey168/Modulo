package com.modulo.plugin.api;

import com.modulo.entity.Note;
import java.util.List;
import java.util.Map;

/**
 * Extended interface for plugins that provide note processing capabilities
 * This is used by the gRPC plugin service to interact with plugins
 */
public interface NoteProcessorPlugin extends Plugin {
    
    /**
     * Handle note created event
     * @param note The created note
     */
    default void onNoteCreated(Note note) {
        // Default implementation does nothing
    }
    
    /**
     * Handle note updated event
     * @param note The updated note
     */
    default void onNoteUpdated(Note note) {
        // Default implementation does nothing
    }
    
    /**
     * Handle note deleted event
     * @param noteId The ID of the deleted note
     */
    default void onNoteDeleted(Long noteId) {
        // Default implementation does nothing
    }
    
    /**
     * Process a note and return a modified version
     * @param note The note to process
     * @return The processed note
     */
    default Note processNote(Note note) {
        return note; // Default implementation returns note unchanged
    }
    
    /**
     * Analyze content and return insights
     * @param content The content to analyze
     * @return Map of analysis results
     */
    default Map<String, Object> analyzeContent(String content) {
        return Map.of(); // Default implementation returns empty map
    }
    
    /**
     * Extract metadata from content
     * @param content The content to extract metadata from
     * @return Map of extracted metadata
     */
    default Map<String, Object> extractMetadata(String content) {
        return Map.of(); // Default implementation returns empty map
    }
    
    /**
     * Generate tags for content
     * @param content The content to generate tags for
     * @return List of generated tags
     */
    default List<String> generateTags(String content) {
        return List.of(); // Default implementation returns empty list
    }
}
