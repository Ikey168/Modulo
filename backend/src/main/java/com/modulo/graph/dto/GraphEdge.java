package com.modulo.graph.dto;

/** A directed {@code [:LINKS_TO]} edge between two note nodes. */
public class GraphEdge {
    private Long source;
    private Long target;
    private String type;

    public GraphEdge() {}

    public GraphEdge(Long source, Long target, String type) {
        this.source = source;
        this.target = target;
        this.type = type;
    }

    public Long getSource() { return source; }
    public void setSource(Long source) { this.source = source; }

    public Long getTarget() { return target; }
    public void setTarget(Long target) { this.target = target; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
