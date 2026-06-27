package com.modulo.sharing;

import com.modulo.audit.AuditEventService;
import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ShareController Tests (#264)")
class ShareControllerTest {

    @Mock private ShareTokenRepository tokenRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private AuditEventService auditService;

    @InjectMocks
    private ShareController controller;

    private Note note;
    private ShareToken token;

    @BeforeEach
    void setUp() {
        note = new Note("Test Note", "Some content");
        note.setId(1L);

        token = new ShareToken();
        token.setId(10L);
        token.setNoteId(1L);
        token.setOwnerId("alice");
        token.setToken("abc123");
    }

    @Test
    @DisplayName("create returns 404 when note does not exist")
    void createNotFound() {
        when(noteRepository.findById(99L)).thenReturn(Optional.empty());
        var req = new ShareController.CreateShareRequest();
        assertThat(controller.create(99L, req, "alice").getStatusCode())
            .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("create saves token and records audit event")
    void createSavesToken() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(tokenRepository.save(any())).thenReturn(token);

        var req = new ShareController.CreateShareRequest();
        req.setExpiresInHours(24);

        ResponseEntity<ShareTokenDto> resp = controller.create(1L, req, "alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(tokenRepository).save(any(ShareToken.class));
        verify(auditService).record(eq("SHARE_CREATED"), eq(1L), eq("alice"), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("create with password hashes it")
    void createHashesPassword() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(tokenRepository.save(any())).thenAnswer(inv -> {
            ShareToken t = inv.getArgument(0);
            assertThat(t.getPasswordHash()).isNotNull().isNotEqualTo("secret");
            return token;
        });

        var req = new ShareController.CreateShareRequest();
        req.setPassword("secret");
        controller.create(1L, req, "alice");
    }

    @Test
    @DisplayName("renderShared returns 410 Gone for revoked token")
    void renderRevokedToken() {
        token.setRevoked(true);
        when(tokenRepository.findByToken("abc123")).thenReturn(Optional.of(token));

        ResponseEntity<String> resp = controller.renderShared("abc123", null, new MockHttpServletRequest());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    @Test
    @DisplayName("renderShared returns 410 Gone for expired token")
    void renderExpiredToken() {
        token.setExpiresAt(Instant.now().minusSeconds(3600));
        when(tokenRepository.findByToken("abc123")).thenReturn(Optional.of(token));

        ResponseEntity<String> resp = controller.renderShared("abc123", null, new MockHttpServletRequest());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    @Test
    @DisplayName("renderShared returns 401 when password required but not provided")
    void renderPasswordRequired() {
        token.setPasswordHash("$2a$10$hashed"); // any non-null hash
        when(tokenRepository.findByToken("abc123")).thenReturn(Optional.of(token));

        ResponseEntity<String> resp = controller.renderShared("abc123", null, new MockHttpServletRequest());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("renderShared returns 200 HTML for valid active token")
    void renderValid() {
        when(tokenRepository.findByToken("abc123")).thenReturn(Optional.of(token));
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        ResponseEntity<String> resp = controller.renderShared("abc123", null, new MockHttpServletRequest());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).contains("Test Note").contains("Some content").contains("<!DOCTYPE html>");
        verify(auditService).record(eq("SHARE_VIEWED"), eq(1L), any(), any(), eq("ALLOW"), any(), anyString());
    }

    @Test
    @DisplayName("revoke sets revoked flag and records audit event")
    void revokeToken() {
        when(tokenRepository.findById(10L)).thenReturn(Optional.of(token));

        ResponseEntity<Void> resp = controller.revoke(10L, "alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(token.isRevoked()).isTrue();
        verify(tokenRepository).save(token);
        verify(auditService).record(eq("SHARE_REVOKED"), eq(1L), eq("alice"), any(), any(), any(), anyString());
    }
}
