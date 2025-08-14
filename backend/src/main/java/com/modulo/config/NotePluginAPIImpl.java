package com.modulo.config;

import com.modulo.entity.Note;
import com.modulo.plugin.api.*;
import com.modulo.service.NoteService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Implementation of NotePluginAPI that bridges plugin calls to the NoteService
 */
public class NotePluginAPIImpl implements NotePluginAPI {
    
    private final NoteService noteService;
    
    public NotePluginAPIImpl(NoteService noteService) {
        this.noteService = noteService;
    }
    
    @Override
    public Optional<Note> findById(Long id) {
        try {
            return noteService.findById(id);
        } catch (Exception e) {
            // Log error and return empty - don't expose internal exceptions to plugins
            return Optional.empty();
        }
    }
    
    @Override
    public Note save(Note note) {
        try {
            return noteService.save(note);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save note: " + e.getMessage());
        }
    }
    
    @Override
    public void delete(Long id) {
        try {
            noteService.deleteById(id);
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete note: " + e.getMessage());
        }
    }
    
    @Override
    public List<Note> search(SearchCriteria criteria) {
        try {
            // Convert plugin search criteria to service parameters
            return noteService.searchNotes(
                criteria.getQuery(),
                criteria.getTags(),
                criteria.getUserId(),
                criteria.getLimit(),
                criteria.getOffset()
            );
        } catch (Exception e) {
            throw new RuntimeException("Search failed: " + e.getMessage());
        }
    }
    
    @Override
    public List<Note> findByUserId(Long userId) {
        try {
            return noteService.findByUserId(userId);
        } catch (Exception e) {
            return List.of(); // Return empty list on error
        }
    }
    
    @Override
    public List<Note> findByTag(String tag) {
        try {
            return noteService.findByTag(tag);
        } catch (Exception e) {
            return List.of(); // Return empty list on error
        }
    }
    
    @Override
    public List<AttachmentMetadata> getAttachments(Long noteId) {
        try {
            // Convert internal attachment entities to plugin API format
            return noteService.getAttachments(noteId).stream()
                .map(attachment -> new AttachmentMetadata(
                    attachment.getId(),
                    attachment.getOriginalFilename(),
                    attachment.getContentType(),
                    attachment.getFileSize(),
                    attachment.getBlobUrl()
                ))
                .collect(Collectors.toList());
        } catch (Exception e) {
            return List.of(); // Return empty list on error
        }
    }
    
    @Override
    public void addMetadata(Long noteId, Map<String, Object> metadata) {
        try {
            noteService.addMetadata(noteId, metadata);
        } catch (Exception e) {
            throw new RuntimeException("Failed to add metadata: " + e.getMessage());
        }
    }
    
    @Override
    public Map<String, Object> getMetadata(Long noteId) {
        try {
            return noteService.getMetadata(noteId);
        } catch (Exception e) {
            return Map.of(); // Return empty map on error
        }
    }
    
    /**
     * Get current user ID from security context
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof org.springframework.security.core.userdetails.User) {
            // Extract user ID from principal - implementation depends on your security setup
            return 1L; // Placeholder - implement based on your user details
        }
        return null;
    }
}
