package com.modulo.plugin.submission;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for PluginSubmission entities
 */
@Repository
public interface PluginSubmissionRepository extends JpaRepository<PluginSubmission, String> {
    
    /**
     * Find submissions by developer email
     */
    List<PluginSubmission> findByDeveloperEmailOrderBySubmittedAtDesc(String developerEmail);
    
    /**
     * Find submissions by status
     */
    Page<PluginSubmission> findByStatusOrderBySubmittedAtDesc(SubmissionStatus status, Pageable pageable);
    
    /**
     * Find all submissions ordered by submission date
     */
    Page<PluginSubmission> findAllByOrderBySubmittedAtDesc(Pageable pageable);
    
    /**
     * Count submissions by status
     */
    long countByStatus(SubmissionStatus status);
    
    /**
     * Find submissions by plugin name (case insensitive)
     */
    List<PluginSubmission> findByPluginNameContainingIgnoreCase(String pluginName);
    
    /**
     * Find submissions by category
     */
    List<PluginSubmission> findByCategoryOrderBySubmittedAtDesc(String category);
    
    /**
     * Find submissions submitted within a date range
     */
    @Query("SELECT s FROM PluginSubmission s WHERE s.submittedAt BETWEEN :startDate AND :endDate ORDER BY s.submittedAt DESC")
    List<PluginSubmission> findBySubmittedAtBetween(@Param("startDate") LocalDateTime startDate, 
                                                    @Param("endDate") LocalDateTime endDate);
    
    /**
     * Find submissions that need review (pending or in review for more than specified hours)
     */
    @Query("SELECT s FROM PluginSubmission s WHERE s.status = :pendingStatus OR " +
           "(s.status = :inReviewStatus AND s.reviewStartedAt < :cutoffTime)")
    List<PluginSubmission> findSubmissionsNeedingAttention(@Param("pendingStatus") SubmissionStatus pendingStatus,
                                                           @Param("inReviewStatus") SubmissionStatus inReviewStatus,
                                                           @Param("cutoffTime") LocalDateTime cutoffTime);
    
    /**
     * Find recent submissions by a developer
     */
    @Query("SELECT s FROM PluginSubmission s WHERE s.developerEmail = :email AND s.submittedAt > :since ORDER BY s.submittedAt DESC")
    List<PluginSubmission> findRecentSubmissionsByDeveloper(@Param("email") String email, 
                                                            @Param("since") LocalDateTime since);
    
    /**
     * Find submissions with validation errors
     */
    @Query("SELECT s FROM PluginSubmission s WHERE s.validationErrors IS NOT NULL AND LENGTH(s.validationErrors) > 0")
    List<PluginSubmission> findSubmissionsWithValidationErrors();
    
    /**
     * Find submissions ready for publishing (approved but not published)
     */
    @Query("SELECT s FROM PluginSubmission s WHERE s.status = :approvedStatus ORDER BY s.approvedAt ASC")
    List<PluginSubmission> findSubmissionsReadyForPublishing(@Param("approvedStatus") SubmissionStatus approvedStatus);
}
