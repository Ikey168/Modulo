package com.modulo.graph;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.repository.NoteLinkRepository;
import com.modulo.repository.NoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Backfills the Neo4j projection from the Postgres source of truth: projects every note as
 * a {@code (:Note)} node and every {@link NoteLink} as a {@code [:LINKS_TO]} edge.
 *
 * <p>Can be triggered on demand via {@code POST /api/graph/backfill} or automatically on
 * startup when {@code modulo.graph.backfill-on-startup=true} (default false, to keep
 * startup fast). Safe to run repeatedly — projection writes are idempotent MERGEs.</p>
 */
@Service
public class GraphBackfillService {

    private static final Logger logger = LoggerFactory.getLogger(GraphBackfillService.class);

    private final NoteRepository noteRepository;
    private final NoteLinkRepository noteLinkRepository;
    private final GraphProjectionService projection;

    @Value("${modulo.graph.backfill-on-startup:false}")
    private boolean backfillOnStartup;

    @Autowired
    public GraphBackfillService(NoteRepository noteRepository,
                                NoteLinkRepository noteLinkRepository,
                                GraphProjectionService projection) {
        this.noteRepository = noteRepository;
        this.noteLinkRepository = noteLinkRepository;
        this.projection = projection;
    }

    /**
     * Project all notes and links into Neo4j.
     * @return number of notes and links projected.
     */
    @Transactional(readOnly = true)
    public BackfillResult backfill() {
        if (!projection.isAvailable()) {
            logger.info("Backfill skipped: graph projection is disabled");
            return new BackfillResult(0, 0, false);
        }

        List<Note> notes = noteRepository.findAll();
        for (Note note : notes) {
            projection.upsertNote(note.getId(), note.getTitle());
        }

        List<NoteLink> links = noteLinkRepository.findAll();
        for (NoteLink link : links) {
            if (link.getSourceNote() != null && link.getTargetNote() != null) {
                projection.upsertLink(
                    link.getSourceNote().getId(), link.getSourceNote().getTitle(),
                    link.getTargetNote().getId(), link.getTargetNote().getTitle(),
                    link.getLinkType());
            }
        }

        logger.info("Graph backfill complete: {} notes, {} links projected", notes.size(), links.size());
        return new BackfillResult(notes.size(), links.size(), true);
    }

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartupIfEnabled() {
        if (backfillOnStartup && projection.isAvailable()) {
            logger.info("modulo.graph.backfill-on-startup=true: running graph backfill");
            try {
                backfill();
            } catch (Exception e) {
                logger.warn("Startup graph backfill failed: {}", e.getMessage());
            }
        }
    }

    /** Result of a backfill run. */
    public static class BackfillResult {
        private final int notes;
        private final int links;
        private final boolean projected;

        public BackfillResult(int notes, int links, boolean projected) {
            this.notes = notes;
            this.links = links;
            this.projected = projected;
        }

        public int getNotes() { return notes; }
        public int getLinks() { return links; }
        public boolean isProjected() { return projected; }
    }
}
