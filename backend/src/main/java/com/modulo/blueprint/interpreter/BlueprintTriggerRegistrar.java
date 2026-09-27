package com.modulo.blueprint.interpreter;

import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.BlueprintNodeRegistration;
import com.modulo.blueprint.BlueprintNodeRegistry;
import com.modulo.blueprint.BlueprintTriggerContext;
import com.modulo.blueprint.BlueprintTriggerHandler;
import com.modulo.note.Note;
import com.modulo.plugin.event.LinkEvent;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.event.PluginEvent;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.PluginEventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Wires the trigger nodes of registered blueprints: event-bus listeners for note,
 * link and plugin triggers, instance-local webhook endpoints (#363), and the
 * persisted schedule (through {@code WorkflowScheduler}). A fired trigger starts a
 * run through {@link BlueprintGraphRunner}.
 */
final class BlueprintTriggerRegistrar {

    // Log under the interpreter's category so existing log configuration keeps applying.
    private static final Logger logger = LoggerFactory.getLogger(BlueprintInterpreterService.class);

    private final InterpreterDependencies deps;
    private final BlueprintGraphRunner runner;

    private final Map<Long, BlueprintEntry> runtimeEntries = new ConcurrentHashMap<>();

    // Per-blueprint listener registrations so they can be removed on unregister.
    private final Map<String, List<ListenerRegistration>> registeredListeners = new ConcurrentHashMap<>();

    // Webhook trigger registrations (#363): "<registryId>:<nodeId>" → registration,
    // plus per-blueprint keys so unregister removes exactly its endpoints.
    private final Map<String, WebhookRegistration> webhooks = new ConcurrentHashMap<>();
    private final Map<String, List<String>> webhookKeysByBlueprint = new ConcurrentHashMap<>();

    BlueprintTriggerRegistrar(InterpreterDependencies deps, BlueprintGraphRunner runner) {
        this.deps = deps;
        this.runner = runner;
    }

    /** The blueprints currently registered on this instance. */
    List<BlueprintEntry> registeredEntries() {
        return new ArrayList<>(runtimeEntries.values());
    }

    void register(BlueprintEntry entry) {
        // Remove previous registrations for this blueprint in case of re-register.
        unregister(Long.toString(entry.getId()));
        if (entry.getOwnerId() == null) return;
        runtimeEntries.put(entry.getId(), entry);

        BlueprintIRGraph graph;
        try {
            graph = deps.objectMapper().convertValue(entry.getIr(), BlueprintIRGraph.class);
            if (graph.getNodes() == null || graph.getEdges() == null || graph.getNodes().size() > 1000 || graph.getEdges().size() > 5000) {
                throw new IllegalArgumentException("Invalid Blueprint graph");
            }
        } catch (Exception e) {
            logger.error("Blueprint IR rejected");
            return;
        }

        PluginEventBus eventBus = deps.eventBus();
        Long registryId = entry.getId();
        boolean manualOnly = "MANUAL".equals(entry.getAutonomyLevel());
        List<ListenerRegistration> listeners = new ArrayList<>();

        for (BlueprintIRGraph.IRNode node : graph.getNodes()) {
            if (!node.getType().startsWith("trigger.")) continue;
            if (manualOnly && !"trigger.manual".equals(node.getType())) continue;

            switch (node.getType()) {
                case "trigger.manual":
                    // Manual triggers are invoked through fireManual().
                    break;
                case "trigger.note.saved": {
                    String triggerId = node.getId();
                    PluginEventListener<NoteEvent> listener = event -> {
                        if (ownedNote(event.getNote(), entry.getOwnerId())) {
                            dispatch(graph, registryId, triggerId, Map.of("note", event.getNote()), event.getId());
                        }
                    };
                    eventBus.subscribe("note.created", listener);
                    eventBus.subscribe("note.updated", listener);
                    listeners.add(new ListenerRegistration("note.created", listener));
                    listeners.add(new ListenerRegistration("note.updated", listener));
                    break;
                }
                case "trigger.link.created": {
                    String triggerId = node.getId();
                    PluginEventListener<LinkEvent.LinkCreated> listener = event -> {
                        if (ownedNote(event.getSourceNote(), entry.getOwnerId()) && ownedNote(event.getTargetNote(), entry.getOwnerId())) {
                            dispatch(graph, registryId, triggerId, Map.of(
                                "link", event.getLink(), "source", event.getSourceNote(), "target", event.getTargetNote()), event.getId());
                        }
                    };
                    eventBus.subscribe("link.created", listener);
                    listeners.add(new ListenerRegistration("link.created", listener));
                    break;
                }
                case "trigger.schedule": {
                    String cron = node.getConfig() != null
                        ? (String) node.getConfig().get("cron") : null;
                    if (cron == null || cron.isBlank()) {
                        logger.warn("Blueprint schedule missing cron configuration");
                        break;
                    }
                    // Persisted scheduler registration occurs once the graph is registered.
                    break;
                }
                case "trigger.webhook": {
                    String secret = node.getConfig() != null
                        ? (String) node.getConfig().get("secret") : null;
                    if (secret == null || secret.isBlank()) {
                        logger.warn("Blueprint webhook missing secret configuration");
                        break;
                    }
                    String key = registryId + ":" + node.getId();
                    webhooks.put(key, new WebhookRegistration(graph, registryId, node.getId(), secret));
                    webhookKeysByBlueprint.computeIfAbsent(Long.toString(entry.getId()), k -> new ArrayList<>()).add(key);
                    logger.info("Blueprint webhook registered");
                    break;
                }
                default: {
                    if (!registerPluginTrigger(node, graph, registryId, entry.getOwnerId(), listeners)) {
                        logger.warn("Blueprint trigger type unsupported");
                    }
                    break;
                }
            }
        }

        registeredListeners.put(Long.toString(entry.getId()), listeners);
        if (deps.workflowScheduler() != null) deps.workflowScheduler().sync(entry, graph);
        logger.info("Blueprint registered");
    }

    private boolean registerPluginTrigger(
            BlueprintIRGraph.IRNode node,
            BlueprintIRGraph graph,
            Long registryId,
            long ownerId,
            List<ListenerRegistration> listeners) {
        BlueprintNodeRegistry nodeRegistry = deps.nodeRegistry();
        if (nodeRegistry == null) return false;
        Optional<BlueprintNodeRegistration> registration =
            nodeRegistry.trigger(node.getType(), node.getNodeVersion());
        if (registration.isEmpty()) return false;

        BlueprintTriggerHandler handler = registration.get().triggerHandler();
        for (String eventType : registration.get().triggerEventTypes()) {
            PluginEventListener<PluginEvent> listener = event -> {
                Map<String, Object> outputs = handler.outputs(new BlueprintTriggerContext(
                    event,
                    node.getId(),
                    node.getType(),
                    node.getNodeVersion(),
                    node.getConfig(),
                    ownerId));
                if (outputs != null) {
                    dispatch(graph, registryId, node.getId(), outputs, event.getId());
                }
            };
            deps.eventBus().subscribe(eventType, listener);
            listeners.add(new ListenerRegistration(eventType, listener));
        }
        return true;
    }

    /** Unregister instance-local event and webhook listeners. */
    void unregister(String name) {
        try { runtimeEntries.remove(Long.parseLong(name)); } catch (NumberFormatException ignored) { return; }
        List<ListenerRegistration> listeners = registeredListeners.remove(name);
        if (listeners != null) {
            listeners.forEach(r -> deps.eventBus().unsubscribe(r.eventType(), r.listener()));
        }
        List<String> webhookKeys = webhookKeysByBlueprint.remove(name);
        if (webhookKeys != null) {
            webhookKeys.forEach(webhooks::remove);
        }
    }

    /**
     * Fire a registered trigger.webhook node. The secret is compared in constant
     * time; unknown endpoints and wrong secrets are indistinguishable to the caller.
     */
    BlueprintInterpreterService.WebhookResult fireWebhook(Long registryId, String nodeId, String secret,
                                                          String payload, String deliveryId) {
        if (deliveryId == null || deliveryId.isBlank() || deliveryId.length() > 128 || deliveryId.chars().anyMatch(Character::isISOControl)) {
            return BlueprintInterpreterService.WebhookResult.REJECTED;
        }
        WebhookRegistration reg = webhooks.get(registryId + ":" + nodeId);
        if (reg == null || secret == null) return BlueprintInterpreterService.WebhookResult.REJECTED;
        boolean valid = java.security.MessageDigest.isEqual(
            reg.secret().getBytes(java.nio.charset.StandardCharsets.UTF_8),
            secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (!valid) {
            logger.warn("Blueprint webhook authentication rejected");
            return BlueprintInterpreterService.WebhookResult.REJECTED;
        }
        dispatch(reg.graph(), reg.registryId(), reg.triggerNodeId(), Map.of("payload", payload), "webhook:" + deliveryId);
        return BlueprintInterpreterService.WebhookResult.ACCEPTED;
    }

    static boolean ownedNote(Note note, Long owner) {
        return note != null && Objects.equals(note.getUserId(), owner);
    }

    private UUID dispatch(BlueprintIRGraph graph, Long registryId,
                          String triggerNodeId, Map<String, Object> triggerOutputs, String triggerKey) {
        BlueprintEntry entry = runtimeEntries.get(registryId);
        if (entry == null || entry.getOwnerId() == null) return null;
        return runner.execute(graph, entry, triggerNodeId, triggerOutputs, triggerKey);
    }

    private record ListenerRegistration(String eventType, PluginEventListener<? extends PluginEvent> listener) {}

    private record WebhookRegistration(BlueprintIRGraph graph, Long registryId, String triggerNodeId, String secret) {}
}
