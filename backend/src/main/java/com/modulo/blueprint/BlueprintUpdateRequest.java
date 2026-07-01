package com.modulo.blueprint;

import java.util.Map;

public class BlueprintUpdateRequest {

    private Map<String, Object> ir;
    private String changeReason;

    public Map<String, Object> getIr() { return ir; }
    public void setIr(Map<String, Object> ir) { this.ir = ir; }

    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
}
