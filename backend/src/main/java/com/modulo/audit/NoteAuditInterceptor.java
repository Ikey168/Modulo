package com.modulo.audit;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Intercepts note-related HTTP requests and records access events to the
 * audit_events table, making them queryable by the AuditController.
 */
@Component
public class NoteAuditInterceptor implements HandlerInterceptor {

    private static final Pattern NOTE_ID_PATTERN = Pattern.compile("/api/notes/(\\d+)");

    private final AuditEventService auditService;

    public NoteAuditInterceptor(AuditEventService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        String uri    = request.getRequestURI();
        String method = request.getMethod();

        Matcher m = NOTE_ID_PATTERN.matcher(uri);
        if (!m.find()) return;

        Long noteId;
        try { noteId = Long.parseLong(m.group(1)); } catch (NumberFormatException e) { return; }

        String userId   = header(request, "X-User-Id", "anonymous");
        String userName = header(request, "X-User-Name", null);
        int    status   = response.getStatus();
        String outcome  = (status >= 200 && status < 300) ? "ALLOW" : (status == 403 || status == 401) ? "DENY" : "ERROR";
        String eventType = switch (method) {
            case "GET"    -> "NOTE_READ";
            case "POST"   -> "NOTE_CREATE";
            case "PUT"    -> "NOTE_UPDATE";
            case "DELETE" -> "NOTE_DELETE";
            default       -> "NOTE_ACCESS";
        };

        // Only record note-specific operations (not bulk list)
        auditService.record(eventType, noteId, userId, userName, outcome, getClientIp(request), "status=" + status);
    }

    private static String header(HttpServletRequest req, String name, String fallback) {
        String v = req.getHeader(name);
        return (v != null && !v.isBlank()) ? v : fallback;
    }

    private static String getClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : req.getRemoteAddr();
    }
}
