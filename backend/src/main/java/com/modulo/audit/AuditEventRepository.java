package com.modulo.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    Page<AuditEvent> findByNoteIdOrderByCreatedAtDesc(Long noteId, Pageable pageable);

    Page<AuditEvent> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    @Query("""
        SELECT e FROM AuditEvent e
        WHERE (:noteId IS NULL OR e.noteId = :noteId)
          AND (:userId IS NULL OR e.userId = :userId)
          AND (:eventType IS NULL OR e.eventType = :eventType)
          AND (:from IS NULL OR e.createdAt >= :from)
          AND (:to IS NULL OR e.createdAt <= :to)
        ORDER BY e.createdAt DESC
        """)
    Page<AuditEvent> filter(
        @Param("noteId")    Long noteId,
        @Param("userId")    String userId,
        @Param("eventType") String eventType,
        @Param("from")      Instant from,
        @Param("to")        Instant to,
        Pageable pageable
    );
}
