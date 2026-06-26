package com.modulo.collab.comment;

import com.modulo.collab.notification.NotificationService;
import com.modulo.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notes/{noteId}/comments")
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class CommentController {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@(\\S+)");

    private final NoteCommentRepository commentRepository;
    private final NoteRepository noteRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messaging;

    @GetMapping
    public List<NoteCommentDto> list(@PathVariable Long noteId) {
        return commentRepository.findByNoteIdOrderByCreatedAtAsc(noteId)
                                .stream()
                                .map(NoteCommentDto::from)
                                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<NoteCommentDto> create(@PathVariable Long noteId,
                                                  @RequestBody CreateCommentRequest req,
                                                  @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId,
                                                  @RequestHeader(value = "X-User-Name", defaultValue = "Anonymous") String userName) {
        if (!noteRepository.existsById(noteId)) {
            return ResponseEntity.notFound().build();
        }

        NoteComment comment = new NoteComment();
        comment.setNoteId(noteId);
        comment.setAuthorId(userId);
        comment.setAuthorName(userName);
        comment.setContent(req.getContent());
        comment.setParentId(req.getParentId());
        comment.setAnchorStart(req.getAnchorStart());
        comment.setAnchorEnd(req.getAnchorEnd());

        List<String> mentioned = extractMentions(req.getContent());
        comment.setMentionedUserIds(mentioned);

        NoteComment saved = commentRepository.save(comment);
        NoteCommentDto dto = NoteCommentDto.from(saved);

        // Broadcast to note subscribers
        messaging.convertAndSend("/topic/notes/" + noteId + "/comments", dto);

        // Notify mentioned users
        if (!mentioned.isEmpty()) {
            notificationService.notifyMentions(mentioned, userName, noteId, saved.getId());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PatchMapping("/{commentId}/resolve")
    public ResponseEntity<NoteCommentDto> resolve(@PathVariable Long noteId,
                                                   @PathVariable Long commentId,
                                                   @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        return commentRepository.findById(commentId)
            .filter(c -> c.getNoteId().equals(noteId))
            .map(c -> {
                c.setResolved(!c.isResolved());
                NoteComment saved = commentRepository.save(c);
                NoteCommentDto dto = NoteCommentDto.from(saved);
                messaging.convertAndSend("/topic/notes/" + noteId + "/comments", dto);
                return ResponseEntity.ok(dto);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> delete(@PathVariable Long noteId,
                                       @PathVariable Long commentId,
                                       @RequestHeader(value = "X-User-Id", defaultValue = "anonymous") String userId) {
        var found = commentRepository.findById(commentId)
            .filter(c -> c.getNoteId().equals(noteId) && c.getAuthorId().equals(userId));
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        commentRepository.delete(found.get());
        messaging.convertAndSend("/topic/notes/" + noteId + "/comments",
            Map.of("deleted", true, "id", commentId, "noteId", noteId));
        return ResponseEntity.noContent().build();
    }

    private List<String> extractMentions(String content) {
        if (content == null) return List.of();
        Matcher m = MENTION_PATTERN.matcher(content);
        List<String> out = new java.util.ArrayList<>();
        while (m.find()) out.add(m.group(1));
        return out;
    }

    public static class CreateCommentRequest {
        private String content;
        private Long parentId;
        private Integer anchorStart;
        private Integer anchorEnd;

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public Long getParentId() { return parentId; }
        public void setParentId(Long parentId) { this.parentId = parentId; }
        public Integer getAnchorStart() { return anchorStart; }
        public void setAnchorStart(Integer anchorStart) { this.anchorStart = anchorStart; }
        public Integer getAnchorEnd() { return anchorEnd; }
        public void setAnchorEnd(Integer anchorEnd) { this.anchorEnd = anchorEnd; }
    }
}
