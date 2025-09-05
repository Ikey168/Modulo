package com.modulo.repository.jpa;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import javax.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Optimized Note Repository for improved API response times
 * Addresses Issue #50: Optimize API Response Times
 */
@Repository
public interface OptimizedNoteRepository extends JpaRepository<Note, Long> {

    /**
     * Find note by ID with optimized fetch strategy
     * Uses query hints for performance optimization
     */
    @Query("SELECT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.id = :id")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Optional<Note> findByIdOptimized(@Param("id") Long id);

    /**
     * Find notes by user ID with pagination and caching
     * Includes eager loading of tags to reduce N+1 queries
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.userId = :userId ORDER BY n.lastViewedAt DESC NULLS LAST, n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Note> findByUserIdOptimized(@Param("userId") Long userId, Pageable pageable);

    /**
     * Find recently accessed notes by user (frequently accessed content)
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.userId = :userId AND n.lastViewedAt IS NOT NULL ORDER BY n.lastViewedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL"),
        @QueryHint(name = "org.hibernate.fetchSize", value = "20")
    })
    List<Note> findRecentlyAccessedByUser(@Param("userId") Long userId, Pageable pageable);

    /**
     * Find notes by tag with optimized loading
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags t WHERE t.name = :tagName ORDER BY n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Note> findByTagNameOptimized(@Param("tagName") String tagName, Pageable pageable);

    /**
     * Full-text search with optimization
     * Uses database-specific text search capabilities
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE " +
           "LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(n.markdownContent) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "ORDER BY " +
           "CASE WHEN LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) THEN 1 " +
           "     WHEN LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')) THEN 2 " +
           "     ELSE 3 END, " +
           "n.lastViewedAt DESC NULLS LAST, n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Note> searchNotesOptimized(@Param("query") String query, Pageable pageable);

    /**
     * Advanced search with multiple criteria
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags t WHERE " +
           "(:query IS NULL OR " +
           " LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           " LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "(:userId IS NULL OR n.userId = :userId) AND " +
           "(:tagName IS NULL OR t.name = :tagName) AND " +
           "(:fromDate IS NULL OR n.updatedAt >= :fromDate) AND " +
           "(:toDate IS NULL OR n.updatedAt <= :toDate) " +
           "ORDER BY n.lastViewedAt DESC NULLS LAST, n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Note> findByAdvancedCriteria(
        @Param("query") String query,
        @Param("userId") Long userId,
        @Param("tagName") String tagName,
        @Param("fromDate") LocalDateTime fromDate,
        @Param("toDate") LocalDateTime toDate,
        Pageable pageable
    );

    /**
     * Get note count by user for dashboard statistics
     */
    @Query("SELECT COUNT(n) FROM Note n WHERE n.userId = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Long countByUserId(@Param("userId") Long userId);

    /**
     * Get recently updated notes for dashboard
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE " +
           "(:userId IS NULL OR n.userId = :userId) AND " +
           "n.updatedAt >= :since " +
           "ORDER BY n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.fetchSize", value = "10")
    })
    List<Note> findRecentlyUpdated(@Param("userId") Long userId, @Param("since") LocalDateTime since, Pageable pageable);

    /**
     * Find notes without content (title only) for quick overview
     */
    @Query("SELECT n.id, n.title, n.updatedAt, n.userId FROM Note n WHERE " +
           "(:userId IS NULL OR n.userId = :userId) " +
           "ORDER BY n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.fetchSize", value = "50")
    })
    List<Object[]> findNoteTitlesOptimized(@Param("userId") Long userId, Pageable pageable);

    /**
     * Update last viewed timestamp efficiently
     */
    @Query("UPDATE Note n SET n.lastViewedAt = CURRENT_TIMESTAMP WHERE n.id = :id")
    void updateLastViewedAt(@Param("id") Long id);

    /**
     * Batch update last viewed for multiple notes
     */
    @Query("UPDATE Note n SET n.lastViewedAt = CURRENT_TIMESTAMP WHERE n.id IN :ids")
    void updateLastViewedAtBatch(@Param("ids") List<Long> ids);

    /**
     * Find public notes with minimal data loading
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.isPublic = true ORDER BY n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Note> findPublicNotesOptimized(Pageable pageable);

    /**
     * Find notes with attachments efficiently
     */
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags LEFT JOIN FETCH n.attachments WHERE " +
           "n.userId = :userId AND SIZE(n.attachments) > 0 ORDER BY n.updatedAt DESC")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Note> findNotesWithAttachments(@Param("userId") Long userId, Pageable pageable);

    /**
     * Get note statistics for analytics
     */
    @Query("SELECT " +
           "COUNT(n) as totalNotes, " +
           "COUNT(CASE WHEN n.updatedAt >= :weekAgo THEN 1 END) as notesThisWeek, " +
           "COUNT(CASE WHEN n.updatedAt >= :monthAgo THEN 1 END) as notesThisMonth, " +
           "COUNT(CASE WHEN n.isPublic = true THEN 1 END) as publicNotes " +
           "FROM Note n WHERE n.userId = :userId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Object[] getNoteStatistics(@Param("userId") Long userId, 
                              @Param("weekAgo") LocalDateTime weekAgo, 
                              @Param("monthAgo") LocalDateTime monthAgo);
}
