package com.modulo.collab;

import com.modulo.collab.comment.NoteComment;
import com.modulo.collab.comment.NoteCommentRepository;
import com.modulo.collab.notification.NotificationService;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.modulo.collab.comment.CommentController;
import com.modulo.collab.comment.NoteCommentDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
@DisplayName("CommentController Tests (#262)")
class CommentControllerTest {

    @Mock private NoteCommentRepository commentRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private NotificationService notificationService;
    @Mock private SimpMessagingTemplate messaging;

    @InjectMocks
    private CommentController controller;

    private NoteComment stub(Long id, Long noteId, String authorId, String content) {
        NoteComment c = new NoteComment();
        c.setId(id);
        c.setNoteId(noteId);
        c.setAuthorId(authorId);
        c.setAuthorName("Test User");
        c.setContent(content);
        return c;
    }

    @Test
    @DisplayName("list returns all comments for a note")
    void listReturnsComments() {
        when(commentRepository.findByNoteIdOrderByCreatedAtAsc(1L))
            .thenReturn(List.of(stub(1L, 1L, "alice", "Great note!")));

        List<NoteCommentDto> result = controller.list(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getContent()).isEqualTo("Great note!");
    }

    @Test
    @DisplayName("create returns 404 when note does not exist")
    void createNotFoundWhenNoteAbsent() {
        when(noteRepository.existsById(99L)).thenReturn(false);
        var req = new CommentController.CreateCommentRequest();
        req.setContent("Hello");

        ResponseEntity<NoteCommentDto> resp = controller.create(99L, req, "alice", "Alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("create saves comment and broadcasts via WebSocket")
    void createSavesAndBroadcasts() {
        when(noteRepository.existsById(1L)).thenReturn(true);
        NoteComment saved = stub(10L, 1L, "alice", "Nice!");
        when(commentRepository.save(any())).thenReturn(saved);

        var req = new CommentController.CreateCommentRequest();
        req.setContent("Nice!");

        ResponseEntity<NoteCommentDto> resp = controller.create(1L, req, "alice", "Alice");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(messaging).convertAndSend(eq("/topic/notes/1/comments"), any(NoteCommentDto.class));
    }

    @Test
    @DisplayName("create notifies mentioned users")
    void createNotifiesMentions() {
        when(noteRepository.existsById(1L)).thenReturn(true);
        NoteComment saved = stub(10L, 1L, "alice", "@bob check this out");
        saved.setMentionedUserIds(List.of("bob"));
        when(commentRepository.save(any())).thenReturn(saved);

        var req = new CommentController.CreateCommentRequest();
        req.setContent("@bob check this out");

        controller.create(1L, req, "alice", "Alice");

        verify(notificationService).notifyMentions(any(), eq("Alice"), eq(1L), eq(10L));
    }

    @Test
    @DisplayName("delete returns 404 when comment belongs to another user")
    void deleteBlockedForOtherUser() {
        NoteComment c = stub(5L, 1L, "alice", "Alice's comment");
        when(commentRepository.findById(5L)).thenReturn(Optional.of(c));

        ResponseEntity<Void> resp = controller.delete(1L, 5L, "bob");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        verify(commentRepository, never()).delete(any());
    }
}
