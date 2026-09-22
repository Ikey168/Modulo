package com.modulo.audit;

import com.modulo.security.AuthenticatedUserService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AuditOwnershipTest {
    @Test void spoofedActorAndAdminFilterAreIgnored() {
        var repository = mock(AuditEventRepository.class);
        var users = mock(AuthenticatedUserService.class);
        when(users.actor()).thenReturn("17");
        var service = new AuditEventService(repository, users);
        service.record("NOTE_READ", 1L, "admin", "Someone else", "ALLOW", null, "status=200");
        var event = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(event.capture());
        assertThat(event.getValue().getUserId()).isEqualTo("17");
        assertThat(event.getValue().getUserName()).isNull();
        assertThat(event.getValue().isActorVerified()).isTrue();
        service.filter(null, "admin", null, null, null, 0, 50);
        verify(repository).filter(isNull(), eq("17"), isNull(), isNull(), isNull(), any());
    }

    @Test void unresolvedActorCannotBeAttributedToHeaderIdentity() {
        var repository = mock(AuditEventRepository.class);
        var users = mock(AuthenticatedUserService.class);
        when(users.actor()).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        new AuditEventService(repository, users).record("NOTE_READ", 1L, "17", "Alice", "DENY", null, "status=401");
        var event = ArgumentCaptor.forClass(AuditEvent.class);
        verify(repository).save(event.capture());
        assertThat(event.getValue().getUserId()).isNull();
    }
}
