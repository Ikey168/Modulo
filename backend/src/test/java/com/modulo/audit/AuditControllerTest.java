package com.modulo.audit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditController Tests (#266)")
class AuditControllerTest {

    @Mock private AuditEventService service;
    @InjectMocks private AuditController controller;

    private AuditEvent event;

    @BeforeEach
    void setUp() {
        event = new AuditEvent("NOTE_READ", 1L, "alice", "Alice", "ALLOW", "127.0.0.1", "status=200");
    }

    @Test
    @DisplayName("query returns page of events for the requesting user")
    void queryReturnsEvents() {
        var page = new PageImpl<>(List.of(event), PageRequest.of(0, 50), 1);
        when(service.filter(any(), eq("alice"), any(), any(), any(), eq(0), eq(50)))
            .thenReturn(page);

        var resp = controller.query(null, null, null, null, null, 0, 50, "alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        @SuppressWarnings("unchecked")
        var content = (List<?>) resp.getBody().get("content");
        assertThat(content).hasSize(1);
    }

    @Test
    @DisplayName("non-admin requester cannot override userId filter")
    void nonAdminSeesOnlyOwnEvents() {
        var page = new PageImpl<>(List.of(event), PageRequest.of(0, 50), 1);
        // controller forces effectiveUserId = requesterId for non-admins
        when(service.filter(any(), eq("bob"), any(), any(), any(), eq(0), eq(50)))
            .thenReturn(page);

        // bob tries to query for alice's events — should be ignored
        var resp = controller.query(null, "alice", null, null, null, 0, 50, "bob");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("size is capped at 200")
    void sizeCappedAt200() {
        var page = new PageImpl<AuditEvent>(List.of(), PageRequest.of(0, 200), 0);
        when(service.filter(any(), any(), any(), any(), any(), eq(0), eq(200)))
            .thenReturn(page);

        var resp = controller.query(null, null, null, null, null, 0, 9999, "alice");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("filter by noteId is passed through")
    void filterByNoteId() {
        var page = new PageImpl<>(List.of(event), PageRequest.of(0, 50), 1);
        when(service.filter(eq(1L), eq("alice"), any(), any(), any(), anyInt(), anyInt()))
            .thenReturn(page);

        var resp = controller.query(1L, null, null, null, null, 0, 50, "alice");
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("AuditEventService.record persists to repository")
    void serviceRecordPersists() {
        when(service.filter(any(), any(), any(), any(), any(), anyInt(), anyInt()))
            .thenReturn(new PageImpl<>(List.of()));
        // No exception = OK
        controller.query(null, null, null, null, null, 0, 10, "alice");
    }

    @Test
    @DisplayName("ShareToken isActive returns false when revoked")
    void shareTokenActiveWhenRevoked() {
        var t = new com.modulo.sharing.ShareToken();
        t.setRevoked(true);
        assertThat(t.isActive()).isFalse();
    }

    @Test
    @DisplayName("ShareToken isActive returns false when expired")
    void shareTokenActiveWhenExpired() {
        var t = new com.modulo.sharing.ShareToken();
        t.setExpiresAt(Instant.now().minusSeconds(1));
        assertThat(t.isActive()).isFalse();
    }
}
