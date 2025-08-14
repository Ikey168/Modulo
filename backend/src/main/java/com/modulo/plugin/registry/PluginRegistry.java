package com.modulo.plugin.registry;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.manager.PluginStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Plugin registry for managing plugin metadata and configuration
 */
@Repository
public class PluginRegistry {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginRegistry.class);
    
    @Autowired
    private JdbcTemplate jdbcTemplate;
    
    private final RowMapper<PluginRegistryEntry> entryRowMapper = new PluginRegistryEntryRowMapper();
    
    /**
     * Register a new plugin
     * @param plugin Plugin to register
     * @param config Plugin configuration
     * @return Registry entry ID
     */
    public Long registerPlugin(Plugin plugin, Map<String, Object> config) {
        logger.info("Registering plugin: {}", plugin.getInfo().getName());
        
        String sql = """
            INSERT INTO plugin_registry (name, version, description, author, type, runtime, status, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
            """;
        
        LocalDateTime now = LocalDateTime.now();
        String configJson = config != null ? convertToJson(config) : "{}";
        
        Long id = jdbcTemplate.queryForObject(
            sql + " RETURNING id",
            Long.class,
            plugin.getInfo().getName(),
            plugin.getInfo().getVersion(),
            plugin.getInfo().getDescription(),
            plugin.getInfo().getAuthor(),
            plugin.getInfo().getType().name(),
            plugin.getInfo().getRuntime().name(),
            PluginStatus.ACTIVE.name(),
            configJson,
            now,
            now
        );
        
        // Register plugin events
        registerPluginEvents(id, plugin);
        
        // Register plugin permissions
        registerPluginPermissions(id, plugin);
        
        logger.info("Plugin {} registered with ID: {}", plugin.getInfo().getName(), id);
        return id;
    }
    
    /**
     * Unregister a plugin
     * @param pluginId Plugin ID
     */
    public void unregisterPlugin(String pluginId) {
        logger.info("Unregistering plugin: {}", pluginId);
        
        // Delete plugin permissions
        jdbcTemplate.update("DELETE FROM plugin_permissions WHERE plugin_id = (SELECT id FROM plugin_registry WHERE name = ?)", pluginId);
        
        // Delete plugin events
        jdbcTemplate.update("DELETE FROM plugin_events WHERE plugin_id = (SELECT id FROM plugin_registry WHERE name = ?)", pluginId);
        
        // Delete plugin registry entry
        jdbcTemplate.update("DELETE FROM plugin_registry WHERE name = ?", pluginId);
        
        logger.info("Plugin {} unregistered", pluginId);
    }
    
    /**
     * Get plugin registry entry by name
     * @param name Plugin name
     * @return Optional registry entry
     */
    public Optional<PluginRegistryEntry> getByName(String name) {
        String sql = "SELECT * FROM plugin_registry WHERE name = ?";
        
        try {
            PluginRegistryEntry entry = jdbcTemplate.queryForObject(sql, entryRowMapper, name);
            return Optional.ofNullable(entry);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    
    /**
     * Get all registered plugins
     * @return List of registry entries
     */
    public List<PluginRegistryEntry> getAllRegisteredPlugins() {
        String sql = "SELECT * FROM plugin_registry ORDER BY created_at";
        return jdbcTemplate.query(sql, entryRowMapper);
    }
    
    /**
     * Get plugins by status
     * @param status Plugin status
     * @return List of registry entries
     */
    public List<PluginRegistryEntry> getPluginsByStatus(PluginStatus status) {
        String sql = "SELECT * FROM plugin_registry WHERE status = ? ORDER BY created_at";
        return jdbcTemplate.query(sql, entryRowMapper, status.name());
    }
    
    /**
     * Update plugin status
     * @param pluginId Plugin ID
     * @param status New status
     */
    public void updatePluginStatus(String pluginId, PluginStatus status) {
        String sql = "UPDATE plugin_registry SET status = ?, updated_at = ? WHERE name = ?";
        jdbcTemplate.update(sql, status.name(), LocalDateTime.now(), pluginId);
        logger.debug("Updated plugin {} status to {}", pluginId, status);
    }
    
    /**
     * Update plugin configuration
     * @param pluginId Plugin ID
     * @param config New configuration
     */
    public void updatePluginConfig(String pluginId, Map<String, Object> config) {
        String sql = "UPDATE plugin_registry SET config = ?::jsonb, updated_at = ? WHERE name = ?";
        String configJson = config != null ? convertToJson(config) : "{}";
        jdbcTemplate.update(sql, configJson, LocalDateTime.now(), pluginId);
        logger.debug("Updated plugin {} configuration", pluginId);
    }
    
    /**
     * Get plugin events
     * @param pluginId Plugin ID
     * @return List of plugin events
     */
    public List<PluginEventEntry> getPluginEvents(String pluginId) {
        String sql = """
            SELECT pe.* FROM plugin_events pe
            JOIN plugin_registry pr ON pe.plugin_id = pr.id
            WHERE pr.name = ?
            """;
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PluginEventEntry entry = new PluginEventEntry();
            entry.setId(rs.getLong("id"));
            entry.setPluginId(rs.getLong("plugin_id"));
            entry.setEventType(rs.getString("event_type"));
            entry.setEventAction(rs.getString("event_action"));
            entry.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
            return entry;
        }, pluginId);
    }
    
    /**
     * Get plugin permissions
     * @param pluginId Plugin ID
     * @return List of plugin permissions
     */
    public List<PluginPermissionEntry> getPluginPermissions(String pluginId) {
        String sql = """
            SELECT pp.* FROM plugin_permissions pp
            JOIN plugin_registry pr ON pp.plugin_id = pr.id
            WHERE pr.name = ?
            """;
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PluginPermissionEntry entry = new PluginPermissionEntry();
            entry.setId(rs.getLong("id"));
            entry.setPluginId(rs.getLong("plugin_id"));
            entry.setPermission(rs.getString("permission"));
            entry.setGranted(rs.getBoolean("granted"));
            entry.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
            return entry;
        }, pluginId);
    }
    
    /**
     * Register plugin events
     */
    private void registerPluginEvents(Long pluginId, Plugin plugin) {
        // Register subscribed events
        List<String> subscribedEvents = plugin.getSubscribedEvents();
        if (subscribedEvents != null) {
            for (String eventType : subscribedEvents) {
                jdbcTemplate.update(
                    "INSERT INTO plugin_events (plugin_id, event_type, event_action, created_at) VALUES (?, ?, ?, ?)",
                    pluginId, eventType, "subscribe", LocalDateTime.now()
                );
            }
        }
        
        // Register published events
        List<String> publishedEvents = plugin.getPublishedEvents();
        if (publishedEvents != null) {
            for (String eventType : publishedEvents) {
                jdbcTemplate.update(
                    "INSERT INTO plugin_events (plugin_id, event_type, event_action, created_at) VALUES (?, ?, ?, ?)",
                    pluginId, eventType, "publish", LocalDateTime.now()
                );
            }
        }
    }
    
    /**
     * Register plugin permissions
     */
    private void registerPluginPermissions(Long pluginId, Plugin plugin) {
        List<String> requiredPermissions = plugin.getRequiredPermissions();
        if (requiredPermissions != null) {
            for (String permission : requiredPermissions) {
                jdbcTemplate.update(
                    "INSERT INTO plugin_permissions (plugin_id, permission, granted, created_at) VALUES (?, ?, ?, ?)",
                    pluginId, permission, true, LocalDateTime.now()
                );
            }
        }
    }
    
    /**
     * Convert map to JSON string (simplified implementation)
     */
    private String convertToJson(Map<String, Object> map) {
        // In a real implementation, use a proper JSON library like Jackson
        // For now, return a simple JSON representation
        if (map.isEmpty()) {
            return "{}";
        }
        
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) json.append(",");
            json.append("\"").append(entry.getKey()).append("\":");
            if (entry.getValue() instanceof String) {
                json.append("\"").append(entry.getValue()).append("\"");
            } else {
                json.append(entry.getValue());
            }
            first = false;
        }
        json.append("}");
        return json.toString();
    }
    
    /**
     * Row mapper for plugin registry entries
     */
    private static class PluginRegistryEntryRowMapper implements RowMapper<PluginRegistryEntry> {
        @Override
        public PluginRegistryEntry mapRow(ResultSet rs, int rowNum) throws SQLException {
            PluginRegistryEntry entry = new PluginRegistryEntry();
            entry.setId(rs.getLong("id"));
            entry.setName(rs.getString("name"));
            entry.setVersion(rs.getString("version"));
            entry.setDescription(rs.getString("description"));
            entry.setAuthor(rs.getString("author"));
            entry.setType(rs.getString("type"));
            entry.setRuntime(rs.getString("runtime"));
            entry.setStatus(PluginStatus.valueOf(rs.getString("status")));
            entry.setPath(rs.getString("path"));
            entry.setEndpoint(rs.getString("endpoint"));
            // Note: In a real implementation, parse JSON config properly
            entry.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
            entry.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
            return entry;
        }
    }
}
