package com.modulo.controller;

import com.modulo.service.NetworkDetectionService;
import com.modulo.service.OfflineSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.HashMap;
import java.util.Map;

/**
 * Enhanced health controller for synthetic monitoring and uptime checks
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

    @Autowired(required = false)
    private DataSource dataSource;

    @Autowired(required = false)
    private NetworkDetectionService networkDetectionService;

    @Autowired(required = false)
    private OfflineSyncService offlineSyncService;

    /**
     * Simple health check for basic uptime monitoring
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Basic application health
            response.put("status", "UP");
            response.put("application", "modulo");
            response.put("timestamp", System.currentTimeMillis());
            response.put("version", "1.0.0");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Health check failed", e);
            response.put("status", "DOWN");
            response.put("error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }
    }

    /**
     * Comprehensive health check for synthetic monitoring
     */
    @GetMapping("/detailed")
    public ResponseEntity<Map<String, Object>> detailedHealth() {
        Map<String, Object> response = new HashMap<>();
        Map<String, Object> checks = new HashMap<>();
        boolean overallHealthy = true;
        
        try {
            // Database connectivity check
            Map<String, Object> dbCheck = checkDatabaseHealth();
            checks.put("database", dbCheck);
            if (!"UP".equals(dbCheck.get("status"))) {
                overallHealthy = false;
            }

            // Network service check
            Map<String, Object> networkCheck = checkNetworkServiceHealth();
            checks.put("network", networkCheck);
            if (!"UP".equals(networkCheck.get("status"))) {
                overallHealthy = false;
            }

            // Sync service check
            Map<String, Object> syncCheck = checkSyncServiceHealth();
            checks.put("sync", syncCheck);
            if (!"UP".equals(syncCheck.get("status"))) {
                overallHealthy = false;
            }

            // Memory check
            Map<String, Object> memoryCheck = checkMemoryHealth();
            checks.put("memory", memoryCheck);
            if (!"UP".equals(memoryCheck.get("status"))) {
                overallHealthy = false;
            }

            response.put("status", overallHealthy ? "UP" : "DOWN");
            response.put("application", "modulo");
            response.put("timestamp", System.currentTimeMillis());
            response.put("version", "1.0.0");
            response.put("checks", checks);
            
            return ResponseEntity.status(overallHealthy ? 200 : 503).body(response);
            
        } catch (Exception e) {
            logger.error("Detailed health check failed", e);
            response.put("status", "DOWN");
            response.put("error", e.getMessage());
            response.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.status(503).body(response);
        }
    }

    /**
     * Readiness probe endpoint - checks if app is ready to serve traffic
     */
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            boolean ready = true;
            Map<String, String> checks = new HashMap<>();
            
            // Database readiness
            if (dataSource != null) {
                try (Connection connection = dataSource.getConnection()) {
                    if (connection.isValid(2)) {
                        checks.put("database", "ready");
                    } else {
                        checks.put("database", "not_ready");
                        ready = false;
                    }
                } catch (Exception e) {
                    checks.put("database", "error: " + e.getMessage());
                    ready = false;
                }
            } else {
                checks.put("database", "not_configured");
            }
            
            response.put("status", ready ? "UP" : "DOWN");
            response.put("ready", ready);
            response.put("checks", checks);
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.status(ready ? 200 : 503).body(response);
            
        } catch (Exception e) {
            logger.error("Readiness check failed", e);
            response.put("status", "DOWN");
            response.put("ready", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }
    }

    /**
     * Liveness probe endpoint - checks if app is alive
     */
    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Simple liveness check - if we can respond, we're alive
            response.put("status", "UP");
            response.put("alive", true);
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Liveness check failed", e);
            response.put("status", "DOWN");
            response.put("alive", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }
    }

    /**
     * Uptime information for monitoring
     */
    @GetMapping("/uptime")
    public ResponseEntity<Map<String, Object>> uptime() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            long uptimeMs = System.currentTimeMillis() - getApplicationStartTime();
            
            response.put("status", "UP");
            response.put("uptime_ms", uptimeMs);
            response.put("uptime_seconds", uptimeMs / 1000);
            response.put("uptime_minutes", uptimeMs / (1000 * 60));
            response.put("uptime_hours", uptimeMs / (1000 * 60 * 60));
            response.put("start_time", getApplicationStartTime());
            response.put("current_time", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Uptime check failed", e);
            response.put("status", "DOWN");
            response.put("error", e.getMessage());
            return ResponseEntity.status(503).body(response);
        }
    }

    // Helper methods for health checks

    private Map<String, Object> checkDatabaseHealth() {
        Map<String, Object> check = new HashMap<>();
        
        if (dataSource == null) {
            check.put("status", "UP");
            check.put("message", "No database configured");
            return check;
        }
        
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(5);
            check.put("status", valid ? "UP" : "DOWN");
            check.put("message", valid ? "Database connection healthy" : "Database connection invalid");
            check.put("driver", connection.getMetaData().getDriverName());
            check.put("url", connection.getMetaData().getURL().replaceAll("password=[^&]*", "password=***"));
            
        } catch (Exception e) {
            check.put("status", "DOWN");
            check.put("message", "Database connection failed: " + e.getMessage());
        }
        
        return check;
    }

    private Map<String, Object> checkNetworkServiceHealth() {
        Map<String, Object> check = new HashMap<>();
        
        try {
            if (networkDetectionService != null) {
                boolean online = networkDetectionService.isOnline();
                check.put("status", "UP");
                check.put("online", online);
                check.put("message", online ? "Network service operational" : "Network service reports offline");
            } else {
                check.put("status", "UP");
                check.put("message", "Network service not configured");
            }
        } catch (Exception e) {
            check.put("status", "DOWN");
            check.put("message", "Network service check failed: " + e.getMessage());
        }
        
        return check;
    }

    private Map<String, Object> checkSyncServiceHealth() {
        Map<String, Object> check = new HashMap<>();
        
        try {
            if (offlineSyncService != null) {
                check.put("status", "UP");
                check.put("message", "Sync service available");
                // Add sync-specific health metrics if available
            } else {
                check.put("status", "UP");
                check.put("message", "Sync service not configured");
            }
        } catch (Exception e) {
            check.put("status", "DOWN");
            check.put("message", "Sync service check failed: " + e.getMessage());
        }
        
        return check;
    }

    private Map<String, Object> checkMemoryHealth() {
        Map<String, Object> check = new HashMap<>();
        
        try {
            Runtime runtime = Runtime.getRuntime();
            long maxMemory = runtime.maxMemory();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            
            double memoryUsagePercent = (double) usedMemory / maxMemory * 100;
            
            check.put("status", memoryUsagePercent < 90 ? "UP" : "WARNING");
            check.put("used_memory_mb", usedMemory / (1024 * 1024));
            check.put("max_memory_mb", maxMemory / (1024 * 1024));
            check.put("memory_usage_percent", Math.round(memoryUsagePercent * 100.0) / 100.0);
            check.put("message", memoryUsagePercent < 90 ? "Memory usage healthy" : "High memory usage detected");
            
        } catch (Exception e) {
            check.put("status", "DOWN");
            check.put("message", "Memory check failed: " + e.getMessage());
        }
        
        return check;
    }

    private long getApplicationStartTime() {
        // This is a simplified approach - in production you might use Spring's ApplicationContext
        // or a more sophisticated mechanism to track actual startup time
        return System.currentTimeMillis() - (System.currentTimeMillis() % (24 * 60 * 60 * 1000));
    }
}
