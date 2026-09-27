package com.modulo.controller;

import com.modulo.entity.NoteLink;
import com.modulo.graph.dto.UnlinkedMentionDto;
import com.modulo.service.NoteLinkService;
import com.modulo.service.UnlinkedMentionsService;
import com.modulo.service.WebSocketNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Note-graph endpoints backed by PostgreSQL:
 * <ul>
 *   <li>{@code GET  /api/graph/notes/{id}/unlinked-mentions}  — #252 title mentions not linked</li>
 *   <li>{@code POST /api/graph/notes/{id}/link-from/{sourceId}} — create a link (used by #252)</li>
 * </ul>
 * The graph view itself is built client-side from the note link records.
 */
@RestController
@RequestMapping("/api/graph")
@CrossOrigin(originPatterns = "*")
public class GraphController {
    @Autowired private com.modulo.security.AuthenticatedUserService users;

    private static final Logger logger = LoggerFactory.getLogger(GraphController.class);

    private final UnlinkedMentionsService unlinkedMentionsService;
    private final NoteLinkService noteLinkService;
    private final WebSocketNotificationService webSocketNotificationService;

    @Autowired
    public GraphController(UnlinkedMentionsService unlinkedMentionsService,
                           NoteLinkService noteLinkService,
                           WebSocketNotificationService webSocketNotificationService) {
        this.unlinkedMentionsService = unlinkedMentionsService;
        this.noteLinkService = noteLinkService;
        this.webSocketNotificationService = webSocketNotificationService;
    }

    /** #252 — notes mentioning this note's title without linking it. */
    @GetMapping("/notes/{id}/unlinked-mentions")
    public ResponseEntity<List<UnlinkedMentionDto>> getUnlinkedMentions(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(unlinkedMentionsService.findUnlinkedMentions(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            if (e instanceof org.springframework.web.server.ResponseStatusException) throw (org.springframework.web.server.ResponseStatusException) e;
            logger.error("Unlinked mentions failed for note {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Create a link FROM {@code sourceId} TO {@code id} (used by the unlinked-mentions
     * "Link" action). Goes through {@link NoteLinkService} so link events and
     * WebSocket listeners stay in sync.
     */
    @PostMapping("/notes/{id}/link-from/{sourceId}")
    public ResponseEntity<NoteLink> linkFrom(@PathVariable Long id,
                                             @PathVariable Long sourceId,
                                             @RequestParam(defaultValue = "REFERENCE") String linkType) {
        try {
            NoteLink link = noteLinkService.createLink(sourceId, id, linkType);
            webSocketNotificationService.broadcastNoteLinkCreated(
                link.getId(), sourceId, id, linkType, users.actor());
            return ResponseEntity.status(HttpStatus.CREATED).body(link);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            if (e instanceof org.springframework.web.server.ResponseStatusException) throw (org.springframework.web.server.ResponseStatusException) e;
            logger.error("link-from {} -> {} failed", sourceId, id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
