package com.modulo.controller;

import com.modulo.dto.AttachmentDto;
import com.modulo.dto.AttachmentUploadResponse;
import com.modulo.service.AttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/attachments")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Attachments", description = "File attachment management with Azure Blob Storage")
public class AttachmentController {

    private final AttachmentService attachmentService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a file attachment to a note")
    public ResponseEntity<AttachmentUploadResponse> uploadAttachment(
            @Parameter(description = "File to upload") @RequestParam("file") MultipartFile file,
            @Parameter(description = "Note ID to attach file to") @RequestParam("noteId") Long noteId,
            Authentication authentication) {
        
        try {
            String uploadedBy = authentication.getName();
            AttachmentUploadResponse response = attachmentService.uploadAttachment(file, noteId, uploadedBy);
            
            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            log.error("Error uploading attachment: {}", e.getMessage(), e);
            AttachmentUploadResponse errorResponse = AttachmentUploadResponse.builder()
                    .message("Error uploading file: " + e.getMessage())
                    .success(false)
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    @GetMapping("/note/{noteId}")
    @Operation(summary = "Get all attachments for a note")
    public ResponseEntity<List<AttachmentDto>> getAttachmentsByNoteId(
            @Parameter(description = "Note ID") @PathVariable Long noteId) {
        
        try {
            List<AttachmentDto> attachments = attachmentService.getAttachmentsByNoteId(noteId);
            return ResponseEntity.ok(attachments);
        } catch (Exception e) {
            log.error("Error getting attachments for note {}: {}", noteId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{attachmentId}")
    @Operation(summary = "Get attachment details by ID")
    public ResponseEntity<AttachmentDto> getAttachmentById(
            @Parameter(description = "Attachment ID") @PathVariable Long attachmentId) {
        
        try {
            AttachmentDto attachment = attachmentService.getAttachmentById(attachmentId);
            return ResponseEntity.ok(attachment);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error getting attachment {}: {}", attachmentId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{attachmentId}/download-url")
    @Operation(summary = "Get download URL for attachment (CDN or direct blob URL)")
    public ResponseEntity<String> getDownloadUrl(
            @Parameter(description = "Attachment ID") @PathVariable Long attachmentId) {
        
        try {
            String downloadUrl = attachmentService.getDownloadUrl(attachmentId);
            return ResponseEntity.ok(downloadUrl);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error getting download URL for attachment {}: {}", attachmentId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{attachmentId}")
    @Operation(summary = "Soft delete an attachment (mark as inactive)")
    public ResponseEntity<Void> deleteAttachment(
            @Parameter(description = "Attachment ID") @PathVariable Long attachmentId,
            Authentication authentication) {
        
        try {
            String deletedBy = authentication.getName();
            boolean deleted = attachmentService.deleteAttachment(attachmentId, deletedBy);
            
            if (deleted) {
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting attachment {}: {}", attachmentId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/{attachmentId}/hard")
    @Operation(summary = "Hard delete an attachment (remove from storage and database)")
    public ResponseEntity<Void> hardDeleteAttachment(
            @Parameter(description = "Attachment ID") @PathVariable Long attachmentId,
            Authentication authentication) {
        
        try {
            String deletedBy = authentication.getName();
            boolean deleted = attachmentService.hardDeleteAttachment(attachmentId, deletedBy);
            
            if (deleted) {
                return ResponseEntity.noContent().build();
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error hard deleting attachment {}: {}", attachmentId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/container/ensure")
    @Operation(summary = "Ensure blob container exists (admin operation)")
    public ResponseEntity<String> ensureContainerExists() {
        try {
            attachmentService.ensureContainerExists();
            return ResponseEntity.ok("Container ensured");
        } catch (Exception e) {
            log.error("Error ensuring container exists: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error ensuring container: " + e.getMessage());
        }
    }
}
