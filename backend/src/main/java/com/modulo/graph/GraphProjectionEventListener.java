package com.modulo.graph;

import com.modulo.entity.Note;
import com.modulo.plugin.event.LinkEvent;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.event.PluginEventBus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

/**
 * Keeps the Neo4j projection in sync with note and link changes by subscribing to the
 * {@link PluginEventBus}. Events are published asynchronously by the note/link services,
 * so this listener runs off the request thread and never blocks or fails a write.
 */
@Component
public class GraphProjectionEventListener {

    private static final Logger logger = LoggerFactory.getLogger(GraphProjectionEventListener.class);

    private final PluginEventBus eventBus;
    private final GraphProjectionService projection;

    @Autowired
    public GraphProjectionEventListener(PluginEventBus eventBus, GraphProjectionService projection) {
        this.eventBus = eventBus;
        this.projection = projection;
    }

    @PostConstruct
    public void subscribe() {
        if (!projection.isAvailable()) {
            logger.info("Graph projection disabled (no Neo4j driver); skipping event subscriptions");
            return;
        }

        eventBus.subscribe("note.created", (NoteEvent e) -> upsertNote(e.getNote()));
        eventBus.subscribe("note.updated", (NoteEvent e) -> upsertNote(e.getNote()));
        eventBus.subscribe("note.deleted", (NoteEvent e) -> {
            if (e.getNote() != null) {
                projection.deleteNote(e.getNote().getId());
            }
        });

        eventBus.subscribe("link.created", (LinkEvent.LinkCreated e) -> {
            Note s = e.getSourceNote();
            Note t = e.getTargetNote();
            if (s != null && t != null) {
                projection.upsertLink(s.getId(), s.getTitle(), t.getId(), t.getTitle(), e.getLink().getLinkType());
            }
        });
        eventBus.subscribe("link.deleted", (LinkEvent.LinkDeleted e) ->
            projection.deleteLink(e.getSourceNoteId(), e.getTargetNoteId()));

        logger.info("Graph projection event listeners registered (note.*, link.*)");
    }

    private void upsertNote(Note note) {
        if (note != null) {
            projection.upsertNote(note.getId(), note.getTitle());
        }
    }
}
