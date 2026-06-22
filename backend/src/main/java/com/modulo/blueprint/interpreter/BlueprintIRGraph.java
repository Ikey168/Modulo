package com.modulo.blueprint.interpreter;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Java representation of the blueprint graph IR (mirrors the TypeScript BlueprintIR type).
 * Deserialized from the JSONB stored in plugin_registry.config.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class BlueprintIRGraph {

    private int irVersion;
    private List<IRNode> nodes = Collections.emptyList();
    private List<IREdge> edges = Collections.emptyList();

    public int getIrVersion() { return irVersion; }
    public void setIrVersion(int irVersion) { this.irVersion = irVersion; }

    public List<IRNode> getNodes() { return nodes; }
    public void setNodes(List<IRNode> nodes) { this.nodes = nodes != null ? nodes : Collections.emptyList(); }

    public List<IREdge> getEdges() { return edges; }
    public void setEdges(List<IREdge> edges) { this.edges = edges != null ? edges : Collections.emptyList(); }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class IRNode {
        private String id;
        private String type;
        private int nodeVersion;
        private Map<String, Object> config;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public int getNodeVersion() { return nodeVersion; }
        public void setNodeVersion(int nodeVersion) { this.nodeVersion = nodeVersion; }

        public Map<String, Object> getConfig() { return config; }
        public void setConfig(Map<String, Object> config) { this.config = config; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class IREdge {
        private String id;
        private String kind;
        private String fromNode;
        private String fromPin;
        private String toNode;
        private String toPin;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getKind() { return kind; }
        public void setKind(String kind) { this.kind = kind; }

        public String getFromNode() { return fromNode; }
        public void setFromNode(String fromNode) { this.fromNode = fromNode; }

        public String getFromPin() { return fromPin; }
        public void setFromPin(String fromPin) { this.fromPin = fromPin; }

        public String getToNode() { return toNode; }
        public void setToNode(String toNode) { this.toNode = toNode; }

        public String getToPin() { return toPin; }
        public void setToPin(String toPin) { this.toPin = toPin; }
    }
}
