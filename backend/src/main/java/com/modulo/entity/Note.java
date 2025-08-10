package com.modulo.entity;

// import org.springframework.data.neo4j.core.schema.GeneratedValue; // Neo4j
// import org.springframework.data.neo4j.core.schema.Id; // Neo4j
// import org.springframework.data.neo4j.core.schema.Node; // Neo4j
// import org.springframework.data.neo4j.core.schema.Relationship; // Neo4j

import javax.persistence.*; // JPA

import java.util.HashSet;
import java.util.Set;

// @Node // Neo4j
@Entity // JPA
@Table(name = "notes", schema = "application")
public class Note {

    @Id // JPA
    @GeneratedValue(strategy = GenerationType.AUTO) // JPA
    // @org.springframework.data.neo4j.core.schema.Id // Neo4j - specific import to avoid clash
    // @org.springframework.data.neo4j.core.schema.GeneratedValue // Neo4j - specific import
    @Column(name = "note_id")
    private Long id;

    @Column(name = "title")
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "markdown_content", columnDefinition = "TEXT")
    private String markdownContent;

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "note_tags",
        schema = "application",
        joinColumns = @JoinColumn(name = "note_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new HashSet<>();

    @OneToMany(mappedBy = "sourceNote", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<NoteLink> outgoingLinks = new HashSet<>();

    @OneToMany(mappedBy = "targetNote", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<NoteLink> incomingLinks = new HashSet<>();

    // @Relationship(type = "LINKS_TO", direction = Relationship.Direction.OUTGOING) // Neo4j
    // private Set<NoteLink> links; // Neo4j specific, and NoteLink is commented out

    public Note() {
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Note(String title, String content) {
        this.title = title;
        this.content = content;
        this.markdownContent = content; // Default to content for backward compatibility
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Note(String title, String content, String markdownContent) {
        this.title = title;
        this.content = content;
        this.markdownContent = markdownContent;
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMarkdownContent() {
        return markdownContent;
    }

    public void setMarkdownContent(String markdownContent) {
        this.markdownContent = markdownContent;
    }

    public Set<Tag> getTags() {
        return tags;
    }

    public void setTags(Set<Tag> tags) {
        this.tags = tags;
    }

    public void addTag(Tag tag) {
        this.tags.add(tag);
        tag.getNotes().add(this);
    }

    public void removeTag(Tag tag) {
        this.tags.remove(tag);
        tag.getNotes().remove(this);
    }

    public Set<NoteLink> getOutgoingLinks() {
        return outgoingLinks;
    }

    public void setOutgoingLinks(Set<NoteLink> outgoingLinks) {
        this.outgoingLinks = outgoingLinks;
    }

    public Set<NoteLink> getIncomingLinks() {
        return incomingLinks;
    }

    public void setIncomingLinks(Set<NoteLink> incomingLinks) {
        this.incomingLinks = incomingLinks;
    }

    public void addOutgoingLink(NoteLink link) {
        this.outgoingLinks.add(link);
        link.setSourceNote(this);
    }

    public void removeOutgoingLink(NoteLink link) {
        this.outgoingLinks.remove(link);
        link.setSourceNote(null);
    }

    public void addIncomingLink(NoteLink link) {
        this.incomingLinks.add(link);
        link.setTargetNote(this);
    }

    public void removeIncomingLink(NoteLink link) {
        this.incomingLinks.remove(link);
        link.setTargetNote(null);
    }

    /* // Neo4j specific
    public Set<NoteLink> getLinks() {
        return links;
    }

    public void setLinks(Set<NoteLink> links) {
        this.links = links;
    }

    public void addLink(NoteLink link) {
        if (this.links == null) {
            this.links = new HashSet<>();
        }
        this.links.add(link);
    }
    */
}