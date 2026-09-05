package com.modulo.blueprint;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * JDBC repository for blueprints stored in plugin_registry (runtime = 'BLUEPRINT').
 * Config updates are recorded in plugin_config_history for version tracking.
 */
@Repository
public class BlueprintRepository {

    private static final Logger logger = LoggerFactory.getLogger(BlueprintRepository.class);
    private static final String RUNTIME = "BLUEPRINT";
    private static final String TYPE = "INTERNAL";
    private static final String STATUS = "ACTIVE";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired private com.modulo.security.AuthenticatedUserService users;

    public List<BlueprintEntry> findAll() { return findOwned(users.requireUserId()); }

    /** Trusted scheduler inventory; never exposed through the owner-facing controller. */
    public List<BlueprintEntry> findRunnable() { return findOwned(null); }

    private List<BlueprintEntry> findOwned(Long owner) {
        String sql = "SELECT id, owner_id, COALESCE(blueprint_name,name) AS name, description, version, config::text, created_at, updated_at " +
                     "FROM plugin_registry WHERE runtime = ? AND owner_id IS NOT NULL" + (owner == null ? " AND status='ACTIVE'" : " AND owner_id=?") + " ORDER BY created_at";
        return jdbc.query(sql, (rs, i) -> {
            BlueprintEntry e = new BlueprintEntry();
            e.setId(rs.getLong("id"));
            e.setOwnerId(rs.getLong("owner_id"));
            e.setName(rs.getString("name"));
            e.setDescription(rs.getString("description"));
            e.setVersion(rs.getString("version"));
            e.setIr(parseConfig(rs.getString("config")));
            e.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
            e.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
            return e;
        }, owner == null ? new Object[]{RUNTIME} : new Object[]{RUNTIME,owner});
    }

    public Optional<BlueprintEntry> findByName(String name) {
        long owner = users.requireUserId();
        String sql = "SELECT id, owner_id, COALESCE(blueprint_name,name) AS name, description, version, config::text, created_at, updated_at " +
                     "FROM plugin_registry WHERE runtime = ? AND owner_id=? AND COALESCE(blueprint_name,name) = ?";
        try {
            BlueprintEntry entry = jdbc.queryForObject(sql, (rs, i) -> {
                BlueprintEntry e = new BlueprintEntry();
                e.setId(rs.getLong("id"));
            e.setOwnerId(rs.getLong("owner_id"));
                e.setName(rs.getString("name"));
                e.setDescription(rs.getString("description"));
                e.setVersion(rs.getString("version"));
                e.setIr(parseConfig(rs.getString("config")));
                e.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
                e.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
                return e;
            }, RUNTIME, owner, name);
            return Optional.ofNullable(entry);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public BlueprintEntry create(BlueprintSaveRequest req, String actor) {
        long owner=users.requireUserId();
        actor=Long.toString(owner);
        if(req.getName()==null || req.getName().isBlank() || req.getName().length()>128 || req.getName().contains("/") || req.getName().contains("\\") || req.getName().chars().anyMatch(Character::isISOControl)) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"INVALID_BLUEPRINT_NAME");
        LocalDateTime now = LocalDateTime.now();
        String version = req.getVersion() != null ? req.getVersion() : "1";
        validateIr(req.getIr());
        String irJson = toJson(req.getIr());

        Long id = jdbc.queryForObject(
            "INSERT INTO plugin_registry (name, owner_id, blueprint_name, version, description, author, type, runtime, status, config, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id",
            Long.class,
            "blueprint."+java.util.UUID.randomUUID(),
            owner,
            req.getName(),
            version,
            req.getDescription(),
            actor,
            TYPE,
            RUNTIME,
            STATUS,
            irJson,
            now,
            now
        );

        BlueprintEntry entry = new BlueprintEntry();
        entry.setId(id);
        entry.setOwnerId(owner);
        entry.setName(req.getName());
        entry.setDescription(req.getDescription());
        entry.setVersion(version);
        entry.setIr(req.getIr());
        entry.setCreatedAt(now.toString());
        entry.setUpdatedAt(now.toString());
        return entry;
    }

    @org.springframework.transaction.annotation.Transactional
    public Optional<BlueprintEntry> update(String name, BlueprintUpdateRequest req, String actor) {
        actor=users.actor();
        Optional<BlueprintEntry> existing = findByName(name);
        if (existing.isEmpty()) return Optional.empty();

        BlueprintEntry prev = existing.get();
        String prevJson = toJson(prev.getIr());
        validateIr(req.getIr());
        String newJson = toJson(req.getIr());
        LocalDateTime now = LocalDateTime.now();

        jdbc.update(
            "UPDATE plugin_registry SET config = ?::jsonb, updated_at = ? WHERE runtime = ? AND id = ? AND owner_id=?",
            newJson, now, RUNTIME, prev.getId(), prev.getOwnerId()
        );

        jdbc.update(
            "INSERT INTO plugin_config_history (plugin_id, config_before, config_after, changed_by, change_reason, created_at) " +
            "VALUES (?, ?::jsonb, ?::jsonb, ?, ?, ?)",
            prev.getId(), prevJson, newJson, actor,
            req.getChangeReason() != null ? req.getChangeReason() : "Blueprint updated",
            now
        );

        BlueprintEntry updated = new BlueprintEntry();
        updated.setId(prev.getId());
        updated.setOwnerId(prev.getOwnerId());
        updated.setName(prev.getName());
        updated.setDescription(prev.getDescription());
        updated.setVersion(prev.getVersion());
        updated.setIr(req.getIr());
        updated.setCreatedAt(prev.getCreatedAt());
        updated.setUpdatedAt(now.toString());
        return Optional.of(updated);
    }

    public boolean delete(String name) {
        int rows = jdbc.update("DELETE FROM plugin_registry WHERE runtime = ? AND owner_id=? AND COALESCE(blueprint_name,name) = ?", RUNTIME, users.requireUserId(), name);
        return rows > 0;
    }

    /**
     * Recent execution-log rows for a blueprint, newest first. Used by the editor's
     * run/debug panel to show run history and highlight the executed node path.
     */
    public List<BlueprintExecution> findExecutions(Long pluginId, int limit) {
        long owner=users.requireUserId();
        int bounded=Math.max(1,Math.min(200,limit));
        List<BlueprintExecution> structured=jdbc.query("SELECT id,state,started_at,finished_at,created_at FROM workflow_runs WHERE blueprint_id=? AND owner_id=? ORDER BY created_at DESC,id DESC LIMIT ?",(rs,row)->{
            var execution=new BlueprintExecution();
            java.util.UUID id=rs.getObject("id",java.util.UUID.class);
            execution.setRunId(id.toString()); execution.setExecutionType("workflow_run");
            String state=rs.getString("state"); execution.setStatus(state.equals("SUCCEEDED")?"success":state.equals("FAILED")?"error":state.toLowerCase(java.util.Locale.ROOT));
            execution.setMessage("Workflow run "+id);
            execution.setExecutedNodes(jdbc.queryForList("SELECT node_id FROM workflow_steps WHERE run_id=? ORDER BY attempt,sequence",String.class,id));
            var started=rs.getTimestamp("started_at");var finished=rs.getTimestamp("finished_at");
            if(started!=null && finished!=null) execution.setExecutionTimeMs(finished.getTime()-started.getTime());
            execution.setCreatedAt(rs.getTimestamp("created_at").toInstant().toString());return execution;
        },pluginId,owner,bounded);
        if(structured.size()==bounded) return structured;
        String sql = "SELECT execution_type, status, message, execution_time_ms, created_at " +
                     "FROM plugin_execution_logs WHERE plugin_id = ? AND plugin_id IN (SELECT id FROM plugin_registry WHERE owner_id=? AND runtime='BLUEPRINT') ORDER BY created_at DESC, id DESC LIMIT ?";
        var legacy=jdbc.query(sql, (rs, i) -> {
            BlueprintExecution e = new BlueprintExecution();
            e.setExecutionType(rs.getString("execution_type"));
            e.setStatus(rs.getString("status"));
            String message = rs.getString("message");
            e.setMessage(message);
            e.setExecutedNodes(parseExecutedNodes(message));
            long ms = rs.getLong("execution_time_ms");
            e.setExecutionTimeMs(rs.wasNull() ? null : ms);
            e.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
            return e;
        }, pluginId, owner, bounded-structured.size());
        var result=new java.util.ArrayList<>(structured);result.addAll(legacy);return result;
    }

    /** Extract node ids from the {@code [nodes=a,b,c]} token the interpreter writes on success. */
    static List<String> parseExecutedNodes(String message) {
        if (message == null) return List.of();
        int start = message.indexOf("[nodes=");
        if (start < 0) return List.of();
        int end = message.indexOf(']', start);
        if (end < 0) return List.of();
        String body = message.substring(start + "[nodes=".length(), end).trim();
        if (body.isEmpty()) return List.of();
        return Arrays.stream(body.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to parse blueprint config JSON");
            return Map.of();
        }
    }

    private void validateIr(Map<String,Object> ir) {
        try {
            if(ir==null || toJson(ir).getBytes(java.nio.charset.StandardCharsets.UTF_8).length>1_048_576) throw new IllegalArgumentException();
            var graph=objectMapper.convertValue(ir,com.modulo.blueprint.interpreter.BlueprintIRGraph.class);
            if(graph.getNodes()==null || graph.getEdges()==null || graph.getNodes().size()>1000 || graph.getEdges().size()>5000) throw new IllegalArgumentException();
            var ids=new java.util.HashSet<String>();
            for(var node:graph.getNodes()) if(node.getId()==null || !node.getId().matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}") || !ids.add(node.getId()) || node.getType()==null || node.getType().length()>128) throw new IllegalArgumentException();
            for(var edge:graph.getEdges()) if(!ids.contains(edge.getFromNode()) || !ids.contains(edge.getToNode())) throw new IllegalArgumentException();
        } catch(IllegalArgumentException invalid) { throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"INVALID_BLUEPRINT_IR"); }
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to serialize blueprint IR to JSON");
            return "{}";
        }
    }
}
