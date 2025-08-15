package com.modulo.plugin.submission;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for plugin submission management
 */
@RestController
@RequestMapping("/api/plugins/submissions")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class PluginSubmissionController {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginSubmissionController.class);
    
    @Autowired
    private PluginSubmissionService submissionService;
    
    /**
     * Submit a new plugin
     */
    @PostMapping
    public ResponseEntity<?> submitPlugin(
            @Valid @RequestPart("submission") PluginSubmissionRequest request,
            @RequestPart(value = "jarFile", required = false) MultipartFile jarFile,
            BindingResult bindingResult) {
        
        logger.info("Received plugin submission request: {}", request.getPluginName());
        
        if (bindingResult.hasErrors()) {
            Map<String, String> errors = new HashMap<>();
            bindingResult.getFieldErrors().forEach(error -> 
                errors.put(error.getField(), error.getDefaultMessage()));
            return ResponseEntity.badRequest().body(Map.of("errors", errors));
        }
        
        if (jarFile == null || jarFile.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "JAR file is required"));
        }
        
        try {
            PluginSubmission submission = submissionService.submitPlugin(request, jarFile);
            return ResponseEntity.status(HttpStatus.CREATED).body(submission);
            
        } catch (Exception e) {
            logger.error("Failed to submit plugin: {}", request.getPluginName(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to submit plugin: " + e.getMessage()));
        }
    }
    
    /**
     * Get submission by ID
     */
    @GetMapping("/{submissionId}")
    public ResponseEntity<?> getSubmission(@PathVariable String submissionId) {
        Optional<PluginSubmission> submission = submissionService.getSubmission(submissionId);
        
        if (submission.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(submission.get());
    }
    
    /**
     * Get submissions by developer
     */
    @GetMapping("/developer/{email}")
    public ResponseEntity<List<PluginSubmission>> getSubmissionsByDeveloper(@PathVariable String email) {
        List<PluginSubmission> submissions = submissionService.getSubmissionsByDeveloper(email);
        return ResponseEntity.ok(submissions);
    }
    
    /**
     * Get all submissions with pagination
     */
    @GetMapping
    public ResponseEntity<Page<PluginSubmission>> getAllSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        
        Pageable pageable = PageRequest.of(page, size);
        Page<PluginSubmission> submissions;
        
        if (status != null && !status.isEmpty()) {
            try {
                SubmissionStatus submissionStatus = SubmissionStatus.valueOf(status.toUpperCase());
                submissions = submissionService.getSubmissionsByStatus(submissionStatus, pageable);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        } else {
            submissions = submissionService.getAllSubmissions(pageable);
        }
        
        return ResponseEntity.ok(submissions);
    }
    
    /**
     * Update submission status (admin only)
     */
    @PutMapping("/{submissionId}/status")
    public ResponseEntity<?> updateSubmissionStatus(
            @PathVariable String submissionId,
            @RequestBody Map<String, String> statusUpdate) {
        
        String newStatusString = statusUpdate.get("status");
        String reviewNotes = statusUpdate.get("reviewNotes");
        
        if (newStatusString == null || newStatusString.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Status is required"));
        }
        
        try {
            SubmissionStatus newStatus = SubmissionStatus.valueOf(newStatusString.toUpperCase());
            PluginSubmission updatedSubmission = submissionService.updateSubmissionStatus(
                    submissionId, newStatus, reviewNotes);
            
            return ResponseEntity.ok(updatedSubmission);
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid status: " + newStatusString));
        } catch (Exception e) {
            logger.error("Failed to update submission status: {}", submissionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update status: " + e.getMessage()));
        }
    }
    
    /**
     * Resubmit a plugin
     */
    @PutMapping("/{submissionId}/resubmit")
    public ResponseEntity<?> resubmitPlugin(
            @PathVariable String submissionId,
            @Valid @RequestPart("submission") PluginSubmissionRequest request,
            @RequestPart(value = "jarFile", required = false) MultipartFile jarFile,
            BindingResult bindingResult) {
        
        logger.info("Received plugin resubmission request: {}", submissionId);
        
        if (bindingResult.hasErrors()) {
            Map<String, String> errors = new HashMap<>();
            bindingResult.getFieldErrors().forEach(error -> 
                errors.put(error.getField(), error.getDefaultMessage()));
            return ResponseEntity.badRequest().body(Map.of("errors", errors));
        }
        
        try {
            PluginSubmission submission = submissionService.resubmitPlugin(submissionId, request, jarFile);
            return ResponseEntity.ok(submission);
            
        } catch (Exception e) {
            logger.error("Failed to resubmit plugin: {}", submissionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to resubmit plugin: " + e.getMessage()));
        }
    }
    
    /**
     * Delete a submission
     */
    @DeleteMapping("/{submissionId}")
    public ResponseEntity<?> deleteSubmission(@PathVariable String submissionId) {
        try {
            submissionService.deleteSubmission(submissionId);
            return ResponseEntity.noContent().build();
            
        } catch (Exception e) {
            logger.error("Failed to delete submission: {}", submissionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete submission: " + e.getMessage()));
        }
    }
    
    /**
     * Get submission statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<PluginSubmissionService.SubmissionStatistics> getSubmissionStatistics() {
        PluginSubmissionService.SubmissionStatistics stats = submissionService.getSubmissionStatistics();
        return ResponseEntity.ok(stats);
    }
    
    /**
     * Get submission status options
     */
    @GetMapping("/status-options")
    public ResponseEntity<Map<String, Object>> getStatusOptions() {
        Map<String, Object> response = new HashMap<>();
        
        // Get all status values
        SubmissionStatus[] statuses = SubmissionStatus.values();
        Map<String, String> statusMap = new HashMap<>();
        
        for (SubmissionStatus status : statuses) {
            statusMap.put(status.name(), status.getDisplayName());
        }
        
        response.put("statuses", statusMap);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "plugin-submission");
        return ResponseEntity.ok(response);
    }
}
