package com.modulo.collab;

import com.modulo.collab.notification.Notification;
import com.modulo.collab.notification.NotificationDto;
import com.modulo.collab.notification.NotificationRepository;
import com.modulo.collab.notification.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationService Tests (#263)")
class NotificationServiceTest {

    @Mock
    private NotificationRepository repository;

    @Mock
    private SimpMessagingTemplate messaging;

    @InjectMocks
    private NotificationService service;

    private static Notification saved(Long id, String userId, String type, String msg) {
        Notification n = new Notification();
        n.setId(id);
        n.setUserId(userId);
        n.setType(type);
        n.setMessage(msg);
        return n;
    }

    @Test
    @DisplayName("create persists and pushes via WebSocket")
    void createPersistsAndPushes() {
        Notification persisted = saved(1L, "alice", "COMMENT", "Bob commented");
        when(repository.save(any())).thenReturn(persisted);

        NotificationDto result = NotificationDto.from(service.create("alice", "COMMENT", "Bob commented", 10L, 5L));

        assertThat(result.getUserId()).isEqualTo("alice");
        assertThat(result.getType()).isEqualTo("COMMENT");
        verify(messaging).convertAndSend(contains("alice"), any(NotificationDto.class));
    }

    @Test
    @DisplayName("notifyMentions creates one notification per mentioned user")
    void mentionsCreateNotifications() {
        when(repository.save(any())).thenAnswer(inv -> {
            Notification n = inv.getArgument(0);
            n.setId(99L);
            return n;
        });

        service.notifyMentions(List.of("bob", "carol"), "Alice", 1L, 2L);

        verify(repository, times(2)).save(any());
        verify(messaging, times(2)).convertAndSend(any(String.class), any(NotificationDto.class));
    }

    @Test
    @DisplayName("markRead throws for unknown notification")
    void markReadThrowsForUnknown() {
        when(repository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.markRead(99L, "alice"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("markRead throws when userId does not match")
    void markReadThrowsForWrongUser() {
        Notification n = saved(1L, "alice", "MENTION", "you were mentioned");
        when(repository.findById(1L)).thenReturn(Optional.of(n));
        assertThatThrownBy(() -> service.markRead(1L, "bob"))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("getFeedForUser maps entities to DTOs")
    void feedMapsToDto() {
        when(repository.findByUserIdOrderByCreatedAtDesc("alice"))
            .thenReturn(List.of(saved(1L, "alice", "COMMENT", "msg")));

        List<NotificationDto> feed = service.getFeedForUser("alice");

        assertThat(feed).hasSize(1);
        assertThat(feed.get(0).getUserId()).isEqualTo("alice");
    }
}
