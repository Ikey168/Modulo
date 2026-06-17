package com.modulo.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.*;

@DisplayName("Security Audit Logger Tests")
class SecurityAuditLoggerTest {

    private SecurityAuditLogger auditLogger;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        auditLogger = new SecurityAuditLogger(new ObjectMapper());
        request = mock(HttpServletRequest.class);
        lenient().when(request.getRemoteAddr()).thenReturn("10.0.0.1");
        lenient().when(request.getHeader("User-Agent")).thenReturn("JUnit");
        lenient().when(request.getHeader("Referer")).thenReturn("http://referer");
        lenient().when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        lenient().when(request.getHeader("X-Real-IP")).thenReturn(null);
        lenient().when(request.getMethod()).thenReturn("POST");
        lenient().when(request.getRequestURI()).thenReturn("/api/login");
        lenient().when(request.getQueryString()).thenReturn(null);
        lenient().when(request.getSession(false)).thenReturn(null);
    }

    @Test
    void authenticationEvents() {
        assertThatCode(() -> {
            auditLogger.logAuthenticationSuccess("alice", request);
            auditLogger.logAuthenticationFailure("bob", "bad password", request);
        }).doesNotThrowAnyException();
    }

    @Test
    void authorizationAndRateLimit() {
        assertThatCode(() -> {
            auditLogger.logAuthorizationFailure("alice", "/admin", "READ", request);
            auditLogger.logRateLimitExceeded("10.0.0.1", "JUnit", "/api/notes");
        }).doesNotThrowAnyException();
    }

    @Test
    void suspiciousActivityAndConfigChange() {
        assertThatCode(() -> {
            auditLogger.logSuspiciousActivity("BRUTE_FORCE", "many failures", request);
            auditLogger.logSecurityConfigChange("rate-limit", "100", "50", "admin");
        }).doesNotThrowAnyException();
    }

    @Test
    void sessionAndDataAccess() {
        assertThatCode(() -> {
            auditLogger.logSessionEvent("CREATED", "sess-1", "alice", request);
            auditLogger.logDataAccess("READ", "note:1", "alice", true);
            auditLogger.logDataAccess("DELETE", "note:2", "bob", false);
        }).doesNotThrowAnyException();
    }
}
