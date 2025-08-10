package com.modulo.controller;

import com.modulo.entity.NoteLink;
import com.modulo.service.NoteLinkService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/note-links")
@CrossOrigin(origins = "*")
public class NoteLinkController {

    private final NoteLinkService noteLinkService;

    @Autowired
    public NoteLinkController(NoteLinkService noteLinkService) {
        this.noteLinkService = noteLinkService;
    }

    /**
     * Create a new link between two notes
     */
    @PostMapping
    public ResponseEntity<NoteLink> createLink(@RequestBody NoteLinkCreateRequest request) {
        try {
            NoteLink link = noteLinkService.createLink(
                request.getSourceNoteId(),
                request.getTargetNoteId(),
                request.getLinkType()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(link);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get all links for a specific note
     */
    @GetMapping("/note/{noteId}")
    public ResponseEntity<List<NoteLink>> getLinksForNote(@PathVariable Long noteId) {
        try {
            List<NoteLink> links = noteLinkService.getLinksForNote(noteId);
            return ResponseEntity.ok(links);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get outgoing links from a note
     */
    @GetMapping("/note/{noteId}/outgoing")
    public ResponseEntity<List<NoteLink>> getOutgoingLinks(@PathVariable Long noteId) {
        try {
            List<NoteLink> links = noteLinkService.getOutgoingLinks(noteId);
            return ResponseEntity.ok(links);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get incoming links to a note
     */
    @GetMapping("/note/{noteId}/incoming")
    public ResponseEntity<List<NoteLink>> getIncomingLinks(@PathVariable Long noteId) {
        try {
            List<NoteLink> links = noteLinkService.getIncomingLinks(noteId);
            return ResponseEntity.ok(links);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get all links of a specific type
     */
    @GetMapping("/type/{linkType}")
    public ResponseEntity<List<NoteLink>> getLinksByType(@PathVariable String linkType) {
        try {
            List<NoteLink> links = noteLinkService.getLinksByType(linkType);
            return ResponseEntity.ok(links);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get all note links
     */
    @GetMapping
    public ResponseEntity<List<NoteLink>> getAllLinks() {
        try {
            List<NoteLink> links = noteLinkService.getAllLinks();
            return ResponseEntity.ok(links);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Get a specific link by ID
     */
    @GetMapping("/{linkId}")
    public ResponseEntity<NoteLink> getLinkById(@PathVariable UUID linkId) {
        try {
            Optional<NoteLink> link = noteLinkService.findById(linkId);
            return link.map(ResponseEntity::ok)
                      .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Update link type
     */
    @PutMapping("/{linkId}")
    public ResponseEntity<NoteLink> updateLinkType(@PathVariable UUID linkId, @RequestBody NoteLinkUpdateRequest request) {
        try {
            NoteLink updatedLink = noteLinkService.updateLinkType(linkId, request.getLinkType());
            return ResponseEntity.ok(updatedLink);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Delete a link
     */
    @DeleteMapping("/{linkId}")
    public ResponseEntity<Void> deleteLink(@PathVariable UUID linkId) {
        try {
            noteLinkService.deleteLink(linkId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Delete all links between two notes
     */
    @DeleteMapping("/between")
    public ResponseEntity<Void> deleteLinksBetweenNotes(@RequestParam Long sourceNoteId, @RequestParam Long targetNoteId) {
        try {
            noteLinkService.deleteAllLinksBetweenNotes(sourceNoteId, targetNoteId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Check if a link exists between two notes
     */
    @GetMapping("/exists")
    public ResponseEntity<Boolean> linkExists(@RequestParam Long sourceNoteId, @RequestParam Long targetNoteId) {
        try {
            boolean exists = noteLinkService.linkExists(sourceNoteId, targetNoteId);
            return ResponseEntity.ok(exists);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // Request DTOs
    public static class NoteLinkCreateRequest {
        private Long sourceNoteId;
        private Long targetNoteId;
        private String linkType;

        public NoteLinkCreateRequest() {}

        public Long getSourceNoteId() { return sourceNoteId; }
        public void setSourceNoteId(Long sourceNoteId) { this.sourceNoteId = sourceNoteId; }

        public Long getTargetNoteId() { return targetNoteId; }
        public void setTargetNoteId(Long targetNoteId) { this.targetNoteId = targetNoteId; }

        public String getLinkType() { return linkType; }
        public void setLinkType(String linkType) { this.linkType = linkType; }
    }

    public static class NoteLinkUpdateRequest {
        private String linkType;

        public NoteLinkUpdateRequest() {}

        public String getLinkType() { return linkType; }
        public void setLinkType(String linkType) { this.linkType = linkType; }
    }
}
