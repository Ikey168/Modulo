package com.modulo.entity;

import org.neo4j.ogm.annotation.GeneratedValue;
import org.neo4j.ogm.annotation.Id;
import org.neo4j.ogm.annotation.RelationshipEntity;
import org.neo4j.ogm.annotation.StartNode;
import org.neo4j.ogm.annotation.EndNode;

@RelationshipEntity(type = "LINKS_TO")
public class NoteLink {

    @Id
    @GeneratedValue
    private Long id;

    @StartNode
    private Note source;

    @EndNode
    private Note target;

    private String type;

    public NoteLink() {
    }

    public NoteLink(Note source, Note target, String type) {
        this.source = source;
        this.target = target;
        this.type = type;
    }

    public Long getId() {
        return id;
    }

    public Note getSource() {
        return source;
    }

    public Note getTarget() {
        return target;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}