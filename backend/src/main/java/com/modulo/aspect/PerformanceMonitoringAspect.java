package com.modulo.aspect;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Performance monitoring aspect for API response time tracking
 * Addresses Issue #50: Optimize API Response Times - Performance Monitoring
 */
@Aspect
@Component
public class PerformanceMonitoringAspect {

    private static final Logger logger = LoggerFactory.getLogger(PerformanceMonitoringAspect.class);
    
    // Performance statistics storage
    private final ConcurrentHashMap<String, AtomicLong> totalExecutionTimes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicInteger> executionCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, AtomicLong> maxExecutionTimes = new ConcurrentHashMap<>();
    
    // Thresholds for performance alerting
    private static final long SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second
    private static final long VERY_SLOW_QUERY_THRESHOLD_MS = 5000; // 5 seconds

    /**
     * Monitor all controller methods for API response time tracking
     */
    @Around("execution(* com.modulo.controller.OptimizedNoteController.*(..))")
    public Object monitorOptimizedControllerMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        return monitorExecution(joinPoint, "API");
    }

    /**
     * Monitor service layer methods for business logic performance
     */
    @Around("execution(* com.modulo.service.OptimizedNoteService.*(..))")
    public Object monitorOptimizedServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        return monitorExecution(joinPoint, "SERVICE");
    }

    /**
     * Monitor repository methods for database query performance
     */
    @Around("execution(* com.modulo.repository.jpa.OptimizedNoteRepository.*(..))")
    public Object monitorOptimizedRepositoryMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        return monitorExecution(joinPoint, "REPOSITORY");
    }

    /**
     * Monitor cache operations to track cache effectiveness
     */
    @Around("@annotation(org.springframework.cache.annotation.Cacheable)")
    public Object monitorCacheableOperations(ProceedingJoinPoint joinPoint) throws Throwable {
        return monitorExecution(joinPoint, "CACHE");
    }

    /**
     * Generic monitoring method with comprehensive metrics
     */
    private Object monitorExecution(ProceedingJoinPoint joinPoint, String layer) throws Throwable {
        long startTime = System.currentTimeMillis();
        String methodSignature = joinPoint.getSignature().toShortString();
        String monitoringKey = layer + ":" + methodSignature;
        
        Object result = null;
        boolean success = true;
        Exception exception = null;
        
        try {
            result = joinPoint.proceed();
            return result;
        } catch (Exception e) {
            success = false;
            exception = e;
            throw e;
        } finally {
            long executionTime = System.currentTimeMillis() - startTime;
            
            // Update performance statistics
            updatePerformanceStatistics(monitoringKey, executionTime);
            
            // Log performance information
            logPerformanceMetrics(layer, methodSignature, executionTime, success, exception, joinPoint.getArgs());
            
            // Alert on slow operations
            checkPerformanceThresholds(layer, methodSignature, executionTime);
        }
    }

    /**
     * Update performance statistics for method execution
     */
    private void updatePerformanceStatistics(String key, long executionTime) {
        totalExecutionTimes.computeIfAbsent(key, k -> new AtomicLong(0)).addAndGet(executionTime);
        executionCounts.computeIfAbsent(key, k -> new AtomicInteger(0)).incrementAndGet();
        
        maxExecutionTimes.computeIfAbsent(key, k -> new AtomicLong(0))
                         .updateAndGet(current -> Math.max(current, executionTime));
    }

    /**
     * Log performance metrics with contextual information
     */
    private void logPerformanceMetrics(String layer, String methodSignature, long executionTime, 
                                     boolean success, Exception exception, Object[] args) {
        
        // Log basic performance info
        if (executionTime > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn("[SLOW-{}] {} executed in {}ms - Args: {}", 
                       layer, methodSignature, executionTime, getArgsSummary(args));
        } else {
            logger.debug("[{}] {} executed in {}ms", layer, methodSignature, executionTime);
        }
        
        // Log errors with performance context
        if (!success && exception != null) {
            logger.error("[ERROR-{}] {} failed after {}ms - Error: {}", 
                        layer, methodSignature, executionTime, exception.getMessage());
        }
        
        // Special handling for database operations
        if ("REPOSITORY".equals(layer) && executionTime > 500) {
            logger.info("[DB-SLOW] Database operation {} took {}ms - consider query optimization", 
                       methodSignature, executionTime);
        }
        
        // Cache performance monitoring
        if ("CACHE".equals(layer)) {
            if (executionTime < 50) {
                logger.debug("[CACHE-HIT] Fast cache operation {} in {}ms", methodSignature, executionTime);
            } else {
                logger.info("[CACHE-MISS] Slow cache operation {} in {}ms - potential cache miss", 
                           methodSignature, executionTime);
            }
        }
    }

    /**
     * Check performance thresholds and alert on issues
     */
    private void checkPerformanceThresholds(String layer, String methodSignature, long executionTime) {
        if (executionTime > VERY_SLOW_QUERY_THRESHOLD_MS) {
            logger.error("[CRITICAL-PERFORMANCE] Very slow {} operation: {} took {}ms - IMMEDIATE ATTENTION REQUIRED", 
                        layer, methodSignature, executionTime);
        } else if (executionTime > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn("[PERFORMANCE-WARNING] Slow {} operation: {} took {}ms - optimization recommended", 
                       layer, methodSignature, executionTime);
        }
        
        // API endpoint specific thresholds
        if ("API".equals(layer)) {
            if (executionTime > 2000) { // 2 seconds for API calls
                logger.error("[API-TIMEOUT-RISK] API endpoint {} took {}ms - user experience impacted", 
                           methodSignature, executionTime);
            } else if (executionTime > 500) { // 500ms warning threshold
                logger.warn("[API-SLOW] API endpoint {} took {}ms - response time optimization needed", 
                          methodSignature, executionTime);
            }
        }
    }

    /**
     * Get summary of method arguments for logging
     */
    private String getArgsSummary(Object[] args) {
        if (args == null || args.length == 0) {
            return "none";
        }
        
        StringBuilder summary = new StringBuilder();
        for (int i = 0; i < Math.min(args.length, 3); i++) { // Limit to first 3 args
            if (i > 0) summary.append(", ");
            
            Object arg = args[i];
            if (arg == null) {
                summary.append("null");
            } else if (arg instanceof String) {
                String str = (String) arg;
                summary.append("'").append(str.length() > 20 ? str.substring(0, 20) + "..." : str).append("'");
            } else {
                summary.append(arg.getClass().getSimpleName()).append(":").append(arg.toString());
            }
        }
        
        if (args.length > 3) {
            summary.append(" (+").append(args.length - 3).append(" more)");
        }
        
        return summary.toString();
    }

    /**
     * Get performance statistics for monitoring dashboard
     */
    public PerformanceStatistics getPerformanceStatistics() {
        PerformanceStatistics stats = new PerformanceStatistics();
        
        totalExecutionTimes.forEach((key, totalTime) -> {
            int count = executionCounts.get(key).get();
            long maxTime = maxExecutionTimes.get(key).get();
            double avgTime = totalTime.get() / (double) count;
            
            stats.addMethodStats(key, count, totalTime.get(), avgTime, maxTime);
        });
        
        return stats;
    }

    /**
     * Reset performance statistics (useful for testing)
     */
    public void resetStatistics() {
        totalExecutionTimes.clear();
        executionCounts.clear();
        maxExecutionTimes.clear();
        logger.info("Performance monitoring statistics reset");
    }

    /**
     * Performance statistics data structure
     */
    public static class PerformanceStatistics {
        private final ConcurrentHashMap<String, MethodStatistics> methodStats = new ConcurrentHashMap<>();
        
        public void addMethodStats(String method, int count, long totalTime, double avgTime, long maxTime) {
            methodStats.put(method, new MethodStatistics(count, totalTime, avgTime, maxTime));
        }
        
        public ConcurrentHashMap<String, MethodStatistics> getMethodStats() {
            return methodStats;
        }
        
        public static class MethodStatistics {
            private final int executionCount;
            private final long totalExecutionTime;
            private final double averageExecutionTime;
            private final long maxExecutionTime;
            
            public MethodStatistics(int executionCount, long totalExecutionTime, 
                                  double averageExecutionTime, long maxExecutionTime) {
                this.executionCount = executionCount;
                this.totalExecutionTime = totalExecutionTime;
                this.averageExecutionTime = averageExecutionTime;
                this.maxExecutionTime = maxExecutionTime;
            }
            
            // Getters
            public int getExecutionCount() { return executionCount; }
            public long getTotalExecutionTime() { return totalExecutionTime; }
            public double getAverageExecutionTime() { return averageExecutionTime; }
            public long getMaxExecutionTime() { return maxExecutionTime; }
        }
    }
}
