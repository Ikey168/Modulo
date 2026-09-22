package com.modulo.blueprint;

import java.util.Map;

/**
 * Owner-selected execution posture for a Blueprint.
 *
 * <p>The level never grants a capability and never bypasses an approval node.
 * MANUAL additionally disables event, webhook, and schedule activation so a
 * confirmed request through the manual endpoint is the only way to start it.
 */
public enum BlueprintAutonomyLevel {
    MANUAL,
    SUPERVISED,
    AUTONOMOUS;

    public static BlueprintAutonomyLevel fromIr(Map<String, Object> ir) {
        if (ir == null) return SUPERVISED;
        Object metadataValue = ir.get("metadata");
        if (!(metadataValue instanceof Map<?, ?> metadata)) return SUPERVISED;
        Object raw = metadata.get("autonomyLevel");
        if (raw == null) return SUPERVISED;
        if (!(raw instanceof String value)) throw new IllegalArgumentException("Invalid autonomy level");
        return BlueprintAutonomyLevel.valueOf(value);
    }
}
