package com.modulo.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

@RestController
@RequestMapping("/api/audit")
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class AuditController {

    private final AuditEventService service;

    /**
     * GET /api/audit
     * Query params: noteId, userId, eventType, from (ISO), to (ISO), page, size
     * Users should only see their own events; admins can filter by any userId.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> query(
            @RequestParam(required = false) Long noteId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String requesterId) {

        // Non-admin users may only see their own events or events on their notes
        String effectiveUserId = "admin".equals(requesterId) ? userId : requesterId;
        Long effectiveNoteId   = noteId;  // note-scoped views are handled by noteId filter

        Instant fromInstant = from != null ? Instant.parse(from) : null;
        Instant toInstant   = to   != null ? Instant.parse(to)   : null;

        Page<AuditEvent> result = service.filter(effectiveNoteId, effectiveUserId, eventType,
                                                  fromInstant, toInstant, page, Math.min(size, 200));

        return ResponseEntity.ok(Map.of(
            "content",       result.getContent(),
            "totalElements", result.getTotalElements(),
            "totalPages",    result.getTotalPages(),
            "page",          result.getNumber(),
            "size",          result.getSize()
        ));
    }
}
