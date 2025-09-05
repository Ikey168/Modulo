package com.modulo.controller;

import com.modulo.aspect.PerformanceMonitoringAspect;
import com.modulo.config.CacheConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

/**
 * Performance monitoring and metrics controller
 * Addresses Issue #50: Optimize API Response Times - Performance Monitoring
 */
@RestController
@RequestMapping("/api/v2/performance")
@CrossOrigin(origins = "*")
@Tag(name = "Performance Monitoring", description = "API response time monitoring and optimization metrics")
public class PerformanceController {

    private static final Logger logger = LoggerFactory.getLogger(PerformanceController.class);

    @Autowired
    private PerformanceMonitoringAspect performanceMonitoringAspect;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private CacheConfig cacheConfig;

    @Autowired
    private DataSource dataSource;

    /**
     * Get performance statistics for all monitored methods
     */
    @GetMapping("/stats")
    @Operation(summary = "Get performance statistics", 
               description = "Retrieve execution time statistics for all monitored methods")
    public ResponseEntity<Map<String, Object>> getPerformanceStatistics() {
        long startTime = System.currentTimeMillis();
        
        try {
            PerformanceMonitoringAspect.PerformanceStatistics stats = 
                performanceMonitoringAspect.getPerformanceStatistics();
            
            Map<String, Object> response = new HashMap<>();
            response.put("statistics", stats.getMethodStats());
            response.put("collectedAt", System.currentTimeMillis());
            response.put("monitoringDuration", System.currentTimeMillis() - startTime);
            
            // Add summary statistics
            Map<String, Object> summary = new HashMap<>();
            int totalMethods = stats.getMethodStats().size();
            long totalExecutions = stats.getMethodStats().values().stream()
                    .mapToLong(PerformanceMonitoringAspect.PerformanceStatistics.MethodStatistics::getExecutionCount)
                    .sum();
            double avgExecutionTime = stats.getMethodStats().values().stream()
                    .mapToDouble(PerformanceMonitoringAspect.PerformanceStatistics.MethodStatistics::getAverageExecutionTime)
                    .average()
                    .orElse(0.0);
            
            summary.put("totalMonitoredMethods", totalMethods);
            summary.put("totalExecutions", totalExecutions);
            summary.put("averageExecutionTime", avgExecutionTime);
            
            response.put("summary", summary);
            
            long duration = System.currentTimeMillis() - startTime;
            logger.debug("Performance statistics retrieved in {}ms", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error retrieving performance statistics", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get cache statistics and metrics
     */
    @GetMapping("/cache")
    @Operation(summary = "Get cache statistics", 
               description = "Retrieve cache hit/miss ratios and performance metrics")
    public ResponseEntity<Map<String, Object>> getCacheStatistics() {
        long startTime = System.currentTimeMillis();
        
        try {
            Map<String, Object> response = new HashMap<>();
            Map<String, Object> cacheStats = new HashMap<>();
            
            // Get cache names and basic info
            cacheManager.getCacheNames().forEach(cacheName -> {
                org.springframework.cache.Cache cache = cacheManager.getCache(cacheName);
                if (cache != null) {
                    Map<String, Object> cacheInfo = new HashMap<>();
                    cacheInfo.put("name", cacheName);
                    cacheInfo.put("nativeCache", cache.getNativeCache().getClass().getSimpleName());
                    
                    // For ConcurrentMapCache, we can get some basic statistics
                    if (cache.getNativeCache() instanceof java.util.concurrent.ConcurrentMap) {
                        java.util.concurrent.ConcurrentMap<?, ?> nativeCache = 
                            (java.util.concurrent.ConcurrentMap<?, ?>) cache.getNativeCache();
                        cacheInfo.put("size", nativeCache.size());
                        cacheInfo.put("isEmpty", nativeCache.isEmpty());
                    }
                    
                    cacheStats.put(cacheName, cacheInfo);
                }
            });
            
            response.put("caches", cacheStats);
            response.put("cacheManager", cacheManager.getClass().getSimpleName());
            response.put("totalCaches", cacheManager.getCacheNames().size());
            response.put("retrievedAt", System.currentTimeMillis());
            
            long duration = System.currentTimeMillis() - startTime;
            response.put("retrievalTime", duration);
            
            logger.debug("Cache statistics retrieved in {}ms", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error retrieving cache statistics", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get database connection and performance information
     */
    @GetMapping("/database")
    @Operation(summary = "Get database performance info", 
               description = "Retrieve database connection pool and performance metrics")
    public ResponseEntity<Map<String, Object>> getDatabasePerformanceInfo() {
        long startTime = System.currentTimeMillis();
        
        try {
            Map<String, Object> response = new HashMap<>();
            
            // Get database metadata
            try (Connection connection = dataSource.getConnection()) {
                DatabaseMetaData metaData = connection.getMetaData();
                
                Map<String, Object> dbInfo = new HashMap<>();
                dbInfo.put("databaseProduct", metaData.getDatabaseProductName());
                dbInfo.put("databaseVersion", metaData.getDatabaseProductVersion());
                dbInfo.put("driverName", metaData.getDriverName());
                dbInfo.put("driverVersion", metaData.getDriverVersion());
                dbInfo.put("maxConnections", metaData.getMaxConnections());
                dbInfo.put("supportsTransactions", metaData.supportsTransactions());
                
                response.put("database", dbInfo);
                
                // Connection pool information (HikariCP specific)
                if (dataSource.getClass().getName().contains("HikariDataSource")) {
                    try {
                        // Use reflection to get HikariCP statistics if available
                        Object hikariPoolMXBean = dataSource.getClass()
                                .getMethod("getHikariPoolMXBean")
                                .invoke(dataSource);
                        
                        if (hikariPoolMXBean != null) {
                            Map<String, Object> poolInfo = new HashMap<>();
                            poolInfo.put("activeConnections", 
                                hikariPoolMXBean.getClass().getMethod("getActiveConnections").invoke(hikariPoolMXBean));
                            poolInfo.put("idleConnections", 
                                hikariPoolMXBean.getClass().getMethod("getIdleConnections").invoke(hikariPoolMXBean));
                            poolInfo.put("totalConnections", 
                                hikariPoolMXBean.getClass().getMethod("getTotalConnections").invoke(hikariPoolMXBean));
                            poolInfo.put("threadsAwaitingConnection", 
                                hikariPoolMXBean.getClass().getMethod("getThreadsAwaitingConnection").invoke(hikariPoolMXBean));
                            
                            response.put("connectionPool", poolInfo);
                        }
                    } catch (Exception e) {
                        logger.debug("Could not retrieve HikariCP statistics: {}", e.getMessage());
                        response.put("connectionPool", "Statistics not available");
                    }
                }
                
            } catch (SQLException e) {
                logger.warn("Could not retrieve database metadata: {}", e.getMessage());
                response.put("database", "Metadata not available: " + e.getMessage());
            }
            
            response.put("dataSourceClass", dataSource.getClass().getSimpleName());
            
            long duration = System.currentTimeMillis() - startTime;
            response.put("retrievalTime", duration);
            response.put("retrievedAt", System.currentTimeMillis());
            
            logger.debug("Database performance info retrieved in {}ms", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error retrieving database performance info", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Clear all performance statistics
     */
    @DeleteMapping("/stats")
    @Operation(summary = "Reset performance statistics", 
               description = "Clear all performance monitoring statistics")
    public ResponseEntity<String> resetPerformanceStatistics() {
        try {
            performanceMonitoringAspect.resetStatistics();
            logger.info("Performance statistics reset via API");
            return ResponseEntity.ok("Performance statistics reset successfully");
        } catch (Exception e) {
            logger.error("Error resetting performance statistics", e);
            return ResponseEntity.internalServerError().body("Error resetting statistics: " + e.getMessage());
        }
    }

    /**
     * Clear all caches manually
     */
    @DeleteMapping("/cache")
    @Operation(summary = "Clear all caches", 
               description = "Manually clear all application caches")
    public ResponseEntity<String> clearAllCaches() {
        try {
            cacheConfig.evictAllCaches();
            logger.info("All caches cleared via API");
            return ResponseEntity.ok("All caches cleared successfully");
        } catch (Exception e) {
            logger.error("Error clearing caches", e);
            return ResponseEntity.internalServerError().body("Error clearing caches: " + e.getMessage());
        }
    }

    /**
     * Clear specific cache
     */
    @DeleteMapping("/cache/{cacheName}")
    @Operation(summary = "Clear specific cache", 
               description = "Clear a specific cache by name")
    public ResponseEntity<String> clearSpecificCache(@PathVariable String cacheName) {
        try {
            cacheConfig.evictCache(cacheName);
            logger.info("Cache '{}' cleared via API", cacheName);
            return ResponseEntity.ok("Cache '" + cacheName + "' cleared successfully");
        } catch (Exception e) {
            logger.error("Error clearing cache '{}'", cacheName, e);
            return ResponseEntity.internalServerError().body("Error clearing cache: " + e.getMessage());
        }
    }

    /**
     * Get system performance overview
     */
    @GetMapping("/overview")
    @Operation(summary = "Get performance overview", 
               description = "Get comprehensive performance overview including system metrics")
    public ResponseEntity<Map<String, Object>> getPerformanceOverview() {
        long startTime = System.currentTimeMillis();
        
        try {
            Map<String, Object> response = new HashMap<>();
            
            // JVM Memory information
            Runtime runtime = Runtime.getRuntime();
            Map<String, Object> memory = new HashMap<>();
            memory.put("totalMemory", runtime.totalMemory());
            memory.put("freeMemory", runtime.freeMemory());
            memory.put("usedMemory", runtime.totalMemory() - runtime.freeMemory());
            memory.put("maxMemory", runtime.maxMemory());
            memory.put("memoryUsagePercent", 
                ((runtime.totalMemory() - runtime.freeMemory()) * 100.0) / runtime.maxMemory());
            
            response.put("memory", memory);
            
            // System information
            Map<String, Object> system = new HashMap<>();
            system.put("availableProcessors", runtime.availableProcessors());
            system.put("javaVersion", System.getProperty("java.version"));
            system.put("osName", System.getProperty("os.name"));
            system.put("osVersion", System.getProperty("os.version"));
            
            response.put("system", system);
            
            // Performance metrics summary
            PerformanceMonitoringAspect.PerformanceStatistics stats = 
                performanceMonitoringAspect.getPerformanceStatistics();
            
            Map<String, Object> performance = new HashMap<>();
            performance.put("monitoredMethods", stats.getMethodStats().size());
            
            // Calculate aggregated metrics
            long totalExecutions = stats.getMethodStats().values().stream()
                    .mapToLong(PerformanceMonitoringAspect.PerformanceStatistics.MethodStatistics::getExecutionCount)
                    .sum();
            
            double avgExecutionTime = stats.getMethodStats().values().stream()
                    .mapToDouble(PerformanceMonitoringAspect.PerformanceStatistics.MethodStatistics::getAverageExecutionTime)
                    .average()
                    .orElse(0.0);
            
            long maxExecutionTime = stats.getMethodStats().values().stream()
                    .mapToLong(PerformanceMonitoringAspect.PerformanceStatistics.MethodStatistics::getMaxExecutionTime)
                    .max()
                    .orElse(0L);
            
            performance.put("totalExecutions", totalExecutions);
            performance.put("averageExecutionTime", avgExecutionTime);
            performance.put("maxExecutionTime", maxExecutionTime);
            
            response.put("performance", performance);
            
            // Cache overview
            Map<String, Object> cacheOverview = new HashMap<>();
            cacheOverview.put("totalCaches", cacheManager.getCacheNames().size());
            cacheOverview.put("cacheNames", cacheManager.getCacheNames());
            
            response.put("cache", cacheOverview);
            
            long duration = System.currentTimeMillis() - startTime;
            response.put("overviewGenerationTime", duration);
            response.put("timestamp", System.currentTimeMillis());
            
            logger.debug("Performance overview generated in {}ms", duration);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error generating performance overview", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
