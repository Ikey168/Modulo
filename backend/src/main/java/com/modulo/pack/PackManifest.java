package com.modulo.pack;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Java representation of a pack manifest (#276). Mirrors the TypeScript PackManifest type.
 * Stored as JSONB in plugin_registry.config (runtime = 'PACK').
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PackManifest {

    private String id;
    private String version;
    private String name;
    private String description;
    private String author;
    private Integer minIrVersion;
    private String minCatalogVersion;
    private Contributes contributes = new Contributes();
    private List<PackDependency> dependencies = Collections.emptyList();
    private List<String> capabilities = Collections.emptyList();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public Integer getMinIrVersion() { return minIrVersion; }
    public void setMinIrVersion(Integer minIrVersion) { this.minIrVersion = minIrVersion; }

    public String getMinCatalogVersion() { return minCatalogVersion; }
    public void setMinCatalogVersion(String minCatalogVersion) { this.minCatalogVersion = minCatalogVersion; }

    public Contributes getContributes() { return contributes; }
    public void setContributes(Contributes contributes) { this.contributes = contributes != null ? contributes : new Contributes(); }

    public List<PackDependency> getDependencies() { return dependencies; }
    public void setDependencies(List<PackDependency> dependencies) { this.dependencies = dependencies != null ? dependencies : Collections.emptyList(); }

    public List<String> getCapabilities() { return capabilities; }
    public void setCapabilities(List<String> capabilities) { this.capabilities = capabilities != null ? capabilities : Collections.emptyList(); }

    // -------------------------------------------------------------------------
    // Nested types
    // -------------------------------------------------------------------------

    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Contributes {
        /** Raw node descriptor objects (JSON). Validated by PackService on install. */
        private List<Map<String, Object>> nodes = Collections.emptyList();
        /** Blueprint IR objects (JSON). */
        private List<Map<String, Object>> blueprints = Collections.emptyList();

        public List<Map<String, Object>> getNodes() { return nodes; }
        public void setNodes(List<Map<String, Object>> nodes) { this.nodes = nodes != null ? nodes : Collections.emptyList(); }

        public List<Map<String, Object>> getBlueprints() { return blueprints; }
        public void setBlueprints(List<Map<String, Object>> blueprints) { this.blueprints = blueprints != null ? blueprints : Collections.emptyList(); }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PackDependency {
        private String id;
        private String minVersion;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }

        public String getMinVersion() { return minVersion; }
        public void setMinVersion(String minVersion) { this.minVersion = minVersion; }
    }
}
