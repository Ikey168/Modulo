package com.modulo.blueprint;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * A blueprint stored in plugin_registry (runtime = 'BLUEPRINT').
 * The IR graph is carried in the {@code ir} field.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BlueprintEntry {

    private Long id;
    private String name;
    private String description;
    private String version;
    private Map<String, Object> ir;
    private String createdAt;
    private String updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public Map<String, Object> getIr() { return ir; }
    public void setIr(Map<String, Object> ir) { this.ir = ir; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}
