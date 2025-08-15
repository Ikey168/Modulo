package com.modulo.plugin.submission;

import com.modulo.plugin.api.PluginException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service for managing plugin submissions
 */
@Service
@Transactional
public class PluginSubmissionService {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginSubmissionService.class);
    
    @Autowired
    private PluginSubmissionRepository submissionRepository;
    
    @Autowired
    private PluginValidationService validationService;
    
    private final String uploadDirectory = "/tmp/plugin-submissions";
    
    /**
     * Submit a new plugin for review
     */
    public PluginSubmission submitPlugin(PluginSubmissionRequest request, MultipartFile jarFile) {
        logger.info("Processing plugin submission: {}", request.getPluginName());
        
        try {
            // Create submission entity
            PluginSubmission submission = createSubmissionFromRequest(request);
            
            // Save JAR file
            if (jarFile != null && !jarFile.isEmpty()) {
                String savedFilePath = saveJarFile(jarFile, submission.getSubmissionId());
                submission.setJarFilePath(savedFilePath);
            }
            
            // Set initial status
            submission.setStatus(SubmissionStatus.PENDING_REVIEW);
            submission.setSubmittedAt(LocalDateTime.now());
            
            // Save submission
            submission = submissionRepository.save(submission);
            
            // Perform validation asynchronously
            performValidation(submission);
            
            logger.info("Plugin submission created with ID: {}", submission.getSubmissionId());
            return submission;
            
        } catch (Exception e) {
            logger.error("Failed to submit plugin: {}", request.getPluginName(), e);
            throw new PluginException("Failed to submit plugin: " + e.getMessage());
        }
    }
    
    /**
     * Get submission by ID
     */
    public Optional<PluginSubmission> getSubmission(String submissionId) {
        return submissionRepository.findById(submissionId);
    }
    
    /**
     * Get submissions by developer email
     */
    public List<PluginSubmission> getSubmissionsByDeveloper(String developerEmail) {
        return submissionRepository.findByDeveloperEmailOrderBySubmittedAtDesc(developerEmail);
    }
    
    /**
     * Get all submissions with pagination
     */
    public Page<PluginSubmission> getAllSubmissions(Pageable pageable) {
        return submissionRepository.findAllByOrderBySubmittedAtDesc(pageable);
    }
    
    /**
     * Get submissions by status
     */
    public Page<PluginSubmission> getSubmissionsByStatus(SubmissionStatus status, Pageable pageable) {
        return submissionRepository.findByStatusOrderBySubmittedAtDesc(status, pageable);
    }
    
    /**
     * Update submission status
     */
    public PluginSubmission updateSubmissionStatus(String submissionId, SubmissionStatus newStatus, String reviewNotes) {
        Optional<PluginSubmission> optionalSubmission = submissionRepository.findById(submissionId);
        
        if (optionalSubmission.isEmpty()) {
            throw new PluginException("Submission not found: " + submissionId);
        }
        
        PluginSubmission submission = optionalSubmission.get();
        
        // Validate status transition
        if (!isValidStatusTransition(submission.getStatus(), newStatus)) {
            throw new PluginException("Invalid status transition from " + 
                                    submission.getStatus() + " to " + newStatus);
        }
        
        // Update status and related fields
        submission.setStatus(newStatus);
        if (reviewNotes != null) {
            submission.setReviewNotes(reviewNotes);
        }
        
        switch (newStatus) {
            case IN_REVIEW:
                submission.setReviewStartedAt(LocalDateTime.now());
                break;
            case APPROVED:
                submission.setApprovedAt(LocalDateTime.now());
                break;
            case REJECTED:
                submission.setRejectedAt(LocalDateTime.now());
                break;
            case PUBLISHED:
                submission.setPublishedAt(LocalDateTime.now());
                break;
        }
        
        submission = submissionRepository.save(submission);
        
        logger.info("Updated submission {} status to {}", submissionId, newStatus);
        return submission;
    }
    
    /**
     * Resubmit a plugin with updated information
     */
    public PluginSubmission resubmitPlugin(String submissionId, PluginSubmissionRequest request, MultipartFile newJarFile) {
        Optional<PluginSubmission> optionalSubmission = submissionRepository.findById(submissionId);
        
        if (optionalSubmission.isEmpty()) {
            throw new PluginException("Submission not found: " + submissionId);
        }
        
        PluginSubmission submission = optionalSubmission.get();
        
        // Only allow resubmission for rejected submissions
        if (submission.getStatus() != SubmissionStatus.REJECTED) {
            throw new PluginException("Can only resubmit rejected submissions");
        }
        
        // Update submission details
        updateSubmissionFromRequest(submission, request);
        
        // Save new JAR file if provided
        if (newJarFile != null && !newJarFile.isEmpty()) {
            try {
                // Delete old file
                if (submission.getJarFilePath() != null) {
                    Files.deleteIfExists(Paths.get(submission.getJarFilePath()));
                }
                
                // Save new file
                String savedFilePath = saveJarFile(newJarFile, submission.getSubmissionId());
                submission.setJarFilePath(savedFilePath);
                
            } catch (IOException e) {
                throw new PluginException("Failed to save new JAR file: " + e.getMessage());
            }
        }
        
        // Reset status and timestamps
        submission.setStatus(SubmissionStatus.PENDING_REVIEW);
        submission.setSubmittedAt(LocalDateTime.now());
        submission.setReviewStartedAt(null);
        submission.setApprovedAt(null);
        submission.setRejectedAt(null);
        submission.setPublishedAt(null);
        submission.setReviewNotes(null);
        submission.setValidationErrors(null);
        submission.setValidationWarnings(null);
        
        submission = submissionRepository.save(submission);
        
        // Perform validation
        performValidation(submission);
        
        logger.info("Resubmitted plugin: {}", submission.getSubmissionId());
        return submission;
    }
    
    /**
     * Delete a submission
     */
    public void deleteSubmission(String submissionId) {
        Optional<PluginSubmission> optionalSubmission = submissionRepository.findById(submissionId);
        
        if (optionalSubmission.isEmpty()) {
            throw new PluginException("Submission not found: " + submissionId);
        }
        
        PluginSubmission submission = optionalSubmission.get();
        
        // Only allow deletion of pending or rejected submissions
        if (submission.getStatus() == SubmissionStatus.PUBLISHED) {
            throw new PluginException("Cannot delete published submissions");
        }
        
        // Delete JAR file
        if (submission.getJarFilePath() != null) {
            try {
                Files.deleteIfExists(Paths.get(submission.getJarFilePath()));
            } catch (IOException e) {
                logger.warn("Failed to delete JAR file: {}", submission.getJarFilePath(), e);
            }
        }
        
        submissionRepository.delete(submission);
        logger.info("Deleted submission: {}", submissionId);
    }
    
    /**
     * Get submission statistics
     */
    public SubmissionStatistics getSubmissionStatistics() {
        SubmissionStatistics stats = new SubmissionStatistics();
        
        stats.setTotalSubmissions(submissionRepository.count());
        stats.setPendingSubmissions(submissionRepository.countByStatus(SubmissionStatus.PENDING_REVIEW));
        stats.setInReviewSubmissions(submissionRepository.countByStatus(SubmissionStatus.IN_REVIEW));
        stats.setApprovedSubmissions(submissionRepository.countByStatus(SubmissionStatus.APPROVED));
        stats.setRejectedSubmissions(submissionRepository.countByStatus(SubmissionStatus.REJECTED));
        stats.setPublishedSubmissions(submissionRepository.countByStatus(SubmissionStatus.PUBLISHED));
        
        return stats;
    }
    
    // Helper methods
    
    private PluginSubmission createSubmissionFromRequest(PluginSubmissionRequest request) {
        PluginSubmission submission = new PluginSubmission();
        submission.setSubmissionId(UUID.randomUUID().toString());
        updateSubmissionFromRequest(submission, request);
        return submission;
    }
    
    private void updateSubmissionFromRequest(PluginSubmission submission, PluginSubmissionRequest request) {
        submission.setPluginName(request.getPluginName());
        submission.setVersion(request.getVersion());
        submission.setDescription(request.getDescription());
        submission.setCategory(request.getCategory());
        submission.setDeveloperName(request.getDeveloperName());
        submission.setDeveloperEmail(request.getDeveloperEmail());
        submission.setHomepageUrl(request.getHomepageUrl());
        submission.setDocumentationUrl(request.getDocumentationUrl());
        submission.setLicenseType(request.getLicenseType());
        submission.setTags(request.getTags());
        submission.setMinPlatformVersion(request.getMinPlatformVersion());
        submission.setMaxPlatformVersion(request.getMaxPlatformVersion());
    }
    
    private String saveJarFile(MultipartFile jarFile, String submissionId) throws IOException {
        // Create upload directory if it doesn't exist
        Path uploadDir = Paths.get(uploadDirectory);
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }
        
        // Generate unique filename
        String originalFilename = jarFile.getOriginalFilename();
        String fileExtension = originalFilename != null && originalFilename.contains(".") ?
                originalFilename.substring(originalFilename.lastIndexOf(".")) : ".jar";
        String filename = submissionId + fileExtension;
        
        Path filePath = uploadDir.resolve(filename);
        
        // Save file
        Files.copy(jarFile.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        
        logger.info("Saved JAR file: {}", filePath.toString());
        return filePath.toString();
    }
    
    private void performValidation(PluginSubmission submission) {
        try {
            ValidationResult result = validationService.validateSubmission(submission);
            
            // Update submission with validation results
            submissionRepository.save(submission);
            
            // If validation passed, move to in-review status
            if (result.isValid()) {
                updateSubmissionStatus(submission.getSubmissionId(), SubmissionStatus.IN_REVIEW, 
                                     "Validation passed, ready for manual review");
            } else {
                updateSubmissionStatus(submission.getSubmissionId(), SubmissionStatus.REJECTED, 
                                     "Validation failed: " + String.join(", ", result.getErrors()));
            }
            
        } catch (Exception e) {
            logger.error("Validation failed for submission: {}", submission.getSubmissionId(), e);
            updateSubmissionStatus(submission.getSubmissionId(), SubmissionStatus.REJECTED, 
                                 "Validation process failed: " + e.getMessage());
        }
    }
    
    private boolean isValidStatusTransition(SubmissionStatus currentStatus, SubmissionStatus newStatus) {
        switch (currentStatus) {
            case PENDING_REVIEW:
                return newStatus == SubmissionStatus.IN_REVIEW || newStatus == SubmissionStatus.REJECTED;
            case IN_REVIEW:
                return newStatus == SubmissionStatus.APPROVED || newStatus == SubmissionStatus.REJECTED;
            case APPROVED:
                return newStatus == SubmissionStatus.PUBLISHED || newStatus == SubmissionStatus.REJECTED;
            case REJECTED:
                return newStatus == SubmissionStatus.PENDING_REVIEW; // For resubmission
            case PUBLISHED:
                return false; // Published submissions cannot be changed
            default:
                return false;
        }
    }
    
    /**
     * Statistics class for submission metrics
     */
    public static class SubmissionStatistics {
        private long totalSubmissions;
        private long pendingSubmissions;
        private long inReviewSubmissions;
        private long approvedSubmissions;
        private long rejectedSubmissions;
        private long publishedSubmissions;
        
        // Getters and setters
        public long getTotalSubmissions() { return totalSubmissions; }
        public void setTotalSubmissions(long totalSubmissions) { this.totalSubmissions = totalSubmissions; }
        
        public long getPendingSubmissions() { return pendingSubmissions; }
        public void setPendingSubmissions(long pendingSubmissions) { this.pendingSubmissions = pendingSubmissions; }
        
        public long getInReviewSubmissions() { return inReviewSubmissions; }
        public void setInReviewSubmissions(long inReviewSubmissions) { this.inReviewSubmissions = inReviewSubmissions; }
        
        public long getApprovedSubmissions() { return approvedSubmissions; }
        public void setApprovedSubmissions(long approvedSubmissions) { this.approvedSubmissions = approvedSubmissions; }
        
        public long getRejectedSubmissions() { return rejectedSubmissions; }
        public void setRejectedSubmissions(long rejectedSubmissions) { this.rejectedSubmissions = rejectedSubmissions; }
        
        public long getPublishedSubmissions() { return publishedSubmissions; }
        public void setPublishedSubmissions(long publishedSubmissions) { this.publishedSubmissions = publishedSubmissions; }
    }
}
