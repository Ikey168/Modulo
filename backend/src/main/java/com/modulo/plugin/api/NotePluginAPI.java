package com.modulo.plugin.api;

import com.modulo.entity.Note;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Plugin API for note operations
 * Provides plugins with access to note management functionality
 */
public interface NotePluginAPI {
    
    /**
     * Find a note by ID
     * @param id Note ID
     * @return Optional containing the note if found
     */
    Optional<Note> findById(Long id);
    
    /**
     * Save a note (create or update)
     * @param note Note to save
     * @return Saved note
     */
    Note save(Note note);
    
    /**
     * Delete a note by ID
     * @param id Note ID to delete
     */
    void delete(Long id);
    
    /**
     * Search notes with criteria
     * @param criteria Search criteria
     * @return List of matching notes
     */
    List<Note> search(SearchCriteria criteria);
    
    /**
     * Find notes by user ID
     * @param userId User ID
     * @return List of user's notes
     */
    List<Note> findByUserId(Long userId);
    
    /**
     * Get notes by tag
     * @param tag Tag to search for
     * @return List of notes with the tag
     */
    List<Note> findByTag(String tag);
    
    /**
     * Get note attachments
     * @param noteId Note ID
     * @return List of attachment metadata
     */
    List<AttachmentMetadata> getAttachments(Long noteId);
    
    /**
     * Add custom metadata to a note
     * @param noteId Note ID
     * @param metadata Custom metadata map
     */
    void addMetadata(Long noteId, Map<String, Object> metadata);
    
    /**
     * Get custom metadata for a note
     * @param noteId Note ID
     * @return Custom metadata map
     */
    Map<String, Object> getMetadata(Long noteId);
}
