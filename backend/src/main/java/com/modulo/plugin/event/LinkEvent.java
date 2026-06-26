package com.modulo.plugin.event;

import com.modulo.entity.NoteLink;
import com.modulo.entity.Note;

/**
 * Events related to note-to-note link operations.
 * Published by NoteLinkService; consumed by blueprint trigger.link.created.
 */
public abstract class LinkEvent extends PluginEvent {

    protected LinkEvent(String type, Object source) {
        super(type, source);
    }

    /** Fired when a [[link]] between two notes is created. */
    public static class LinkCreated extends LinkEvent {

        private final Note sourceNote;
        private final Note targetNote;

        public LinkCreated(NoteLink link) {
            super("link.created", link);
            this.sourceNote = link.getSourceNote();
            this.targetNote = link.getTargetNote();
        }

        public NoteLink getLink() { return (NoteLink) getSource(); }
        public Note getSourceNote() { return sourceNote; }
        public Note getTargetNote() { return targetNote; }
    }

    /**
     * Fired when a link between two notes is deleted. Carries the endpoint ids only,
     * since the {@link NoteLink} row is gone by the time consumers (e.g. the Neo4j
     * projection) handle the event.
     */
    public static class LinkDeleted extends LinkEvent {

        private final Long sourceNoteId;
        private final Long targetNoteId;

        public LinkDeleted(Long sourceNoteId, Long targetNoteId) {
            super("link.deleted", sourceNoteId);
            this.sourceNoteId = sourceNoteId;
            this.targetNoteId = targetNoteId;
        }

        public Long getSourceNoteId() { return sourceNoteId; }
        public Long getTargetNoteId() { return targetNoteId; }
    }
}
