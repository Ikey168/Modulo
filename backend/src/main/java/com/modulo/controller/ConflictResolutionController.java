package com.modulo.controller;

import com.modulo.dto.ConflictResolutionDto;
import com.modulo.entity.Note;
import com.modulo.service.ConflictResolutionService;
import com.modulo.util.LogSanitizer;
import com.modulo.service.WebSocketNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller for handling edit conflicts and conflict resolution
 */
@RestController
@RequestMapping("/api/conflicts")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class ConflictResolutionController {
    
    private final ConflictResolutionService conflictResolutionService;
    private final WebSocketNotificationService webSocketNotificationService;
    
    /**
     * Check for conflicts before updating a note
     */
    @PostMapping("/check")
    public ResponseEntity<ConflictResolutionDto> checkConflicts(@RequestBody ConflictCheckRequest request) {
        try {
            ConflictResolutionDto conflict = conflictResolutionService.checkForConflicts(
                request.getNoteId(),
                request.getExpectedVersion(),
                request.getTitle(),
                request.getContent(),
                request.getTagNames(),
                request.getEditor()
            );
            
            return ResponseEntity.ok(conflict);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error checking conflicts for note {}", LogSanitizer.sanitizeId(request.getNoteId()), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Update note with conflict checking
     */
    @PutMapping("/update")
    public ResponseEntity<?> updateWithConflictCheck(@RequestBody ConflictUpdateRequest request) {
        try {
            Note updatedNote = conflictResolutionService.updateNoteWithConflictCheck(
                request.getNoteId(),
                request.getExpectedVersion(),
                request.getTitle(),
                request.getContent(),
                request.getMarkdownContent(),
                request.getTagNames(),
                request.getEditor()
            );
            
            // Broadcast successful update
            webSocketNotificationService.broadcastNoteUpdated(
                (long) updatedNote.getId(),
                updatedNote.getTitle(),
                updatedNote.getContent(),
                request.getTagNames(),
                request.getEditor()
            );
            
            return ResponseEntity.ok(updatedNote);
            
        } catch (ObjectOptimisticLockingFailureException e) {
            // Return conflict information
            ConflictResolutionDto conflict = conflictResolutionService.checkForConflicts(
                request.getNoteId(),
                request.getExpectedVersion(),
                request.getTitle(),
                request.getContent(),
                request.getTagNames(),
                request.getEditor()
            );
            
            return ResponseEntity.status(HttpStatus.CONFLICT).body(conflict);
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating note {} with conflict check", LogSanitizer.sanitizeId(request.getNoteId()), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Force update after manual conflict resolution
     */
    @PutMapping("/resolve")
    public ResponseEntity<Note> resolveConflict(@RequestBody ConflictResolveRequest request) {
        try {
            Note updatedNote = conflictResolutionService.forceUpdateNote(
                request.getNoteId(),
                request.getResolvedTitle(),
                request.getResolvedContent(),
                request.getResolvedMarkdownContent(),
                request.getResolvedTagNames(),
                request.getEditor()
            );
            
            // Broadcast conflict resolution
            webSocketNotificationService.broadcastNoteUpdated(
                (long) updatedNote.getId(),
                updatedNote.getTitle(),
                updatedNote.getContent(),
                request.getResolvedTagNames(),
                request.getEditor()
            );
            
            return ResponseEntity.ok(updatedNote);
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error resolving conflict for note {}", LogSanitizer.sanitizeId(request.getNoteId()), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // Request DTOs
    
    public static class ConflictCheckRequest {
        private Long noteId;
        private Long expectedVersion;
        private String title;
        private String content;
        private List<String> tagNames;
        private String editor;
        
        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public Long getExpectedVersion() { return expectedVersion; }
        public void setExpectedVersion(Long expectedVersion) { this.expectedVersion = expectedVersion; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public List<String> getTagNames() { return tagNames; }
        public void setTagNames(List<String> tagNames) { this.tagNames = tagNames; }
        public String getEditor() { return editor; }
        public void setEditor(String editor) { this.editor = editor; }
    }
    
    public static class ConflictUpdateRequest {
        private Long noteId;
        private Long expectedVersion;
        private String title;
        private String content;
        private String markdownContent;
        private List<String> tagNames;
        private String editor;
        
        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public Long getExpectedVersion() { return expectedVersion; }
        public void setExpectedVersion(Long expectedVersion) { this.expectedVersion = expectedVersion; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public String getMarkdownContent() { return markdownContent; }
        public void setMarkdownContent(String markdownContent) { this.markdownContent = markdownContent; }
        public List<String> getTagNames() { return tagNames; }
        public void setTagNames(List<String> tagNames) { this.tagNames = tagNames; }
        public String getEditor() { return editor; }
        public void setEditor(String editor) { this.editor = editor; }
    }
    
    public static class ConflictResolveRequest {
        private Long noteId;
        private String resolvedTitle;
        private String resolvedContent;
        private String resolvedMarkdownContent;
        private List<String> resolvedTagNames;
        private String editor;
        
        // Getters and setters
        public Long getNoteId() { return noteId; }
        public void setNoteId(Long noteId) { this.noteId = noteId; }
        public String getResolvedTitle() { return resolvedTitle; }
        public void setResolvedTitle(String resolvedTitle) { this.resolvedTitle = resolvedTitle; }
        public String getResolvedContent() { return resolvedContent; }
        public void setResolvedContent(String resolvedContent) { this.resolvedContent = resolvedContent; }
        public String getResolvedMarkdownContent() { return resolvedMarkdownContent; }
        public void setResolvedMarkdownContent(String resolvedMarkdownContent) { this.resolvedMarkdownContent = resolvedMarkdownContent; }
        public List<String> getResolvedTagNames() { return resolvedTagNames; }
        public void setResolvedTagNames(List<String> resolvedTagNames) { this.resolvedTagNames = resolvedTagNames; }
        public String getEditor() { return editor; }
        public void setEditor(String editor) { this.editor = editor; }
    }
}
