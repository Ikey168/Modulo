package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.service.OptimizedNoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Optimized Note Controller for improved API response times
 * Addresses Issue #50: Optimize API Response Times
 */
@RestController
@RequestMapping("/api/v2/notes")
@CrossOrigin(origins = "*")
@Tag(name = "Optimized Notes API", description = "High-performance note operations with caching")
public class OptimizedNoteController {

    private static final Logger logger = LoggerFactory.getLogger(OptimizedNoteController.class);

    @Autowired
    private OptimizedNoteService noteService;

    // Cache control settings
    private final CacheControl shortCache = CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic();
    private final CacheControl longCache = CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic();
    private final CacheControl noCache = CacheControl.noCache();

    /**
     * Get note by ID with optimized caching
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get note by ID", description = "Retrieve a specific note with optimized caching")
    @ApiResponse(responseCode = "200", description = "Note retrieved successfully")
    @ApiResponse(responseCode = "404", description = "Note not found")
    public ResponseEntity<Note> getNoteById(
            @Parameter(description = "Note ID") @PathVariable Long id) {
        
        long startTime = System.currentTimeMillis();
        
        return noteService.findById(id)
                .map(note -> {
                    long duration = System.currentTimeMillis() - startTime;
                    logger.debug("Note {} retrieved in {}ms", id, duration);
                    
                    return ResponseEntity.ok()
                            .cacheControl(shortCache)
                            .body(note);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get notes by user with pagination and caching
     */
    @GetMapping("/user/{userId}")
    @Operation(summary = "Get user notes", description = "Retrieve notes for a specific user with pagination")
    public ResponseEntity<Page<Note>> getUserNotes(
            @Parameter(description = "User ID") @PathVariable Long userId,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size,
            @Parameter(description = "Sort by field") @RequestParam(defaultValue = "updatedAt") String sortBy) {
        
        long startTime = System.currentTimeMillis();
        
        // Validate parameters
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100); // Limit max size to 100
        
        Page<Note> notes = noteService.findByUserId(userId, page, size, sortBy);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("User {} notes retrieved in {}ms (page: {}, size: {})", userId, duration, page, size);
        
        return ResponseEntity.ok()
                .cacheControl(shortCache)
                .body(notes);
    }

    /**
     * Get recently accessed notes (highly cached for dashboard)
     */
    @GetMapping("/user/{userId}/recent")
    @Operation(summary = "Get recently accessed notes", description = "Retrieve user's recently accessed notes")
    public ResponseEntity<List<Note>> getRecentlyAccessedNotes(
            @Parameter(description = "User ID") @PathVariable Long userId) {
        
        long startTime = System.currentTimeMillis();
        
        List<Note> notes = noteService.findRecentlyAccessedByUser(userId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Recent notes for user {} retrieved in {}ms", userId, duration);
        
        return ResponseEntity.ok()
                .cacheControl(longCache) // Cache longer as this is dashboard data
                .body(notes);
    }

    /**
     * Search notes with caching
     */
    @GetMapping("/search")
    @Operation(summary = "Search notes", description = "Search notes by query with optimized caching")
    public ResponseEntity<Page<Note>> searchNotes(
            @Parameter(description = "Search query") @RequestParam String q,
            @Parameter(description = "Page number") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size) {
        
        long startTime = System.currentTimeMillis();
        
        if (q == null || q.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 50); // Smaller limit for search
        
        Page<Note> results = noteService.searchNotes(q, page, size);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Search '{}' completed in {}ms (results: {})", q, duration, results.getTotalElements());
        
        return ResponseEntity.ok()
                .cacheControl(shortCache)
                .body(results);
    }

    /**
     * Advanced search with multiple criteria
     */
    @GetMapping("/search/advanced")
    @Operation(summary = "Advanced search", description = "Advanced search with multiple criteria")
    public ResponseEntity<Page<Note>> advancedSearch(
            @Parameter(description = "Search query") @RequestParam(required = false) String q,
            @Parameter(description = "User ID") @RequestParam(required = false) Long userId,
            @Parameter(description = "Tag name") @RequestParam(required = false) String tag,
            @Parameter(description = "From date") @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @Parameter(description = "To date") @RequestParam(required = false) 
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @Parameter(description = "Page number") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size) {
        
        long startTime = System.currentTimeMillis();
        
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 50);
        
        Page<Note> results = noteService.advancedSearch(q, userId, tag, from, to, page, size);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Advanced search completed in {}ms", duration);
        
        return ResponseEntity.ok()
                .cacheControl(shortCache)
                .body(results);
    }

    /**
     * Get notes by tag with caching
     */
    @GetMapping("/tag/{tagName}")
    @Operation(summary = "Get notes by tag", description = "Retrieve notes filtered by tag")
    public ResponseEntity<Page<Note>> getNotesByTag(
            @Parameter(description = "Tag name") @PathVariable String tagName,
            @Parameter(description = "Page number") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "20") int size) {
        
        long startTime = System.currentTimeMillis();
        
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 100);
        
        Page<Note> notes = noteService.findByTag(tagName, page, size);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Notes by tag '{}' retrieved in {}ms", tagName, duration);
        
        return ResponseEntity.ok()
                .cacheControl(shortCache)
                .body(notes);
    }

    /**
     * Get user note statistics (highly cached)
     */
    @GetMapping("/user/{userId}/stats")
    @Operation(summary = "Get user statistics", description = "Get note statistics for a user")
    public ResponseEntity<Map<String, Object>> getUserStatistics(
            @Parameter(description = "User ID") @PathVariable Long userId) {
        
        long startTime = System.currentTimeMillis();
        
        Map<String, Object> stats = noteService.getUserNoteStatistics(userId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("User {} statistics retrieved in {}ms", userId, duration);
        
        return ResponseEntity.ok()
                .cacheControl(longCache) // Cache statistics longer
                .body(stats);
    }

    /**
     * Get note count for user
     */
    @GetMapping("/user/{userId}/count")
    @Operation(summary = "Get note count", description = "Get total note count for a user")
    public ResponseEntity<Long> getUserNoteCount(
            @Parameter(description = "User ID") @PathVariable Long userId) {
        
        long startTime = System.currentTimeMillis();
        
        Long count = noteService.getNoteCountByUser(userId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("User {} note count retrieved in {}ms", userId, duration);
        
        return ResponseEntity.ok()
                .cacheControl(longCache)
                .body(count);
    }

    /**
     * Get recently updated notes for dashboard
     */
    @GetMapping("/recent")
    @Operation(summary = "Get recent updates", description = "Get recently updated notes")
    public ResponseEntity<List<Note>> getRecentlyUpdatedNotes(
            @Parameter(description = "User ID (optional)") @RequestParam(required = false) Long userId,
            @Parameter(description = "Limit") @RequestParam(defaultValue = "10") int limit) {
        
        long startTime = System.currentTimeMillis();
        
        limit = Math.min(Math.max(1, limit), 20);
        List<Note> notes = noteService.getRecentlyUpdatedNotes(userId, limit);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Recent updates retrieved in {}ms", duration);
        
        return ResponseEntity.ok()
                .cacheControl(shortCache)
                .body(notes);
    }

    /**
     * Get note titles only (lightweight endpoint for overviews)
     */
    @GetMapping("/titles")
    @Operation(summary = "Get note titles", description = "Get note titles only for quick overview")
    public ResponseEntity<List<Map<String, Object>>> getNoteTitles(
            @Parameter(description = "User ID (optional)") @RequestParam(required = false) Long userId,
            @Parameter(description = "Limit") @RequestParam(defaultValue = "50") int limit) {
        
        long startTime = System.currentTimeMillis();
        
        limit = Math.min(Math.max(1, limit), 100);
        List<Map<String, Object>> titles = noteService.getNoteTitles(userId, limit);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.debug("Note titles retrieved in {}ms", duration);
        
        return ResponseEntity.ok()
                .cacheControl(longCache)
                .body(titles);
    }

    /**
     * Warm up cache for user (admin endpoint)
     */
    @PostMapping("/user/{userId}/cache/warmup")
    @Operation(summary = "Warm up cache", description = "Pre-load frequently accessed data into cache")
    public ResponseEntity<String> warmUpUserCache(
            @Parameter(description = "User ID") @PathVariable Long userId) {
        
        long startTime = System.currentTimeMillis();
        
        noteService.warmUpCache(userId);
        
        long duration = System.currentTimeMillis() - startTime;
        logger.info("Cache warm-up for user {} completed in {}ms", userId, duration);
        
        return ResponseEntity.ok()
                .cacheControl(noCache)
                .body("Cache warm-up completed in " + duration + "ms");
    }

    /**
     * Clear user cache (admin endpoint)
     */
    @DeleteMapping("/user/{userId}/cache")
    @Operation(summary = "Clear user cache", description = "Clear all cached data for a user")
    public ResponseEntity<String> clearUserCache(
            @Parameter(description = "User ID") @PathVariable Long userId) {
        
        noteService.evictUserCaches(userId);
        
        logger.info("Cache cleared for user {}", userId);
        
        return ResponseEntity.ok()
                .cacheControl(noCache)
                .body("User cache cleared successfully");
    }
}
