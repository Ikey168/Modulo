package com.modulo.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "note_links", schema = "application")
public class NoteLink {

    @Id
    @GeneratedValue
    @Column(name = "link_id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_note_id", nullable = false)
    private Note sourceNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_note_id", nullable = false)
    private Note targetNote;

    @Column(name = "link_type", nullable = false)
    private String linkType;

    // Constructors
    public NoteLink() {}

    public NoteLink(Note sourceNote, Note targetNote, String linkType) {
        this.sourceNote = sourceNote;
        this.targetNote = targetNote;
        this.linkType = linkType;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Note getSourceNote() {
        return sourceNote;
    }

    public void setSourceNote(Note sourceNote) {
        this.sourceNote = sourceNote;
    }

    public Note getTargetNote() {
        return targetNote;
    }

    public void setTargetNote(Note targetNote) {
        this.targetNote = targetNote;
    }

    public String getLinkType() {
        return linkType;
    }

    public void setLinkType(String linkType) {
        this.linkType = linkType;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof NoteLink)) return false;
        NoteLink noteLink = (NoteLink) o;
        return id != null && id.equals(noteLink.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @Override
    public String toString() {
        return "NoteLink{" +
                "id=" + id +
                ", linkType='" + linkType + '\'' +
                '}';
    }
}