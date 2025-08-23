package com.modulo.controller;

import com.modulo.entity.offline.OfflineNote;
import com.modulo.service.OfflineSyncService;
import com.modulo.util.LogSanitizer;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST Controller for offline note management
 * Provides endpoints for CRUD operations when offline
 */
@RestController
@RequestMapping("/api/offline/notes")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
public class OfflineNoteController {

    private static final Logger log = LoggerFactory.getLogger(OfflineNoteController.class);

    private final OfflineSyncService offlineSyncService;

    /**
     * Create a new note offline
     */
    @PostMapping
    public ResponseEntity<OfflineNote> createNote(@RequestBody OfflineNoteCreateRequest request) {
        try {
            log.info("Creating offline note: {}", LogSanitizer.sanitize(request.getTitle()));
            
            Set<String> tags = request.getTagNames() != null ? 
                new HashSet<>(request.getTagNames()) : new HashSet<>();
                
            OfflineNote note = offlineSyncService.createOfflineNote(
                request.getTitle(), 
                request.getContent(), 
                tags
            );
            
            return ResponseEntity.status(HttpStatus.CREATED).body(note);
        } catch (Exception e) {
            log.error("Error creating offline note", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get all offline notes
     */
    @GetMapping
    public ResponseEntity<List<OfflineNote>> getAllNotes() {
        try {
            List<OfflineNote> notes = offlineSyncService.getAllOfflineNotes();
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            log.error("Error retrieving offline notes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.emptyList());
        }
    }

    /**
     * Update an offline note
     */
    @PutMapping("/{id}")
    public ResponseEntity<OfflineNote> updateNote(@PathVariable Long id, @RequestBody OfflineNoteUpdateRequest request) {
        try {
            log.info("Updating offline note: {}", LogSanitizer.sanitizeId(id));
            
            Set<String> tags = request.getTagNames() != null ? 
                new HashSet<>(request.getTagNames()) : new HashSet<>();
                
            OfflineNote note = offlineSyncService.updateOfflineNote(
                id, 
                request.getTitle(), 
                request.getContent(), 
                tags
            );
            
            return ResponseEntity.ok(note);
        } catch (RuntimeException e) {
            log.error("Error updating offline note: {}", LogSanitizer.sanitizeId(id), e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating offline note: {}", LogSanitizer.sanitizeId(id), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Delete an offline note
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        try {
            log.info("Deleting offline note: {}", LogSanitizer.sanitizeId(id));
            offlineSyncService.deleteOfflineNote(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting offline note: {}", LogSanitizer.sanitizeId(id), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Search offline notes
     */
    @GetMapping("/search")
    public ResponseEntity<List<OfflineNote>> searchNotes(@RequestParam String query) {
        try {
            log.info("Searching offline notes: {}", LogSanitizer.sanitize(query));
            List<OfflineNote> notes = offlineSyncService.searchOfflineNotes(query);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            log.error("Error searching offline notes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.emptyList());
        }
    }

    /**
     * Get notes by tag
     */
    @GetMapping("/tag/{tagName}")
    public ResponseEntity<List<OfflineNote>> getNotesByTag(@PathVariable String tagName) {
        try {
            log.info("Getting offline notes by tag: {}", LogSanitizer.sanitize(tagName));
            List<OfflineNote> notes = offlineSyncService.getOfflineNotesByTag(tagName);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            log.error("Error getting offline notes by tag", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.emptyList());
        }
    }

    /**
     * Get sync status
     */
    @GetMapping("/sync/status")
    public ResponseEntity<OfflineSyncService.SyncStatus> getSyncStatus() {
        try {
            OfflineSyncService.SyncStatus status = offlineSyncService.getSyncStatus();
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            log.error("Error getting sync status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Force sync with server
     */
    @PostMapping("/sync/force")
    public ResponseEntity<Map<String, String>> forceSync() {
        try {
            log.info("Forcing sync with server");
            offlineSyncService.forcSync();
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "Sync initiated successfully");
            response.put("status", "success");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error forcing sync", e);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "Failed to initiate sync");
            response.put("status", "error");
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    // Request DTOs
    public static class OfflineNoteCreateRequest {
        private String title;
        private String content;
        private List<String> tagNames;

        // Getters and setters
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public List<String> getTagNames() { return tagNames; }
        public void setTagNames(List<String> tagNames) { this.tagNames = tagNames; }
    }

    public static class OfflineNoteUpdateRequest {
        private String title;
        private String content;
        private List<String> tagNames;

        // Getters and setters
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public List<String> getTagNames() { return tagNames; }
        public void setTagNames(List<String> tagNames) { this.tagNames = tagNames; }
    }
}
