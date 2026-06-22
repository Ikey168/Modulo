package com.modulo.blueprint.interpreter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Per-execution state: pin values, an anti-loop step counter, and the ordered
 * list of nodes that actually executed (so the editor can highlight the path).
 * Pin values are addressed as "nodeId:pinId".
 */
public class BlueprintExecutionContext {

    static final int MAX_STEPS = 100;

    private final String executionId = UUID.randomUUID().toString();
    private final Map<String, Object> pinValues = new HashMap<>();
    private final List<String> executedNodes = new ArrayList<>();
    private int stepCount = 0;

    public String getExecutionId() { return executionId; }

    /** Record a node as having executed, in execution order. */
    public void recordExecutedNode(String nodeId) {
        executedNodes.add(nodeId);
    }

    /** The ordered list of node ids that executed in this run (debug highlight). */
    public List<String> getExecutedNodes() {
        return executedNodes;
    }

    public void setPinValue(String nodeId, String pinId, Object value) {
        pinValues.put(nodeId + ":" + pinId, value);
    }

    public Object getPinValue(String nodeId, String pinId) {
        return pinValues.get(nodeId + ":" + pinId);
    }

    /**
     * Increments the step counter and throws if MAX_STEPS is exceeded.
     * Prevents runaway execution from cyclic exec graphs.
     */
    public void incrementStep() {
        if (++stepCount > MAX_STEPS) {
            throw new BlueprintLoopGuardException(
                "Blueprint exceeded " + MAX_STEPS + " execution steps — possible infinite loop");
        }
    }

    public int getStepCount() { return stepCount; }
}
