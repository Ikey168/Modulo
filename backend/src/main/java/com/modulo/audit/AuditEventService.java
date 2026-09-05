package com.modulo.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AuditEventService {

    private final AuditEventRepository repository;
    private final com.modulo.security.AuthenticatedUserService users;

    public void record(String eventType, Long noteId, String userId, String userName,
                       String outcome, String ipAddress, String detail) {
        String actor = null;
        try { actor = users.actor(); }
        catch (org.springframework.web.server.ResponseStatusException anonymous) { /* Unresolved actor stays anonymous. */ }
        AuditEvent event = new AuditEvent(eventType, noteId, actor, null, outcome, ipAddress, detail);
        event.setActorVerified(true);
        repository.save(event);
    }

    public Page<AuditEvent> filter(Long noteId, String userId, String eventType,
                                   Instant from, Instant to, int page, int size) {
        return repository.filter(noteId, users.actor(), eventType, from, to, PageRequest.of(page, size));
    }
}
