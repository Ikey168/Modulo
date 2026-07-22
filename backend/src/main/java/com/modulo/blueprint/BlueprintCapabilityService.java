package com.modulo.blueprint;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Derives, persists, and enforces the capability requirements for blueprint nodes (#275).
 *
 * Node capabilities are declared on each node descriptor (e.g. {@code notes:write},
 * {@code ai:invoke}). A blueprint's required permissions are the union of all its
 * nodes' capabilities. On install/update they are written to {@code plugin_permissions}
 * (granted = false initially). A user or admin must then grant them via the consent
 * endpoint; the interpreter checks grants before executing each node.
 */
@Service
public class BlueprintCapabilityService {

    private static final Logger logger = LoggerFactory.getLogger(BlueprintCapabilityService.class);

    /**
     * Maps node type prefixes to the capability they require. Mirrors the
     * {@code capability} field declared on each NodeDescriptor in the frontend catalog.
     * Used by the backend to derive requirements without depending on the TS source.
     */
    public static final Map<String, String> NODE_CAPABILITY_MAP = Map.ofEntries(
        Map.entry("action.note.create",          "notes:write"),
        Map.entry("action.tag.add",              "notes:write"),
        Map.entry("action.note.anchor",          "blockchain:anchor"),
        Map.entry("action.ai.summarize",         "ai:invoke"),
        Map.entry("action.code.execute",         "code:execute"),
        Map.entry("action.wasm.execute",         "wasm:execute"),
        Map.entry("action.audit.reaudit",        "notes:write"),
        Map.entry("action.audit.digest",         "notes:write"),
        Map.entry("action.tax.deadline.reminder", "notes:write"),
        Map.entry("action.invoice.chase",        "notes:write"),
        Map.entry("action.vies.check",           "network:vies"),
        Map.entry("action.noesis.brief",         "network:noesis")
    );

    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Capability derivation
    // -------------------------------------------------------------------------

    /**
     * Derive the set of capability strings required by this IR graph.
     * Trigger and logic nodes don't carry capabilities; only actions do.
     */
    public Set<String> deriveRequiredCapabilities(BlueprintIRGraph graph) {
        return graph.getNodes().stream()
            .map(n -> NODE_CAPABILITY_MAP.get(n.getType()))
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    // -------------------------------------------------------------------------
    // Persistence (plugin_permissions)
    // -------------------------------------------------------------------------

    /**
     * Synchronise the required capabilities for a blueprint into {@code plugin_permissions}.
     *
     * - New capabilities are inserted with {@code granted = false}.
     * - Capabilities no longer required are removed.
     * - Previously-granted capabilities that are still required are untouched.
     */
    public void syncPermissions(Long pluginId, Set<String> required) {
        // Fetch current grants
        Map<String, Boolean> existing = new LinkedHashMap<>();
        jdbc.query(
            "SELECT permission, granted FROM plugin_permissions WHERE plugin_id = ?",
            rs -> { existing.put(rs.getString("permission"), rs.getBoolean("granted")); },
            pluginId
        );

        Set<String> toAdd = new LinkedHashSet<>(required);
        toAdd.removeAll(existing.keySet());

        Set<String> toRemove = new LinkedHashSet<>(existing.keySet());
        toRemove.removeAll(required);

        for (String cap : toAdd) {
            jdbc.update(
                "INSERT INTO plugin_permissions (plugin_id, permission, granted, created_at) VALUES (?, ?, false, ?)",
                pluginId, cap, LocalDateTime.now()
            );
            logger.debug("Blueprint {}: added required capability '{}'", pluginId, cap);
        }

        for (String cap : toRemove) {
            jdbc.update(
                "DELETE FROM plugin_permissions WHERE plugin_id = ? AND permission = ?",
                pluginId, cap
            );
            logger.debug("Blueprint {}: removed obsolete capability '{}'", pluginId, cap);
        }
    }

    /**
     * Grant or revoke a specific capability for a blueprint.
     * Returns {@code false} when the capability is not in the blueprint's required list.
     */
    public boolean setGranted(Long pluginId, String capability, boolean granted) {
        int rows = jdbc.update(
            "UPDATE plugin_permissions SET granted = ? WHERE plugin_id = ? AND permission = ?",
            granted, pluginId, capability
        );
        if (rows == 0) {
            logger.warn("Attempt to set granted={} for unknown capability '{}' on blueprint {}", granted, capability, pluginId);
        }
        return rows > 0;
    }

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    /** Returns the permission rows for a blueprint, ordered by capability name. */
    public List<BlueprintPermission> getPermissions(Long pluginId) {
        return jdbc.query(
            "SELECT permission, granted FROM plugin_permissions WHERE plugin_id = ? ORDER BY permission",
            (rs, i) -> new BlueprintPermission(rs.getString("permission"), rs.getBoolean("granted")),
            pluginId
        );
    }

    /** Returns the set of capability strings that are granted for this blueprint. */
    public Set<String> grantedCapabilities(Long pluginId) {
        return jdbc.query(
            "SELECT permission FROM plugin_permissions WHERE plugin_id = ? AND granted = true",
            (rs, i) -> rs.getString("permission"),
            pluginId
        ).stream().collect(Collectors.toSet());
    }

    // -------------------------------------------------------------------------
    // Enforcement
    // -------------------------------------------------------------------------

    /**
     * Check that the blueprint holds a grant for {@code capability}.
     * If not, logs a security warning and returns false; the interpreter
     * must then skip or fail-safe the node rather than executing it.
     */
    public boolean isGranted(Long pluginId, String capability) {
        if (capability == null) return true; // no requirement
        List<Boolean> rows = jdbc.queryForList(
            "SELECT granted FROM plugin_permissions WHERE plugin_id = ? AND permission = ? LIMIT 1",
            Boolean.class, pluginId, capability
        );
        boolean granted = !rows.isEmpty() && Boolean.TRUE.equals(rows.get(0));
        if (!granted) {
            logger.warn("Blueprint {} denied: capability '{}' not granted", pluginId, capability);
        }
        return granted;
    }

    // -------------------------------------------------------------------------
    // IR deserialization helper
    // -------------------------------------------------------------------------

    /** Deserialise the raw IR map stored in plugin_registry.config into a graph object. */
    public BlueprintIRGraph toGraph(Object ir) {
        try {
            return objectMapper.convertValue(ir, BlueprintIRGraph.class);
        } catch (Exception e) {
            logger.warn("Failed to deserialise blueprint IR: {}", e.getMessage());
            BlueprintIRGraph empty = new BlueprintIRGraph();
            return empty;
        }
    }

    // -------------------------------------------------------------------------
    // DTO
    // -------------------------------------------------------------------------

    public record BlueprintPermission(String capability, boolean granted) {}
}
