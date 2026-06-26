package com.modulo.collab.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public List<NotificationDto> feed(
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return service.getFeedForUser(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount(
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return Map.of("count", service.countUnread(userId));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markRead(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        try {
            return ResponseEntity.ok(service.markRead(id, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/read-all")
    public Map<String, Integer> markAllRead(
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return Map.of("updated", service.markAllRead(userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        service.delete(id, userId);
        return ResponseEntity.noContent().build();
    }
}
