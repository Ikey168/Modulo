package com.modulo.blueprint.interpreter;

import com.modulo.blueprint.execution.WorkflowRunService;
import com.modulo.entity.Note;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Built-in control-flow nodes: approvals ({@code action.approval.request},
 * {@code logic.approval.wait}, {@code logic.approval.result}), {@code logic.wait},
 * {@code logic.branch} and {@code logic.notes.filter}. The pause at a wait node
 * is handled by the graph walker; these methods only compute outputs.
 */
final class LogicNodes {

    private final InterpreterDependencies deps;

    LogicNodes(InterpreterDependencies deps) {
        this.deps = deps;
    }

    NodeResult requestApproval(BlueprintIRGraph.IRNode node, Map<String, Object> inputs, WorkflowRunService.Lease lease) {
        Map<String, Object> outputs = new HashMap<>();
        var trace = com.modulo.observability.ExecutionTraceContext.current();
        var request = deps.approvals().request(lease, trace.stepId(), node.getId(),
            node.getConfig() == null ? Map.of() : node.getConfig(), inputs);
        outputs.put("request", request.toString());
        return new NodeResult(outputs, "then");
    }

    NodeResult waitForApproval(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        var request = java.util.UUID.fromString(String.valueOf(inputs.get("request")));
        outputs.put("request", request.toString());
        return new NodeResult(outputs, "then");
    }

    NodeResult approvalResult(Map<String, Object> inputs, WorkflowRunService.Lease lease) {
        Map<String, Object> outputs = new HashMap<>();
        var request = java.util.UUID.fromString(String.valueOf(inputs.get("request")));
        outputs.putAll(deps.approvals().result(lease, request));
        return new NodeResult(outputs, outputs.get("outcome").toString().toLowerCase(java.util.Locale.ROOT));
    }

    NodeResult validateWait(Map<String, Object> config) {
        Object value = config == null ? 60 : config.getOrDefault("seconds", 60);
        if (!(value instanceof Number number) || number.intValue() < 1 || number.intValue() > 86400
                || number.doubleValue() != number.intValue()) {
            throw new IllegalArgumentException("INVALID_WAIT");
        }
        return new NodeResult(new HashMap<>(), "then");
    }

    NodeResult branch(Map<String, Object> inputs) {
        Boolean condition = (Boolean) inputs.getOrDefault("condition", Boolean.FALSE);
        return new NodeResult(new HashMap<>(), Boolean.TRUE.equals(condition) ? "true" : "false");
    }

    NodeResult filterNotes(Map<String, Object> inputs) {
        Map<String, Object> outputs = new HashMap<>();
        @SuppressWarnings("unchecked")
        List<Note> notes = (List<Note>) inputs.getOrDefault("notes", Collections.emptyList());
        String tag = (String) inputs.getOrDefault("tag", "");
        List<Note> filtered = notes.stream()
            .filter(n -> n.getTags().stream().anyMatch(t -> tag.equals(t.getName())))
            .collect(Collectors.toList());
        outputs.put("result", filtered);
        return new NodeResult(outputs, "then");
    }
}
