package com.modulo.graph.dto;

/** A note node in the projection. */
public class GraphNode {
    private Long id;
    private String title;

    public GraphNode() {}

    public GraphNode(Long id, String title) {
        this.id = id;
        this.title = title;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
}
