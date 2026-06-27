package com.modulo.controller;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.graph.GraphBackfillService;
import com.modulo.graph.GraphProjectionService;
import com.modulo.graph.dto.BacklinkDto;
import com.modulo.graph.dto.GraphNode;
import com.modulo.graph.dto.RelatedNote;
import com.modulo.graph.dto.UnlinkedMentionDto;
import com.modulo.repository.NoteRepository;
import com.modulo.service.NoteLinkService;
import com.modulo.service.UnlinkedMentionsService;
import com.modulo.service.WebSocketNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Knowledge-graph endpoints backed by the Neo4j projection (and Postgres for snippets /
 * unlinked mentions):
 * <ul>
 *   <li>{@code GET  /api/graph/notes/{id}/backlinks}          — #251 incoming links</li>
 *   <li>{@code GET  /api/graph/notes/{id}/unlinked-mentions}  — #252 title mentions not linked</li>
 *   <li>{@code GET  /api/graph/notes/{id}/related}            — #253 structurally related notes</li>
 *   <li>{@code GET  /api/graph/notes/{id}/neighborhood}       — #254 local subgraph</li>
 *   <li>{@code POST /api/graph/notes/{id}/link-from/{sourceId}} — create a link (used by #252)</li>
 *   <li>{@code POST /api/graph/backfill}                      — #250 project existing data</li>
 *   <li>{@code GET  /api/graph/status}                        — projection availability</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/graph")
@CrossOrigin(originPatterns = "*")
public class GraphController {

    private static final Logger logger = LoggerFactory.getLogger(GraphController.class);
    private static final int SNIPPET_LENGTH = 160;

    private final GraphProjectionService projection;
    private final GraphBackfillService backfillService;
    private final UnlinkedMentionsService unlinkedMentionsService;
    private final NoteRepository noteRepository;
    private final NoteLinkService noteLinkService;
    private final WebSocketNotificationService webSocketNotificationService;

    @Autowired
    public GraphController(GraphProjectionService projection,
                           GraphBackfillService backfillService,
                           UnlinkedMentionsService unlinkedMentionsService,
                           NoteRepository noteRepository,
                           NoteLinkService noteLinkService,
                           WebSocketNotificationService webSocketNotificationService) {
        this.projection = projection;
        this.backfillService = backfillService;
        this.unlinkedMentionsService = unlinkedMentionsService;
        this.noteRepository = noteRepository;
        this.noteLinkService = noteLinkService;
        this.webSocketNotificationService = webSocketNotificationService;
    }

    /** #251 — notes linking to this note, with a content snippet. */
    @GetMapping("/notes/{id}/backlinks")
    public ResponseEntity<List<BacklinkDto>> getBacklinks(@PathVariable Long id) {
        List<GraphNode> nodes = projection.getBacklinks(id);
        List<BacklinkDto> result = new ArrayList<>();
        for (GraphNode node : nodes) {
            result.add(new BacklinkDto(node.getId(), node.getTitle(), snippetFor(node.getId())));
        }
        return ResponseEntity.ok(result);
    }

    /** #252 — notes mentioning this note's title without linking it. */
    @GetMapping("/notes/{id}/unlinked-mentions")
    public ResponseEntity<List<UnlinkedMentionDto>> getUnlinkedMentions(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(unlinkedMentionsService.findUnlinkedMentions(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Unlinked mentions failed for note {}", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** #253 — structurally related notes (shared-neighbor scoring), with snippets. */
    @GetMapping("/notes/{id}/related")
    public ResponseEntity<List<RelatedNote>> getRelated(@PathVariable Long id,
                                                        @RequestParam(defaultValue = "10") int limit) {
        List<RelatedNote> related = projection.getRelatedNotes(id, Math.max(1, Math.min(limit, 50)));
        for (RelatedNote r : related) {
            r.setSnippet(snippetFor(r.getId()));
        }
        return ResponseEntity.ok(related);
    }

    /** #254 — local subgraph: nodes + edges within {@code depth} hops of this note. */
    @GetMapping("/notes/{id}/neighborhood")
    public ResponseEntity<Map<String, Object>> getNeighborhood(@PathVariable Long id,
                                                               @RequestParam(defaultValue = "1") int depth) {
        GraphProjectionService.NeighborhoodResult result = projection.getNeighborhood(id, depth);
        Map<String, Object> body = new HashMap<>();
        body.put("center", id);
        body.put("depth", depth);
        body.put("nodes", result.getNodes());
        body.put("edges", result.getEdges());
        return ResponseEntity.ok(body);
    }

    /**
     * Create a link FROM {@code sourceId} TO {@code id} (used by the unlinked-mentions
     * "Link" action). Goes through {@link NoteLinkService} so the Neo4j projection and
     * WebSocket listeners stay in sync.
     */
    @PostMapping("/notes/{id}/link-from/{sourceId}")
    public ResponseEntity<NoteLink> linkFrom(@PathVariable Long id,
                                             @PathVariable Long sourceId,
                                             @RequestParam(defaultValue = "REFERENCE") String linkType) {
        try {
            NoteLink link = noteLinkService.createLink(sourceId, id, linkType);
            webSocketNotificationService.broadcastNoteLinkCreated(
                link.getId(), sourceId, id, linkType, "current-user");
            return ResponseEntity.status(HttpStatus.CREATED).body(link);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            logger.error("link-from {} -> {} failed", sourceId, id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** #250 — backfill the projection from Postgres. */
    @PostMapping("/backfill")
    public ResponseEntity<GraphBackfillService.BackfillResult> backfill() {
        return ResponseEntity.ok(backfillService.backfill());
    }

    /** Projection availability + node count. */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> body = new HashMap<>();
        body.put("available", projection.isAvailable());
        body.put("nodeCount", projection.nodeCount());
        return ResponseEntity.ok(body);
    }

    // ------------------------------------------------------------------

    private String snippetFor(Long noteId) {
        if (noteId == null) {
            return "";
        }
        Optional<Note> note = noteRepository.findById(noteId);
        if (!note.isPresent()) {
            return "";
        }
        String content = note.get().getContent();
        if (content == null || content.isEmpty()) {
            return "";
        }
        String flat = content.replaceAll("\\s+", " ").trim();
        return flat.length() <= SNIPPET_LENGTH ? flat : flat.substring(0, SNIPPET_LENGTH) + "…";
    }
}
