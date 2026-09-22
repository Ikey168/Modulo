package com.modulo.collab.notification;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {
    @org.springframework.beans.factory.annotation.Autowired private com.modulo.security.AuthenticatedUserService users;
    @org.springframework.beans.factory.annotation.Autowired private com.modulo.repository.NoteRepository notes;

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository repository;
    private final SimpMessagingTemplate messaging;

    public Notification create(String userId, String type, String message, Long noteId, Long commentId) {
        if (!users.actor().equals(userId) || (noteId != null && notes.findByIdAndUserId(noteId, users.requireUserId()).isEmpty()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Notification recipient not authorized");
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setMessage(message);
        n.setNoteId(noteId);
        n.setCommentId(commentId);
        Notification saved = repository.save(n);
        deliverViaWebSocket(saved);
        return saved;
    }

    public void notifyMentions(List<String> mentionedUserIds, String mentionerName,
                               Long noteId, Long commentId) {
        for (String uid : mentionedUserIds.stream().filter(users.actor()::equals).distinct().toList()) {
            String msg = mentionerName + " mentioned you in a note";
            create(uid, "MENTION", msg, noteId, commentId);
        }
    }

    public void notifyComment(String noteOwnerId, String commenterName, Long noteId, Long commentId) {
        String msg = commenterName + " commented on your note";
        create(noteOwnerId, "COMMENT", msg, noteId, commentId);
    }

    public List<NotificationDto> getFeedForUser(String userId) {
        userId = users.actor();
        return repository.findByUserIdOrderByCreatedAtDesc(userId)
                         .stream()
                         .map(NotificationDto::from)
                         .toList();
    }

    public long countUnread(String userId) {
        userId = users.actor();
        return repository.countByUserIdAndReadFalse(userId);
    }

    public NotificationDto markRead(Long id, String userId) {
        userId = users.actor();
        Notification n = repository.findById(id)
            .filter(x -> x.getUserId().equals(users.actor()))
            .orElseThrow(() -> new IllegalArgumentException("Notification not found"));
        n.setRead(true);
        return NotificationDto.from(repository.save(n));
    }

    public int markAllRead(String userId) {
        userId = users.actor();
        return repository.markAllReadForUser(userId);
    }

    public void delete(Long id, String userId) {
        userId = users.actor();
        repository.findById(id)
            .filter(x -> x.getUserId().equals(users.actor()))
            .ifPresent(repository::delete);
    }

    private void deliverViaWebSocket(Notification n) {
        try {
            messaging.convertAndSendToUser(n.getUserId(), "/queue/notifications",
                                     NotificationDto.from(n));
        } catch (Exception e) {
            log.error("Failed to push notification {} via WebSocket", n.getId(), e);
        }
    }
}
