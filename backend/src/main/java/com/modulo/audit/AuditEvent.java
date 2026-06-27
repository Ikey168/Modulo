package com.modulo.audit;

import javax.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_events", indexes = {
    @Index(name = "idx_audit_note_id", columnList = "note_id"),
    @Index(name = "idx_audit_user_id", columnList = "user_id"),
    @Index(name = "idx_audit_created_at", columnList = "created_at"),
})
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "note_id")
    private Long noteId;

    @Column(name = "user_id", length = 128)
    private String userId;

    @Column(name = "user_name", length = 256)
    private String userName;

    @Column(name = "outcome", length = 16)
    private String outcome;   // ALLOW / DENY / SUCCESS / FAILURE

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public AuditEvent() {}

    public AuditEvent(String eventType, Long noteId, String userId, String userName,
                      String outcome, String ipAddress, String detail) {
        this.eventType = eventType;
        this.noteId    = noteId;
        this.userId    = userId;
        this.userName  = userName;
        this.outcome   = outcome;
        this.ipAddress = ipAddress;
        this.detail    = detail;
    }

    // Getters / setters

    public Long getId() { return id; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public Long getNoteId() { return noteId; }
    public void setNoteId(Long noteId) { this.noteId = noteId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
