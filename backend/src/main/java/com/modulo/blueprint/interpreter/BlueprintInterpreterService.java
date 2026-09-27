package com.modulo.blueprint.interpreter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.BlueprintNodeRegistration;
import com.modulo.blueprint.BlueprintNodeRegistry;
import com.modulo.blueprint.BlueprintNodeResult;
import com.modulo.blueprint.BlueprintRepository;
import com.modulo.blueprint.approval.ApprovalService;
import com.modulo.blueprint.execution.WorkflowCheckpointService;
import com.modulo.blueprint.execution.WorkflowRunService;
import com.modulo.blueprint.execution.WorkflowScheduler;
import com.modulo.blueprint.sandbox.ScriptSandbox;
import com.modulo.entity.Note;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.service.BlockchainService;
import com.modulo.service.NoesisBriefService;
import com.modulo.service.NoteService;
import com.modulo.service.OpenAIService;
import com.modulo.service.TagService;
import com.modulo.service.ViesService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Blueprint interpreter (#273): executes blueprint IR when trigger events fire on the
 * PluginEventBus. Each saved blueprint is loaded on startup and its trigger nodes are
 * wired to the bus. Every run has structured workflow_runs and workflow_steps records.
 *
 * <p>This bean is the interpreter's public API. The work is split by responsibility:
 * <ul>
 *   <li>{@link BlueprintTriggerRegistrar}: trigger registration (event listeners,
 *       webhooks, schedules);</li>
 *   <li>{@link BlueprintGraphRunner}: walks the IR graph for one run;</li>
 *   <li>{@link BuiltInNodeExecutor}: the built-in nodes, one class per node family.</li>
 * </ul>
 * Run bookkeeping stays in {@link WorkflowRunService}.
 *
 * <p>Execution safety:
 * - MAX_STEPS (100) prevents infinite exec loops.
 * - Async actions (AI, blockchain) time out after 30 seconds.
 */
@Service
public class BlueprintInterpreterService implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(BlueprintInterpreterService.class);

    @Autowired private WorkflowCheckpointService checkpoints;
    @Autowired private ApprovalService approvals;
    @Autowired(required = false) private WorkflowScheduler workflowScheduler;
    @Autowired private BlueprintRepository blueprintRepository;
    @Autowired private WorkflowRunService workflowRuns;
    @Autowired private BlueprintCapabilityService capabilityService;
    @Autowired private PluginEventBus eventBus;
    @Autowired private NoteService noteService;
    @Autowired private TagService tagService;
    @Autowired private OpenAIService openAIService;
    @Autowired private BlockchainService blockchainService;
    @Autowired private ScriptSandbox scriptSandbox;
    @Autowired private ViesService viesService;
    @Autowired private NoesisBriefService noesisBriefService;
    @Autowired private ObjectMapper objectMapper;
    @Autowired(required = false) private BlueprintNodeRegistry nodeRegistry;

    // The parts read the injected fields above at call time through this view.
    private final InterpreterDependencies deps = new Dependencies();
    private final BuiltInNodeExecutor builtIns = new BuiltInNodeExecutor(deps);
    private final BlueprintGraphRunner runner = new BlueprintGraphRunner(deps, builtIns);
    private final BlueprintTriggerRegistrar triggers = new BlueprintTriggerRegistrar(deps, runner);

    /** Attach the existing core switch to the registry used by plugin nodes. */
    @PostConstruct
    void registerCoreNodeHandlers() {
        if (nodeRegistry == null) return;
        Set<String> coreTypes = nodeRegistry.coreNodeTypes();
        // Optional registries are mocked or supplied by plugins during startup. A
        // missing result means there is nothing to register, not a failed application
        // context.
        if (coreTypes == null) return;
        for (String type : coreTypes) {
            if (type == null || type.startsWith("trigger.")) continue;
            String capability = nodeRegistry.capability(type, 1).orElse(null);
            nodeRegistry.register(
                BlueprintNodeRegistry.CORE_OWNER,
                BlueprintNodeRegistration.action(type, 1, capability, context -> {
                    NodeResult result = builtIns.execute(context.node(), context.inputs(), context.lease());
                    return new BlueprintNodeResult(result.outputs(), result.nextExecOut(), result.skipped());
                }));
        }
    }

    @PostConstruct
    void subscribeToPluginLifecycle() {
        eventBus.subscribe("system.plugin_started", event -> refreshRegisteredBlueprints());
        eventBus.subscribe("system.plugin_stopped", event -> refreshRegisteredBlueprints());
    }

    private void refreshRegisteredBlueprints() {
        triggers.registeredEntries().forEach(this::registerBlueprint);
    }

    /** Load and register all blueprints when the application is ready. */
    @Override
    public void run(ApplicationArguments args) {
        List<BlueprintEntry> blueprints = blueprintRepository.findRunnable();
        blueprints.forEach(this::registerBlueprint);
        logger.info("Blueprint interpreter started");
    }

    /**
     * Register a blueprint: parse its IR and subscribe each trigger node to the event bus
     * (or schedule a cron job for trigger.schedule). Safe to call again after an update.
     */
    public void registerBlueprint(BlueprintEntry entry) {
        triggers.register(entry);
    }

    /** Unregister instance-local event and webhook listeners. */
    public void unregisterBlueprint(String name) {
        triggers.unregister(name);
    }

    // -------------------------------------------------------------------------
    // Webhook ingress (#363)
    // -------------------------------------------------------------------------

    public enum WebhookResult { ACCEPTED, REJECTED }

    /**
     * Fire a registered trigger.webhook node. The secret is compared in
     * constant time; unknown endpoints and wrong secrets are indistinguishable
     * to the caller.
     */
    public WebhookResult fireWebhook(Long registryId, String nodeId, String secret, String payload) {
        return fireWebhook(registryId, nodeId, secret, payload, UUID.randomUUID().toString());
    }

    public WebhookResult fireWebhook(Long registryId, String nodeId, String secret, String payload, String deliveryId) {
        return triggers.fireWebhook(registryId, nodeId, secret, payload, deliveryId);
    }

    // -------------------------------------------------------------------------
    // Runs started or continued outside the event bus
    // -------------------------------------------------------------------------

    public UUID fireManual(BlueprintEntry entry, String nodeId, Note note, UUID requestId) {
        if (!BlueprintTriggerRegistrar.ownedNote(note, entry.getOwnerId()) || requestId == null) throw new IllegalArgumentException("INVALID_MANUAL_INPUT");
        var graph = objectMapper.convertValue(entry.getIr(), BlueprintIRGraph.class);
        if (graph.getNodes().stream().noneMatch(node -> nodeId.equals(node.getId()) && "trigger.manual".equals(node.getType()))) throw new IllegalArgumentException("MANUAL_TRIGGER_UNAVAILABLE");
        return runner.execute(graph, entry, nodeId, Map.of("note", note), "manual:" + requestId);
    }

    public UUID fireScheduled(BlueprintEntry entry, String nodeId, String key, String firedAt) {
        var graph = objectMapper.convertValue(entry.getIr(), BlueprintIRGraph.class);
        if (graph.getNodes().stream().noneMatch(node -> nodeId.equals(node.getId()) && "trigger.schedule".equals(node.getType()))) throw new IllegalArgumentException("SCHEDULE_REMOVED");
        return runner.execute(graph, entry, nodeId, Map.of("firedAt", firedAt), key);
    }

    public UUID retryRun(UUID parent, long owner, UUID requestId, int sequence, boolean confirmed) {
        return runner.retry(parent, owner, requestId, sequence, confirmed);
    }

    public void resumeWaiting(UUID run, long owner, int checkpoint) {
        runner.resume(run, owner, checkpoint);
    }

    /** Reads the injected fields at call time, so the parts see the current collaborators. */
    private final class Dependencies implements InterpreterDependencies {
        @Override public WorkflowCheckpointService checkpoints() { return checkpoints; }
        @Override public ApprovalService approvals() { return approvals; }
        @Override public WorkflowScheduler workflowScheduler() { return workflowScheduler; }
        @Override public WorkflowRunService workflowRuns() { return workflowRuns; }
        @Override public BlueprintCapabilityService capabilityService() { return capabilityService; }
        @Override public PluginEventBus eventBus() { return eventBus; }
        @Override public NoteService noteService() { return noteService; }
        @Override public TagService tagService() { return tagService; }
        @Override public OpenAIService openAIService() { return openAIService; }
        @Override public BlockchainService blockchainService() { return blockchainService; }
        @Override public ScriptSandbox scriptSandbox() { return scriptSandbox; }
        @Override public ViesService viesService() { return viesService; }
        @Override public NoesisBriefService noesisBriefService() { return noesisBriefService; }
        @Override public ObjectMapper objectMapper() { return objectMapper; }
        @Override public BlueprintNodeRegistry nodeRegistry() { return nodeRegistry; }
    }
}
