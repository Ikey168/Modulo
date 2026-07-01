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

    public void record(String eventType, Long noteId, String userId, String userName,
                       String outcome, String ipAddress, String detail) {
        repository.save(new AuditEvent(eventType, noteId, userId, userName, outcome, ipAddress, detail));
    }

    public Page<AuditEvent> filter(Long noteId, String userId, String eventType,
                                   Instant from, Instant to, int page, int size) {
        return repository.filter(noteId, userId, eventType, from, to, PageRequest.of(page, size));
    }
}
