package com.modulo.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Security audit logger for tracking security-related events
 * Addresses Issue #51: Conduct Security Testing on Cloud Deployment
 */
@Component
public class SecurityAuditLogger {

    private static final Logger securityLogger = LoggerFactory.getLogger("SECURITY_AUDIT");
    private static final Logger logger = LoggerFactory.getLogger(SecurityAuditLogger.class);
    
    private final ObjectMapper objectMapper;
    private final DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME.withZone(ZoneId.systemDefault());

    public SecurityAuditLogger(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /**
     * Log authentication success events
     */
    public void logAuthenticationSuccess(String username, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("AUTHENTICATION_SUCCESS", request);
        auditEvent.put("username", username);
        auditEvent.put("outcome", "SUCCESS");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log authentication failure events
     */
    public void logAuthenticationFailure(String username, String reason, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("AUTHENTICATION_FAILURE", request);
        auditEvent.put("username", username);
        auditEvent.put("reason", reason);
        auditEvent.put("outcome", "FAILURE");
        auditEvent.put("riskLevel", "HIGH");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log authorization failure events
     */
    public void logAuthorizationFailure(String username, String resource, String action, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("AUTHORIZATION_FAILURE", request);
        auditEvent.put("username", username);
        auditEvent.put("resource", resource);
        auditEvent.put("action", action);
        auditEvent.put("outcome", "DENIED");
        auditEvent.put("riskLevel", "MEDIUM");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log rate limiting events
     */
    public void logRateLimitExceeded(String clientIp, String userAgent, String endpoint) {
        Map<String, Object> auditEvent = createBaseAuditEvent("RATE_LIMIT_EXCEEDED");
        auditEvent.put("clientIp", clientIp);
        auditEvent.put("userAgent", userAgent);
        auditEvent.put("endpoint", endpoint);
        auditEvent.put("outcome", "BLOCKED");
        auditEvent.put("riskLevel", "MEDIUM");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log suspicious request patterns
     */
    public void logSuspiciousActivity(String activityType, String description, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("SUSPICIOUS_ACTIVITY", request);
        auditEvent.put("activityType", activityType);
        auditEvent.put("description", description);
        auditEvent.put("riskLevel", "HIGH");
        auditEvent.put("requiresInvestigation", true);
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log security configuration changes
     */
    public void logSecurityConfigChange(String configType, String oldValue, String newValue, String changedBy) {
        Map<String, Object> auditEvent = createBaseAuditEvent("SECURITY_CONFIG_CHANGE");
        auditEvent.put("configType", configType);
        auditEvent.put("oldValue", oldValue);
        auditEvent.put("newValue", newValue);
        auditEvent.put("changedBy", changedBy);
        auditEvent.put("riskLevel", "HIGH");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log session management events
     */
    public void logSessionEvent(String eventType, String sessionId, String username, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("SESSION_EVENT", request);
        auditEvent.put("eventType", eventType);
        auditEvent.put("sessionId", sessionId);
        auditEvent.put("username", username);
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log data access events (for sensitive operations)
     */
    public void logDataAccess(String operation, String resource, String username, boolean success) {
        Map<String, Object> auditEvent = createBaseAuditEvent("DATA_ACCESS");
        auditEvent.put("operation", operation);
        auditEvent.put("resource", resource);
        auditEvent.put("username", username);
        auditEvent.put("outcome", success ? "SUCCESS" : "FAILURE");
        
        if (!success) {
            auditEvent.put("riskLevel", "MEDIUM");
        }
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log security vulnerability detection
     */
    public void logVulnerabilityDetection(String vulnerabilityType, String description, String severity, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("VULNERABILITY_DETECTED", request);
        auditEvent.put("vulnerabilityType", vulnerabilityType);
        auditEvent.put("description", description);
        auditEvent.put("severity", severity);
        auditEvent.put("riskLevel", "CRITICAL");
        auditEvent.put("requiresInvestigation", true);
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log CORS violations
     */
    public void logCorsViolation(String origin, String method, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent("CORS_VIOLATION", request);
        auditEvent.put("origin", origin);
        auditEvent.put("method", method);
        auditEvent.put("riskLevel", "MEDIUM");
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Create base audit event with common fields
     */
    private Map<String, Object> createBaseAuditEvent(String eventType) {
        Map<String, Object> auditEvent = new HashMap<>();
        auditEvent.put("eventId", UUID.randomUUID().toString());
        auditEvent.put("timestamp", formatter.format(Instant.now()));
        auditEvent.put("eventType", eventType);
        auditEvent.put("service", "modulo-api");
        
        // Add current user context if available
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getName())) {
            auditEvent.put("currentUser", auth.getName());
            auditEvent.put("authorities", auth.getAuthorities().toString());
        }
        
        return auditEvent;
    }

    /**
     * Create base audit event with common fields including request context
     */
    private Map<String, Object> createBaseAuditEvent(String eventType, HttpServletRequest request) {
        Map<String, Object> auditEvent = createBaseAuditEvent(eventType);
        
        if (request != null) {
            auditEvent.put("clientIp", getClientIpAddress(request));
            auditEvent.put("userAgent", request.getHeader("User-Agent"));
            auditEvent.put("requestMethod", request.getMethod());
            auditEvent.put("requestUri", request.getRequestURI());
            auditEvent.put("queryString", request.getQueryString());
            auditEvent.put("referer", request.getHeader("Referer"));
            
            // Add session info if available
            if (request.getSession(false) != null) {
                auditEvent.put("sessionId", request.getSession(false).getId());
            }
        }
        
        return auditEvent;
    }

    /**
     * Get the real client IP address
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }

    /**
     * Log the security event with proper formatting
     */
    private void logSecurityEvent(Map<String, Object> auditEvent) {
        try {
            // Add to MDC for structured logging
            MDC.put("eventType", (String) auditEvent.get("eventType"));
            MDC.put("eventId", (String) auditEvent.get("eventId"));
            
            if (auditEvent.containsKey("riskLevel")) {
                MDC.put("riskLevel", (String) auditEvent.get("riskLevel"));
            }
            
            // Log as structured JSON
            String jsonEvent = objectMapper.writeValueAsString(auditEvent);
            securityLogger.info("SECURITY_AUDIT: {}", jsonEvent);
            
            // Also log critical events to main logger
            String riskLevel = (String) auditEvent.get("riskLevel");
            if ("HIGH".equals(riskLevel) || "CRITICAL".equals(riskLevel)) {
                logger.warn("High-risk security event: {} - {}", auditEvent.get("eventType"), auditEvent.get("description"));
            }
            
        } catch (Exception e) {
            logger.error("Failed to log security audit event", e);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Log bulk security events (for batch operations)
     */
    public void logBulkSecurityEvents(String eventType, int eventCount, String description) {
        Map<String, Object> auditEvent = createBaseAuditEvent("BULK_SECURITY_EVENT");
        auditEvent.put("bulkEventType", eventType);
        auditEvent.put("eventCount", eventCount);
        auditEvent.put("description", description);
        
        logSecurityEvent(auditEvent);
    }

    /**
     * Log system security status changes
     */
    public void logSystemSecurityStatus(String statusType, String status, String details) {
        Map<String, Object> auditEvent = createBaseAuditEvent("SYSTEM_SECURITY_STATUS");
        auditEvent.put("statusType", statusType);
        auditEvent.put("status", status);
        auditEvent.put("details", details);
        
        logSecurityEvent(auditEvent);
    }
}
