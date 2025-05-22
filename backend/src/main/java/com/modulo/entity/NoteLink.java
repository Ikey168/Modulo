/*
package com.modulo.entity;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.RelationshipProperties;
import org.springframework.data.neo4j.core.schema.TargetNode;

@RelationshipProperties
public class NoteLink {

    @Id
    @GeneratedValue
    private Long id; // Internal ID for the relationship entity itself

    // The 'type' property from the original design, e.g., "RELATED", "REFERENCES", etc.
    private String type;

    @TargetNode
    private Note target; // The target node of this link

    public NoteLink() {
    }

    // Constructor for creating a link with a type and a target note
    public NoteLink(Note target, String type) {
        this.target = target;
        this.type = type;
    }

    public Long getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Note getTarget() {
        return target;
    }

    public void setTarget(Note target) {
        this.target = target;
    }

    // The source node is implicit from the entity that holds a collection of these NoteLink objects.
    // So, getSource() and setSource() are removed.
}
*/