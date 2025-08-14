package com.modulo.plugin.api;

import java.time.LocalDateTime;

/**
 * Health check result for plugin monitoring
 */
public class HealthCheck {
    
    public enum Status {
        HEALTHY,
        UNHEALTHY,
        DEGRADED,
        UNKNOWN
    }
    
    private final Status status;
    private final String message;
    private final LocalDateTime timestamp;
    private final long responseTimeMs;
    
    public HealthCheck(Status status, String message, long responseTimeMs) {
        this.status = status;
        this.message = message;
        this.responseTimeMs = responseTimeMs;
        this.timestamp = LocalDateTime.now();
    }
    
    public static HealthCheck healthy(String message) {
        return new HealthCheck(Status.HEALTHY, message, 0);
    }
    
    public static HealthCheck unhealthy(String message) {
        return new HealthCheck(Status.UNHEALTHY, message, 0);
    }
    
    public static HealthCheck degraded(String message) {
        return new HealthCheck(Status.DEGRADED, message, 0);
    }
    
    public static HealthCheck unknown(String message) {
        return new HealthCheck(Status.UNKNOWN, message, 0);
    }
    
    // Getters
    public Status getStatus() { return status; }
    public String getMessage() { return message; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public long getResponseTimeMs() { return responseTimeMs; }
    
    public boolean isHealthy() {
        return status == Status.HEALTHY;
    }
    
    @Override
    public String toString() {
        return String.format("HealthCheck{status=%s, message='%s', timestamp=%s}", 
                           status, message, timestamp);
    }
}
