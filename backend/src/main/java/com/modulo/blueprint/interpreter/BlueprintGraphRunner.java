package com.modulo.blueprint.interpreter;

import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.BlueprintNodeExecutionContext;
import com.modulo.blueprint.BlueprintNodeHandler;
import com.modulo.blueprint.BlueprintNodeRegistry;
import com.modulo.blueprint.BlueprintNodeResult;
import com.modulo.blueprint.approval.ApprovalFailure;
import com.modulo.blueprint.execution.WorkflowCancelledException;
import com.modulo.blueprint.execution.WorkflowPausedException;
import com.modulo.blueprint.execution.WorkflowRunService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Walks a Blueprint IR graph for one workflow run. Execution follows exec edges
 * depth-first and resolves data pin values between nodes. Run and step records
 * are kept by {@link WorkflowRunService}; this class only drives them.
 *
 * <p>MAX_STEPS ({@link BlueprintExecutionContext#MAX_STEPS}) prevents infinite exec loops.
 */
final class BlueprintGraphRunner {

    // Log under the interpreter's category so existing log configuration keeps applying.
    private static final Logger logger = LoggerFactory.getLogger(BlueprintInterpreterService.class);

    private final InterpreterDependencies deps;
    private final BuiltInNodeExecutor builtIns;

    BlueprintGraphRunner(InterpreterDependencies deps, BuiltInNodeExecutor builtIns) {
        this.deps = deps;
        this.builtIns = builtIns;
    }

    /** Start a new run of {@code graph} from a fired trigger node. Returns the run id. */
    UUID execute(BlueprintIRGraph graph, BlueprintEntry entry, String triggerNodeId,
                 Map<String, Object> triggerOutputs, String triggerKey) {
        WorkflowRunService workflowRuns = deps.workflowRuns();
        Long registryId = entry.getId();
        String digest;
        try {
            String canonical = deps.objectMapper().copy()
                .enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .writeValueAsString(entry.getIr());
            digest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception invalid) { throw new IllegalArgumentException("Invalid Blueprint snapshot", invalid); }
        var trigger = graph.getNodes().stream().filter(node -> node.getId().equals(triggerNodeId)).findFirst().orElseThrow();
        var lease = workflowRuns.create(registryId, entry.getOwnerId(), entry.getVersion() == null ? "1" : entry.getVersion(),
            digest, triggerNodeId, trigger.getType(), triggerKey);
        if (!lease.created()) return lease.id();
        workflowRuns.begin(lease);
        BlueprintExecutionContext ctx = new BlueprintExecutionContext(lease);
        ctx.setRegistryId(registryId);
        try {
            workflowRuns.asOwner(lease, () -> {
                try (var trace = com.modulo.observability.ExecutionTraceContext.open(lease.id(), UUID.randomUUID(), true)) {
                    long started = System.nanoTime();
                    var step = workflowRuns.startStep(lease, 1, triggerNodeId, trigger.getType(), Map.of());
                    triggerOutputs.forEach((pin, value) -> ctx.setPinValue(triggerNodeId, pin, value));
                    ctx.recordExecutedNode(triggerNodeId);
                    workflowRuns.finishStep(lease, step, "SUCCEEDED", triggerOutputs, null, elapsed(started));
                }
                if (deps.checkpoints() != null) deps.checkpoints().save(lease, 0, graph, triggerNodeId, "then", ctx.checkpointPins());
                workflowRuns.checkCancellation(lease);
                executeExecFlow(graph, ctx, triggerNodeId, "then");
                return null;
            });
            workflowRuns.checkCancellation(lease);
            workflowRuns.transition(lease, "RUNNING", "SUCCEEDED", null);
            logger.info("Workflow run {} finished", lease.id());
        } catch (WorkflowPausedException paused) {
            // The scheduler will resume the persisted boundary.
        } catch (WorkflowCancelledException cancelled) {
            workflowRuns.transition(lease, "RUNNING", "CANCELLED", null);
            logger.info("Workflow run {} cancelled", lease.id());
        } catch (Exception failure) {
            String classification = failure instanceof BlueprintLoopGuardException ? "LOOP_GUARD"
                : failure instanceof ApprovalFailure approval ? approval.getReason() : "NODE_FAILURE";
            workflowRuns.transition(lease, "RUNNING", "FAILED", classification);
            logger.warn("Workflow run {} failed: {}", lease.id(), classification);
        }
        return lease.id();
    }

    /** Replay a failed run from a checkpoint as a new child run. */
    UUID retry(UUID parent, long owner, UUID requestId, int sequence, boolean confirmed) {
        WorkflowRunService workflowRuns = deps.workflowRuns();
        var snapshot = deps.checkpoints().load(parent, owner, sequence);
        var lease = workflowRuns.createRetry(parent, owner, requestId, sequence, confirmed);
        if (!lease.created()) return lease.id();
        workflowRuns.begin(lease);
        var ctx = new BlueprintExecutionContext(lease);
        try {
            workflowRuns.asOwner(lease, () -> {
                // The persisted graph is replayed with current capability grants.
                Long registryId = workflowRuns.registryId(lease.id(), owner);
                ctx.setRegistryId(registryId);
                ctx.restorePins(snapshot.pins(), Math.max(0, sequence - 1));
                deps.checkpoints().save(lease, sequence, snapshot.graph(), snapshot.fromNode(), snapshot.outPin(), snapshot.pins());
                executeExecFlow(snapshot.graph(), ctx, snapshot.fromNode(), snapshot.outPin());
                workflowRuns.checkCancellation(lease);
                return null;
            });
            workflowRuns.transition(lease, "RUNNING", "SUCCEEDED", null);
        } catch (WorkflowPausedException paused) {
            // The scheduler will resume the persisted boundary.
        } catch (WorkflowCancelledException cancelled) {
            workflowRuns.transition(lease, "RUNNING", "CANCELLED", null);
        } catch (Exception failure) {
            workflowRuns.transition(lease, "RUNNING", "FAILED", "NODE_FAILURE");
        }
        return lease.id();
    }

    /** Continue a waiting run from its committed checkpoint. */
    void resume(UUID run, long owner, int checkpoint) {
        WorkflowRunService workflowRuns = deps.workflowRuns();
        var lease = new WorkflowRunService.Lease(run, owner, false);
        if (!workflowRuns.resumeWaiting(lease)) return;
        try {
            workflowRuns.asOwner(lease, () -> {
                if (deps.approvals() != null) deps.approvals().verifyResume(lease);
                var snapshot = deps.checkpoints().load(run, owner, checkpoint);
                var ctx = new BlueprintExecutionContext(lease);
                ctx.setRegistryId(workflowRuns.registryId(run, owner));
                ctx.restorePins(snapshot.pins(), Math.max(0, checkpoint - 1));
                executeExecFlow(snapshot.graph(), ctx, snapshot.fromNode(), snapshot.outPin());
                workflowRuns.checkCancellation(lease);
                return null;
            });
            workflowRuns.transition(lease, "RUNNING", "SUCCEEDED", null);
        } catch (WorkflowPausedException paused) {
            // A later wait has its own committed checkpoint.
        } catch (WorkflowCancelledException cancelled) {
            workflowRuns.transition(lease, "RUNNING", "CANCELLED", null);
        } catch (Exception invalid) {
            workflowRuns.transition(lease, "RUNNING", "DEAD_LETTER", "RESUME_FAILED");
        }
    }

    /** Follow exec edges depth-first until there are no more. */
    private void executeExecFlow(BlueprintIRGraph graph, BlueprintExecutionContext ctx,
                                 String fromNodeId, String execOutPin) {
        WorkflowRunService workflowRuns = deps.workflowRuns();
        var checkpoints = deps.checkpoints();
        // Find the exec edge leaving fromNodeId on execOutPin.
        Optional<BlueprintIRGraph.IREdge> execEdge = graph.getEdges().stream()
            .filter(e -> "exec".equals(e.getKind())
                      && fromNodeId.equals(e.getFromNode())
                      && execOutPin.equals(e.getFromPin()))
            .findFirst();

        if (!execEdge.isPresent()) return; // end of flow

        String targetId = execEdge.get().getToNode();
        BlueprintIRGraph.IRNode target = graph.getNodes().stream()
            .filter(n -> targetId.equals(n.getId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("Edge references unknown node: " + targetId));

        workflowRuns.checkCancellation(ctx.getLease());
        if (checkpoints != null) checkpoints.save(ctx.getLease(), ctx.getStepCount() + 1, graph, fromNodeId, execOutPin, ctx.checkpointPins());
        ctx.incrementStep(); // throws BlueprintLoopGuardException when > MAX_STEPS
        ctx.recordExecutedNode(targetId);

        Map<String, Object> inputs = resolveInputs(graph, ctx, targetId);
        NodeResult result;
        String capability = capabilityFor(target);
        boolean allowed = capability == null || deps.capabilityService().isGranted(ctx.getRegistryId(), capability);
        try (var trace = com.modulo.observability.ExecutionTraceContext.open(ctx.getLease().id(), UUID.randomUUID(), allowed)) {
            var step = workflowRuns.startStep(ctx.getLease(), ctx.getStepCount() + 1, targetId, target.getType(), inputs);
            long started = System.nanoTime();
            try {
                result = executeNode(target, inputs, ctx.getRegistryId(), ctx.getLease());
            } catch (Exception failure) {
                workflowRuns.finishStep(ctx.getLease(), step, "FAILED", Map.of(),
                    failure instanceof ApprovalFailure approval ? approval.getReason() : "NODE_FAILURE", elapsed(started));
                throw failure;
            }
            if ("logic.approval.wait".equals(target.getType())) {
                result.outputs().forEach((pin, value) -> ctx.setPinValue(targetId, pin, value));
                int checkpoint = ctx.getStepCount() + 1;
                checkpoints.save(ctx.getLease(), checkpoint, graph, targetId, "then", ctx.checkpointPins());
                try { deps.approvals().waitFor(ctx.getLease(), step, UUID.fromString((String) result.outputs().get("request")), checkpoint, elapsed(started)); }
                catch (Exception failure) { finishPauseFailure(ctx.getLease(), step, failure, started); throw failure; }
                throw new WorkflowPausedException();
            }
            if ("logic.wait".equals(target.getType())) {
                int seconds = ((Number) (target.getConfig() == null ? 60 : target.getConfig().getOrDefault("seconds", 60))).intValue();
                result.outputs().forEach((pin, value) -> ctx.setPinValue(targetId, pin, value));
                int checkpoint = ctx.getStepCount() + 1;
                checkpoints.save(ctx.getLease(), checkpoint, graph, targetId, "then", ctx.checkpointPins());
                try { workflowRuns.pause(ctx.getLease(), step, checkpoint, seconds, elapsed(started)); }
                catch (Exception failure) { finishPauseFailure(ctx.getLease(), step, failure, started); throw failure; }
                throw new WorkflowPausedException();
            }
            workflowRuns.finishStep(ctx.getLease(), step, result.skipped() ? "SKIPPED" : "SUCCEEDED",
                target.getType().contains(".approval.") ? deps.approvals().traceOutputs(ctx.getLease(), result.outputs()) : result.outputs(),
                result.skipped() ? "CAPABILITY_DENIED" : null, elapsed(started));
        }
        result.outputs().forEach((pinId, value) -> ctx.setPinValue(targetId, pinId, value));

        if (result.nextExecOut() != null) {
            executeExecFlow(graph, ctx, targetId, result.nextExecOut());
        }
    }

    private void finishPauseFailure(WorkflowRunService.Lease lease, UUID step, Exception failure, long started) {
        boolean cancelled = failure instanceof WorkflowCancelledException;
        String code = cancelled ? null : failure instanceof ApprovalFailure approval ? approval.getReason() : "NODE_FAILURE";
        deps.workflowRuns().finishStep(lease, step, cancelled ? "CANCELLED" : "FAILED", Map.of(), code, elapsed(started));
    }

    /** Collect values for all data edges flowing INTO the given node. */
    private Map<String, Object> resolveInputs(BlueprintIRGraph graph,
                                              BlueprintExecutionContext ctx, String nodeId) {
        Map<String, Object> inputs = new HashMap<>();
        graph.getEdges().stream()
            .filter(e -> "data".equals(e.getKind()) && nodeId.equals(e.getToNode()))
            .forEach(e -> {
                Object value = ctx.getPinValue(e.getFromNode(), e.getFromPin());
                if (value != null) inputs.put(e.getToPin(), value);
            });
        return inputs;
    }

    /**
     * Execute a single action or logic node. Returns output pin values and the next exec-out name.
     * Capability checks (#275): if the node declares a required capability and the blueprint does
     * not have a grant for it, execution is skipped (empty outputs, flow continues via 'then').
     */
    private NodeResult executeNode(BlueprintIRGraph.IRNode node, Map<String, Object> inputs, Long registryId,
                                   WorkflowRunService.Lease lease) {
        String requiredCap = capabilityFor(node);
        if (requiredCap != null && !deps.capabilityService().isGranted(registryId, requiredCap)) {
            logger.warn("Workflow node skipped: capability denied");
            return new NodeResult(new HashMap<>(), "then", true);
        }

        BlueprintNodeRegistry nodeRegistry = deps.nodeRegistry();
        if (nodeRegistry != null) {
            Optional<BlueprintNodeHandler> handler =
                nodeRegistry.handler(node.getType(), node.getNodeVersion());
            if (handler.isPresent()) {
                BlueprintNodeResult result = handler.get().execute(
                    new BlueprintNodeExecutionContext(node, inputs, registryId, lease.owner(), lease));
                return new NodeResult(result.outputs(), result.nextExecOut(), result.skipped());
            }
        }
        return builtIns.execute(node, inputs, lease);
    }

    private String capabilityFor(BlueprintIRGraph.IRNode node) {
        BlueprintNodeRegistry nodeRegistry = deps.nodeRegistry();
        if (nodeRegistry != null) {
            return nodeRegistry.capability(node.getType(), node.getNodeVersion())
                .orElse(BlueprintCapabilityService.NODE_CAPABILITY_MAP.get(node.getType()));
        }
        return BlueprintCapabilityService.NODE_CAPABILITY_MAP.get(node.getType());
    }

    private static long elapsed(long started) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
    }
}
