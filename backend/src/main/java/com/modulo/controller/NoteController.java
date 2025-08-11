package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.repository.NoteRepository;
import com.modulo.service.ConflictResolutionService;
import com.modulo.service.TagService;
import com.modulo.service.WebSocketNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notes")
@CrossOrigin(origins = "*")
public class NoteController {

    private final NoteRepository noteRepository;
    private final TagService tagService;
    private final WebSocketNotificationService webSocketNotificationService;
    private final ConflictResolutionService conflictResolutionService;

    @Autowired
    public NoteController(NoteRepository noteRepository, TagService tagService, 
                         WebSocketNotificationService webSocketNotificationService,
                         ConflictResolutionService conflictResolutionService) {
        this.noteRepository = noteRepository;
        this.tagService = tagService;
        this.webSocketNotificationService = webSocketNotificationService;
        this.conflictResolutionService = conflictResolutionService;
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody NoteCreateRequest request) {
        try {
            Note note = new Note(request.getTitle(), request.getContent(), request.getMarkdownContent());
            
            // Handle tags
            if (request.getTagNames() != null && !request.getTagNames().isEmpty()) {
                Set<Tag> tags = request.getTagNames().stream()
                    .map(tagService::createOrGetTag)
                    .collect(Collectors.toSet());
                note.setTags(tags);
            }
            
            Note savedNote = noteRepository.save(note);
            
            // Broadcast the note creation via WebSocket
            List<String> tagNames = savedNote.getTags() != null ? 
                savedNote.getTags().stream().map(Tag::getName).collect(Collectors.toList()) : 
                new ArrayList<>();
            webSocketNotificationService.broadcastNoteCreated(
                savedNote.getId(), 
                savedNote.getTitle(), 
                savedNote.getContent(), 
                tagNames, 
                "current-user" // TODO: Get actual user ID from security context
            );
            
            return ResponseEntity.status(HttpStatus.CREATED).body(savedNote);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping
    public ResponseEntity<List<Note>> getAllNotes() {
        try {
            List<Note> notes = noteRepository.findAllWithTags();
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Collections.emptyList());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Note> getNoteById(@PathVariable Long id) {
        try {
            Optional<Note> note = noteRepository.findById(id);
            return note.map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateNote(@PathVariable Long id, @RequestBody NoteUpdateRequest request) {
        try {
            // If version is provided, use conflict detection
            if (request.getVersion() != null) {
                List<String> tagNames = request.getTagNames() != null ? 
                    new ArrayList<>(request.getTagNames()) : new ArrayList<>();
                
                Note updatedNote = conflictResolutionService.updateNoteWithConflictCheck(
                    id,
                    request.getVersion(),
                    request.getTitle(),
                    request.getContent(),
                    request.getMarkdownContent(),
                    tagNames,
                    request.getEditor() != null ? request.getEditor() : "unknown-user"
                );
                
                // Broadcast the note update via WebSocket
                List<String> finalTagNames = updatedNote.getTags() != null ? 
                    updatedNote.getTags().stream().map(Tag::getName).collect(Collectors.toList()) : 
                    new ArrayList<>();
                webSocketNotificationService.broadcastNoteUpdated(
                    updatedNote.getId(), 
                    updatedNote.getTitle(), 
                    updatedNote.getContent(), 
                    finalTagNames, 
                    request.getEditor() != null ? request.getEditor() : "unknown-user"
                );
                
                return ResponseEntity.ok(updatedNote);
            } else {
                // Fallback to original logic for backward compatibility
                return updateNoteLegacy(id, request);
            }
            
        } catch (ObjectOptimisticLockingFailureException e) {
            // Return conflict information
            List<String> tagNames = request.getTagNames() != null ? 
                new ArrayList<>(request.getTagNames()) : new ArrayList<>();
            
            var conflict = conflictResolutionService.checkForConflicts(
                id,
                request.getVersion(),
                request.getTitle(),
                request.getContent(),
                tagNames,
                request.getEditor() != null ? request.getEditor() : "unknown-user"
            );
            
            return ResponseEntity.status(HttpStatus.CONFLICT).body(conflict);
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    private ResponseEntity<Note> updateNoteLegacy(@PathVariable Long id, @RequestBody NoteUpdateRequest request) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(id);
            if (!noteOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Note note = noteOpt.get();
            if (request.getTitle() != null) {
                note.setTitle(request.getTitle());
            }
            if (request.getContent() != null) {
                note.setContent(request.getContent());
            }
            if (request.getMarkdownContent() != null) {
                note.setMarkdownContent(request.getMarkdownContent());
            }
            if (request.getEditor() != null) {
                note.setLastEditor(request.getEditor());
            }

            // Handle tags update
            if (request.getTagNames() != null) {
                Set<Tag> newTags = request.getTagNames().stream()
                    .map(tagService::createOrGetTag)
                    .collect(Collectors.toSet());
                note.getTags().clear();
                note.setTags(newTags);
            }

            Note savedNote = noteRepository.save(note);
            
            // Broadcast the note update via WebSocket
            List<String> tagNames = savedNote.getTags() != null ? 
                savedNote.getTags().stream().map(Tag::getName).collect(Collectors.toList()) : 
                new ArrayList<>();
            webSocketNotificationService.broadcastNoteUpdated(
                savedNote.getId(), 
                savedNote.getTitle(), 
                savedNote.getContent(), 
                tagNames, 
                request.getEditor() != null ? request.getEditor() : "unknown-user"
            );
            
            return ResponseEntity.ok(savedNote);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long id) {
        try {
            if (!noteRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            
            noteRepository.deleteById(id);
            
            // Broadcast the note deletion via WebSocket
            webSocketNotificationService.broadcastNoteDeleted(
                id, 
                "current-user" // TODO: Get actual user ID from security context
            );
            
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{id}/tags")
    public ResponseEntity<Note> addTagToNote(@PathVariable Long id, @RequestBody TagAddRequest request) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(id);
            if (!noteOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Note note = noteOpt.get();
            Tag tag = tagService.createOrGetTag(request.getTagName());
            note.addTag(tag);
            
            Note savedNote = noteRepository.save(note);
            return ResponseEntity.ok(savedNote);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    public ResponseEntity<Note> removeTagFromNote(@PathVariable Long id, @PathVariable UUID tagId) {
        try {
            Optional<Note> noteOpt = noteRepository.findById(id);
            Optional<Tag> tagOpt = tagService.findById(tagId);
            
            if (!noteOpt.isPresent() || !tagOpt.isPresent()) {
                return ResponseEntity.notFound().build();
            }

            Note note = noteOpt.get();
            Tag tag = tagOpt.get();
            note.removeTag(tag);
            
            Note savedNote = noteRepository.save(note);
            return ResponseEntity.ok(savedNote);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/tag/{tagName}")
    public ResponseEntity<List<Note>> getNotesByTag(@PathVariable String tagName) {
        try {
            List<Note> notes = noteRepository.findByTagName(tagName);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/search")
    public ResponseEntity<List<Note>> searchNotes(@RequestParam String query) {
        try {
            List<Note> notes = noteRepository.findByTitleOrContentContainingIgnoreCase(query);
            return ResponseEntity.ok(notes);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // Request DTOs
    public static class NoteCreateRequest {
        private String title;
        private String content;
        private String markdownContent;
        private Set<String> tagNames;

        // Constructors, getters, and setters
        public NoteCreateRequest() {}

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getMarkdownContent() { return markdownContent; }
        public void setMarkdownContent(String markdownContent) { this.markdownContent = markdownContent; }

        public Set<String> getTagNames() { return tagNames; }
        public void setTagNames(Set<String> tagNames) { this.tagNames = tagNames; }
    }

    public static class NoteUpdateRequest {
        private String title;
        private String content;
        private String markdownContent;
        private Set<String> tagNames;
        private Long version;
        private String editor;

        // Constructors, getters, and setters
        public NoteUpdateRequest() {}

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public String getMarkdownContent() { return markdownContent; }
        public void setMarkdownContent(String markdownContent) { this.markdownContent = markdownContent; }

        public Set<String> getTagNames() { return tagNames; }
        public void setTagNames(Set<String> tagNames) { this.tagNames = tagNames; }
        
        public Long getVersion() { return version; }
        public void setVersion(Long version) { this.version = version; }
        
        public String getEditor() { return editor; }
        public void setEditor(String editor) { this.editor = editor; }
    }

    public static class TagAddRequest {
        private String tagName;

        public TagAddRequest() {}

        public String getTagName() { return tagName; }
        public void setTagName(String tagName) { this.tagName = tagName; }
    }
}