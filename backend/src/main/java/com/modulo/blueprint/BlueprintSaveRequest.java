package com.modulo.blueprint;

import java.util.Map;

public class BlueprintSaveRequest {

    private String name;
    private String description;
    private String version;
    private Map<String, Object> ir;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public Map<String, Object> getIr() { return ir; }
    public void setIr(Map<String, Object> ir) { this.ir = ir; }
}
