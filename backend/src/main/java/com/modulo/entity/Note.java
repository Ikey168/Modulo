package com.modulo.entity;

// import org.springframework.data.neo4j.core.schema.GeneratedValue; // Neo4j
// import org.springframework.data.neo4j.core.schema.Id; // Neo4j
// import org.springframework.data.neo4j.core.schema.Node; // Neo4j
// import org.springframework.data.neo4j.core.schema.Relationship; // Neo4j

import jakarta.persistence.Entity; // JPA
import jakarta.persistence.GeneratedValue; // JPA
import jakarta.persistence.GenerationType; // JPA
import jakarta.persistence.Id; // JPA

import java.util.HashSet;
import java.util.Set;

// @Node // Neo4j
@Entity // JPA
public class Note {

    @Id // JPA
    @GeneratedValue(strategy = GenerationType.AUTO) // JPA
    // @org.springframework.data.neo4j.core.schema.Id // Neo4j - specific import to avoid clash
    // @org.springframework.data.neo4j.core.schema.GeneratedValue // Neo4j - specific import
    private Long id;

    private String title;

    private String content;

    // @Relationship(type = "LINKS_TO", direction = Relationship.Direction.OUTGOING) // Neo4j
    // private Set<NoteLink> links; // Neo4j specific, and NoteLink is commented out

    public Note() {
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Note(String title, String content) {
        this.title = title;
        this.content = content;
        // this.links = new HashSet<>(); // Neo4j specific
    }

    public Long getId() {
        return id;
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