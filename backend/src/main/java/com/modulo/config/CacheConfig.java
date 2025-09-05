package com.modulo.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;

/**
 * Cache configuration for optimizing API response times
 * Addresses Issue #50: Optimize API Response Times
 */
@Configuration
@EnableCaching
@EnableScheduling
public class CacheConfig {

    private static final Logger logger = LoggerFactory.getLogger(CacheConfig.class);

    // Cache names for different data types
    public static final String NOTES_CACHE = "notes";
    public static final String NOTES_BY_USER_CACHE = "notesByUser";
    public static final String NOTES_BY_TAG_CACHE = "notesByTag";
    public static final String NOTES_SEARCH_CACHE = "notesSearch";
    public static final String TAGS_CACHE = "tags";
    public static final String USER_CACHE = "users";
    public static final String ATTACHMENTS_CACHE = "attachments";
    public static final String METADATA_CACHE = "metadata";

    /**
     * Configure in-memory cache manager with predefined cache regions
     * In production, this should be replaced with Redis or Hazelcast
     */
    @Bean
    public CacheManager cacheManager() {
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager();
        
        // Pre-create cache regions with specific names
        cacheManager.setCacheNames(Arrays.asList(
            NOTES_CACHE,
            NOTES_BY_USER_CACHE,
            NOTES_BY_TAG_CACHE,
            NOTES_SEARCH_CACHE,
            TAGS_CACHE,
            USER_CACHE,
            ATTACHMENTS_CACHE,
            METADATA_CACHE
        ));
        
        // Allow dynamic cache creation for flexibility
        cacheManager.setAllowNullValues(false);
        
        logger.info("Cache manager initialized with regions: {}", 
                   Arrays.toString(cacheManager.getCacheNames().toArray()));
        
        return cacheManager;
    }

    /**
     * Clear all caches every hour to prevent stale data
     * In production, implement more sophisticated cache invalidation
     */
    @Scheduled(fixedRate = 3600000) // 1 hour in milliseconds
    @CacheEvict(allEntries = true, value = {
        NOTES_CACHE,
        NOTES_BY_USER_CACHE,
        NOTES_BY_TAG_CACHE,
        NOTES_SEARCH_CACHE,
        TAGS_CACHE,
        USER_CACHE,
        ATTACHMENTS_CACHE,
        METADATA_CACHE
    })
    public void clearAllCaches() {
        logger.info("Scheduled cache clearance completed");
    }

    /**
     * Clear frequently accessed caches more often
     */
    @Scheduled(fixedRate = 900000) // 15 minutes
    @CacheEvict(allEntries = true, value = {
        NOTES_SEARCH_CACHE
    })
    public void clearSearchCache() {
        logger.debug("Search cache cleared");
    }

    /**
     * Manual cache eviction endpoint (can be called via management endpoint)
     */
    @CacheEvict(allEntries = true, value = {
        NOTES_CACHE,
        NOTES_BY_USER_CACHE,
        NOTES_BY_TAG_CACHE,
        NOTES_SEARCH_CACHE,
        TAGS_CACHE,
        USER_CACHE,
        ATTACHMENTS_CACHE,
        METADATA_CACHE
    })
    public void evictAllCaches() {
        logger.info("Manual cache eviction triggered");
    }

    /**
     * Evict specific cache by name
     */
    public void evictCache(String cacheName) {
        CacheManager cm = cacheManager();
        if (cm.getCache(cacheName) != null) {
            cm.getCache(cacheName).clear();
            logger.info("Cache '{}' evicted manually", cacheName);
        }
    }
}
