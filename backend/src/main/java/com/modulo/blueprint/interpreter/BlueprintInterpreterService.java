package com.modulo.blueprint.interpreter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.BlueprintRepository;
import com.modulo.blueprint.sandbox.SandboxedScriptService;
import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.plugin.event.LinkEvent;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.event.PluginEvent;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.PluginEventListener;
import com.modulo.service.BlockchainService;
import com.modulo.service.NoteService;
import com.modulo.service.OpenAIService;
import com.modulo.service.TagService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Blueprint interpreter (#273): executes blueprint IR when trigger events fire on the
 * PluginEventBus. Each saved blueprint is loaded on startup and its trigger nodes are
 * wired to the bus. Execution follows exec edges topologically and resolves data pin
 * values between nodes. Every run is traced in plugin_execution_logs.
 *
 * Execution safety:
 * - MAX_STEPS (100) prevents infinite exec loops.
 * - Async actions (AI, blockchain) time out after 30 seconds.
 */
@Service
public class BlueprintInterpreterService implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(BlueprintInterpreterService.class);
    private static final long ACTION_TIMEOUT_SECS = 30;

    @Autowired private BlueprintRepository blueprintRepository;
    @Autowired private BlueprintCapabilityService capabilityService;
    @Autowired private PluginEventBus eventBus;
    @Autowired private NoteService noteService;
    @Autowired private TagService tagService;
    @Autowired private OpenAIService openAIService;
    @Autowired private BlockchainService blockchainService;
    @Autowired private SandboxedScriptService sandboxedScriptService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    // Per-blueprint listener registrations so they can be removed on unregister.
    private final Map<String, List<ListenerRegistration>> registeredListeners = new ConcurrentHashMap<>();
    private final Map<String, List<ScheduledFuture<?>>> scheduledJobs = new ConcurrentHashMap<>();

    // Webhook trigger registrations (#363): "<registryId>:<nodeId>" → registration,
    // plus per-blueprint keys so unregister removes exactly its endpoints.
    private final Map<String, WebhookRegistration> webhooks = new ConcurrentHashMap<>();
    private final Map<String, List<String>> webhookKeysByBlueprint = new ConcurrentHashMap<>();

    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();

    @PostConstruct
    public void initScheduler() {
        taskScheduler.setPoolSize(4);
        taskScheduler.setThreadNamePrefix("blueprint-schedule-");
        taskScheduler.initialize();
    }

    /** Load and register all blueprints when the application is ready. */
    @Override
    public void run(ApplicationArguments args) {
        List<BlueprintEntry> blueprints = blueprintRepository.findAll();
        blueprints.forEach(this::registerBlueprint);
        logger.info("Blueprint interpreter started: {} blueprint(s) registered", blueprints.size());
    }

    /**
     * Register a blueprint: parse its IR and subscribe each trigger node to the event bus
     * (or schedule a cron job for trigger.schedule). Safe to call again after an update.
     */
    public void registerBlueprint(BlueprintEntry entry) {
        // Remove previous registrations for this blueprint in case of re-register.
        unregisterBlueprint(entry.getName());

        BlueprintIRGraph graph;
        try {
            graph = objectMapper.convertValue(entry.getIr(), BlueprintIRGraph.class);
        } catch (Exception e) {
            logger.error("Blueprint '{}': failed to parse IR — {}", entry.getName(), e.getMessage());
            return;
        }

        Long registryId = entry.getId();
        List<ListenerRegistration> listeners = new ArrayList<>();
        List<ScheduledFuture<?>> futures = new ArrayList<>();

        for (BlueprintIRGraph.IRNode node : graph.getNodes()) {
            if (!node.getType().startsWith("trigger.")) continue;

            switch (node.getType()) {
                case "trigger.note.saved": {
                    String triggerId = node.getId();
                    PluginEventListener<NoteEvent> listener = event ->
                        executeBlueprint(graph, registryId, triggerId, Map.of("note", event.getNote()));
                    eventBus.subscribe("note.created", listener);
                    eventBus.subscribe("note.updated", listener);
                    listeners.add(new ListenerRegistration("note.created", listener));
                    listeners.add(new ListenerRegistration("note.updated", listener));
                    break;
                }
                case "trigger.link.created": {
                    String triggerId = node.getId();
                    PluginEventListener<LinkEvent.LinkCreated> listener = event ->
                        executeBlueprint(graph, registryId, triggerId, Map.of(
                            "link",   event.getLink(),
                            "source", event.getSourceNote(),
                            "target", event.getTargetNote()
                        ));
                    eventBus.subscribe("link.created", listener);
                    listeners.add(new ListenerRegistration("link.created", listener));
                    break;
                }
                case "trigger.schedule": {
                    String cron = node.getConfig() != null
                        ? (String) node.getConfig().get("cron") : null;
                    if (cron == null || cron.isBlank()) {
                        logger.warn("Blueprint '{}': trigger.schedule node '{}' missing 'cron' config",
                            entry.getName(), node.getId());
                        break;
                    }
                    String triggerId = node.getId();
                    try {
                        ScheduledFuture<?> future = taskScheduler.schedule(() -> {
                            String firedAt = LocalDateTime.now().toString();
                            executeBlueprint(graph, registryId, triggerId, Map.of("firedAt", firedAt));
                        }, new CronTrigger(cron));
                        futures.add(future);
                    } catch (IllegalArgumentException e) {
                        logger.error("Blueprint '{}': invalid cron '{}' — {}", entry.getName(), cron, e.getMessage());
                    }
                    break;
                }
                case "trigger.webhook": {
                    String secret = node.getConfig() != null
                        ? (String) node.getConfig().get("secret") : null;
                    if (secret == null || secret.isBlank()) {
                        logger.warn("Blueprint '{}': trigger.webhook node '{}' missing 'secret' config — endpoint not registered",
                            entry.getName(), node.getId());
                        break;
                    }
                    String key = registryId + ":" + node.getId();
                    webhooks.put(key, new WebhookRegistration(graph, registryId, node.getId(), secret));
                    webhookKeysByBlueprint.computeIfAbsent(entry.getName(), k -> new ArrayList<>()).add(key);
                    logger.info("Blueprint '{}': webhook endpoint registered at /api/public/blueprints/webhook/{}/{}",
                        entry.getName(), registryId, node.getId());
                    break;
                }
                default:
                    logger.warn("Blueprint '{}': unrecognised trigger type '{}'", entry.getName(), node.getType());
            }
        }

        registeredListeners.put(entry.getName(), listeners);
        if (!futures.isEmpty()) scheduledJobs.put(entry.getName(), futures);
        logger.info("Blueprint '{}' registered ({} event listener(s), {} schedule(s))",
            entry.getName(), listeners.size(), futures.size());
    }

    /** Unregister a blueprint: unsubscribe listeners and cancel scheduled jobs. */
    public void unregisterBlueprint(String name) {
        List<ListenerRegistration> listeners = registeredListeners.remove(name);
        if (listeners != null) {
            listeners.forEach(r -> eventBus.unsubscribe(r.eventType(), r.listener()));
        }
        List<ScheduledFuture<?>> futures = scheduledJobs.remove(name);
        if (futures != null) {
            futures.forEach(f -> f.cancel(false));
        }
        List<String> webhookKeys = webhookKeysByBlueprint.remove(name);
        if (webhookKeys != null) {
            webhookKeys.forEach(webhooks::remove);
        }
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
        WebhookRegistration reg = webhooks.get(registryId + ":" + nodeId);
        if (reg == null || secret == null) return WebhookResult.REJECTED;
        boolean valid = java.security.MessageDigest.isEqual(
            reg.secret().getBytes(java.nio.charset.StandardCharsets.UTF_8),
            secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!valid) {
            logger.warn("Blueprint {}: webhook '{}' rejected — invalid secret", registryId, nodeId);
            return WebhookResult.REJECTED;
        }
        executeBlueprint(reg.graph(), reg.registryId(), reg.triggerNodeId(), Map.of("payload", payload));
        return WebhookResult.ACCEPTED;
    }

    // -------------------------------------------------------------------------
    // Graph execution
    // -------------------------------------------------------------------------

    private void executeBlueprint(BlueprintIRGraph graph, Long registryId,
                                   String triggerNodeId, Map<String, Object> triggerOutputs) {
        long startMs = System.currentTimeMillis();
        BlueprintExecutionContext ctx = new BlueprintExecutionContext();
        ctx.setRegistryId(registryId);

        try {
            triggerOutputs.forEach((pin, value) -> ctx.setPinValue(triggerNodeId, pin, value));
            ctx.recordExecutedNode(triggerNodeId);
            executeExecFlow(graph, ctx, triggerNodeId, "then");

            long elapsed = System.currentTimeMillis() - startMs;
            log(registryId, "event_handle", "success",
                "Executed " + ctx.getStepCount() + " step(s) [run=" + ctx.getExecutionId() + "]"
                    + " [nodes=" + String.join(",", ctx.getExecutedNodes()) + "]", elapsed);

        } catch (BlueprintLoopGuardException e) {
            long elapsed = System.currentTimeMillis() - startMs;
            logger.error("Blueprint loop guard: {}", e.getMessage());
            log(registryId, "event_handle", "error", "Loop guard: " + e.getMessage(), elapsed);

        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startMs;
            logger.error("Blueprint execution error [run={}]: {}", ctx.getExecutionId(), e.getMessage(), e);
            log(registryId, "event_handle", "error", e.getMessage(), elapsed);
        }
    }

    /** Follow exec edges depth-first until there are no more. */
    private void executeExecFlow(BlueprintIRGraph graph, BlueprintExecutionContext ctx,
                                  String fromNodeId, String execOutPin) {
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

        ctx.incrementStep(); // throws BlueprintLoopGuardException when > MAX_STEPS
        ctx.recordExecutedNode(targetId);

        Map<String, Object> inputs = resolveInputs(graph, ctx, targetId);
        NodeResult result = executeNode(target, inputs, ctx.getRegistryId());
        result.outputs().forEach((pinId, value) -> ctx.setPinValue(targetId, pinId, value));

        if (result.nextExecOut() != null) {
            executeExecFlow(graph, ctx, targetId, result.nextExecOut());
        }
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
    private NodeResult executeNode(BlueprintIRGraph.IRNode node, Map<String, Object> inputs, Long registryId) {
        Map<String, Object> outputs = new HashMap<>();

        // Enforce capability grant before running any action node.
        String requiredCap = BlueprintCapabilityService.NODE_CAPABILITY_MAP.get(node.getType());
        if (requiredCap != null && !capabilityService.isGranted(registryId, requiredCap)) {
            logger.warn("Blueprint {}: node '{}' skipped — capability '{}' not granted",
                registryId, node.getId(), requiredCap);
            return new NodeResult(outputs, "then");
        }

        switch (node.getType()) {

            case "action.note.create": {
                Note note = new Note();
                note.setTitle((String) inputs.getOrDefault("title", "Untitled"));
                note.setContent((String) inputs.getOrDefault("content", ""));
                note = noteService.save(note);
                outputs.put("note", note);
                return new NodeResult(outputs, "then");
            }

            case "action.tag.add": {
                Note note = (Note) inputs.get("note");
                String tagName = (String) inputs.get("tag");
                if (note != null && tagName != null && !tagName.isBlank()) {
                    Tag tag = tagService.createOrGetTag(tagName);
                    note.getTags().add(tag);
                    note = noteService.save(note);
                }
                outputs.put("note", note);
                return new NodeResult(outputs, "then");
            }

            case "action.note.anchor": {
                Note note = (Note) inputs.get("note");
                String txHash = "";
                if (note != null) {
                    try {
                        Map<String, Object> result = blockchainService.registerNote(
                            note.getContent() != null ? note.getContent() : "",
                            note.getTitle() != null ? note.getTitle() : "Untitled",
                            "system"
                        ).get(ACTION_TIMEOUT_SECS, TimeUnit.SECONDS);
                        Object hash = result.get("transactionHash");
                        txHash = hash != null ? hash.toString() : "";
                    } catch (Exception e) {
                        logger.warn("action.note.anchor: blockchain call failed — {}", e.getMessage());
                    }
                }
                outputs.put("txHash", txHash);
                return new NodeResult(outputs, "then");
            }

            case "action.ai.summarize": {
                Note note = (Note) inputs.get("note");
                String summary = "";
                if (note != null && note.getContent() != null && !note.getContent().isBlank()) {
                    try {
                        OpenAIService.SummaryOptions opts = OpenAIService.SummaryOptions.builder().build();
                        OpenAIService.SummaryResponse resp = openAIService.generateSummary(note.getContent(), opts);
                        summary = resp.getSummary() != null ? resp.getSummary() : "";
                    } catch (Exception e) {
                        logger.warn("action.ai.summarize: AI call failed — {}", e.getMessage());
                    }
                }
                outputs.put("summary", summary);
                return new NodeResult(outputs, "then");
            }

            case "action.code.execute": {
                String code = node.getConfig() != null
                    ? (String) node.getConfig().get("code") : null;
                if (code == null || code.isBlank()) {
                    logger.warn("action.code.execute: node '{}' has no 'code' config", node.getId());
                    outputs.put("output", "");
                    return new NodeResult(outputs, "then");
                }
                Note note = (Note) inputs.get("note");
                String title   = note != null && note.getTitle()   != null ? note.getTitle()   : "";
                String content = note != null && note.getContent() != null ? note.getContent() : "";
                String output;
                try {
                    output = sandboxedScriptService.execute(code, title, content);
                } catch (SandboxedScriptService.ScriptExecutionException e) {
                    logger.warn("action.code.execute: script error on node '{}' — {}", node.getId(), e.getMessage());
                    output = "";
                }
                outputs.put("output", output);
                return new NodeResult(outputs, "then");
            }

            case "action.audit.reaudit": {
                // Re-audit intake (#363): a fix-review note for the engagement,
                // tagged so it lands in the pipeline's Fix Review column.
                String engagement = String.valueOf(inputs.getOrDefault("engagement", "")).trim();
                Note note = new Note();
                note.setTitle("Re-audit — " + engagement + " (" + java.time.LocalDate.now() + ")");
                note.setContent("## Re-audit intake\n\nClient pushed fixes for `" + engagement
                    + "`.\n\nWebhook payload:\n\n```\n"
                    + String.valueOf(inputs.getOrDefault("payload", "")) + "\n```\n\n- [ ] Verify each fixed finding\n");
                if (!engagement.isEmpty()) {
                    note.getTags().add(tagService.createOrGetTag("engagement/" + engagement));
                }
                note.getTags().add(tagService.createOrGetTag("stage/fix-review"));
                note = noteService.save(note);
                outputs.put("note", note);
                return new NodeResult(outputs, "then");
            }

            case "action.audit.digest": {
                // Status digest (#363): finding counts by status for one engagement,
                // written as a digest note (delivery beyond the vault is a follow-up).
                String engagement = String.valueOf(inputs.getOrDefault("engagement", "")).trim();
                List<Note> engagementNotes = engagement.isEmpty()
                    ? Collections.emptyList()
                    : noteService.findByTag("engagement/" + engagement);
                Map<String, Integer> counts = AuditFenceParser.countByStatus(engagementNotes);
                String summary = AuditFenceParser.digestMarkdown(engagement, counts);
                Note digest = new Note();
                digest.setTitle("Status digest — " + engagement + " (" + java.time.LocalDate.now() + ")");
                digest.setContent(summary);
                if (!engagement.isEmpty()) {
                    digest.getTags().add(tagService.createOrGetTag("engagement/" + engagement));
                }
                digest = noteService.save(digest);
                outputs.put("summary", summary);
                outputs.put("note", digest);
                return new NodeResult(outputs, "then");
            }

            case "logic.branch": {
                Boolean condition = (Boolean) inputs.getOrDefault("condition", Boolean.FALSE);
                return new NodeResult(outputs, Boolean.TRUE.equals(condition) ? "true" : "false");
            }

            case "logic.notes.filter": {
                @SuppressWarnings("unchecked")
                List<Note> notes = (List<Note>) inputs.getOrDefault("notes", Collections.emptyList());
                String tag = (String) inputs.getOrDefault("tag", "");
                List<Note> filtered = notes.stream()
                    .filter(n -> n.getTags().stream().anyMatch(t -> tag.equals(t.getName())))
                    .collect(Collectors.toList());
                outputs.put("result", filtered);
                return new NodeResult(outputs, "then");
            }

            default:
                throw new UnsupportedOperationException("Unknown node type: " + node.getType());
        }
    }

    // -------------------------------------------------------------------------
    // Execution logging
    // -------------------------------------------------------------------------

    private void log(Long registryId, String execType, String status, String message, long durationMs) {
        try {
            jdbc.update(
                "INSERT INTO plugin_execution_logs (plugin_id, execution_type, status, message, execution_time_ms, created_at) " +
                "VALUES (?, ?, ?, ?, ?, ?)",
                registryId, execType, status, message, durationMs, LocalDateTime.now()
            );
        } catch (Exception e) {
            logger.warn("Failed to write execution log: {}", e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Support types
    // -------------------------------------------------------------------------

    private record NodeResult(Map<String, Object> outputs, String nextExecOut) {}

    private record ListenerRegistration(String eventType, PluginEventListener<? extends PluginEvent> listener) {}

    private record WebhookRegistration(BlueprintIRGraph graph, Long registryId, String triggerNodeId, String secret) {}
}
