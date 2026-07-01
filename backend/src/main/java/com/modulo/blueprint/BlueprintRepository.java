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

    public List<BlueprintEntry> findAll() {
        String sql = "SELECT id, name, description, version, config::text, created_at, updated_at " +
                     "FROM plugin_registry WHERE runtime = ? ORDER BY created_at";
        return jdbc.query(sql, (rs, i) -> {
            BlueprintEntry e = new BlueprintEntry();
            e.setId(rs.getLong("id"));
            e.setName(rs.getString("name"));
            e.setDescription(rs.getString("description"));
            e.setVersion(rs.getString("version"));
            e.setIr(parseConfig(rs.getString("config")));
            e.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
            e.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
            return e;
        }, RUNTIME);
    }

    public Optional<BlueprintEntry> findByName(String name) {
        String sql = "SELECT id, name, description, version, config::text, created_at, updated_at " +
                     "FROM plugin_registry WHERE runtime = ? AND name = ?";
        try {
            BlueprintEntry entry = jdbc.queryForObject(sql, (rs, i) -> {
                BlueprintEntry e = new BlueprintEntry();
                e.setId(rs.getLong("id"));
                e.setName(rs.getString("name"));
                e.setDescription(rs.getString("description"));
                e.setVersion(rs.getString("version"));
                e.setIr(parseConfig(rs.getString("config")));
                e.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime().toString());
                e.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime().toString());
                return e;
            }, RUNTIME, name);
            return Optional.ofNullable(entry);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public BlueprintEntry create(BlueprintSaveRequest req, String actor) {
        LocalDateTime now = LocalDateTime.now();
        String version = req.getVersion() != null ? req.getVersion() : "1";
        String irJson = toJson(req.getIr());

        Long id = jdbc.queryForObject(
            "INSERT INTO plugin_registry (name, version, description, author, type, runtime, status, config, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id",
            Long.class,
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
        entry.setName(req.getName());
        entry.setDescription(req.getDescription());
        entry.setVersion(version);
        entry.setIr(req.getIr());
        entry.setCreatedAt(now.toString());
        entry.setUpdatedAt(now.toString());
        return entry;
    }

    public Optional<BlueprintEntry> update(String name, BlueprintUpdateRequest req, String actor) {
        Optional<BlueprintEntry> existing = findByName(name);
        if (existing.isEmpty()) return Optional.empty();

        BlueprintEntry prev = existing.get();
        String prevJson = toJson(prev.getIr());
        String newJson = toJson(req.getIr());
        LocalDateTime now = LocalDateTime.now();

        jdbc.update(
            "UPDATE plugin_registry SET config = ?::jsonb, updated_at = ? WHERE runtime = ? AND name = ?",
            newJson, now, RUNTIME, name
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
        updated.setName(prev.getName());
        updated.setDescription(prev.getDescription());
        updated.setVersion(prev.getVersion());
        updated.setIr(req.getIr());
        updated.setCreatedAt(prev.getCreatedAt());
        updated.setUpdatedAt(now.toString());
        return Optional.of(updated);
    }

    public boolean delete(String name) {
        int rows = jdbc.update("DELETE FROM plugin_registry WHERE runtime = ? AND name = ?", RUNTIME, name);
        return rows > 0;
    }

    /**
     * Recent execution-log rows for a blueprint, newest first. Used by the editor's
     * run/debug panel to show run history and highlight the executed node path.
     */
    public List<BlueprintExecution> findExecutions(Long pluginId, int limit) {
        String sql = "SELECT execution_type, status, message, execution_time_ms, created_at " +
                     "FROM plugin_execution_logs WHERE plugin_id = ? ORDER BY created_at DESC, id DESC LIMIT ?";
        return jdbc.query(sql, (rs, i) -> {
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
        }, pluginId, limit);
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
            logger.warn("Failed to parse blueprint config JSON", e);
            return Map.of();
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to serialize blueprint IR to JSON", e);
            return "{}";
        }
    }
}
