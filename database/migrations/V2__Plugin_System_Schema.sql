-- Plugin System Database Schema
-- Migration for adding plugin management tables and updating existing entities

-- Update notes table for plugin system support
ALTER TABLE application.notes ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE application.notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE application.notes ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP;

-- Create note metadata table
CREATE TABLE IF NOT EXISTS application.note_metadata (
    note_id BIGINT NOT NULL,
    metadata_key VARCHAR(255) NOT NULL,
    metadata_value TEXT,
    PRIMARY KEY (note_id, metadata_key),
    FOREIGN KEY (note_id) REFERENCES application.notes(note_id) ON DELETE CASCADE
);

-- Update users table for plugin system support  
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create user custom attributes table
CREATE TABLE IF NOT EXISTS user_custom_attributes (
    user_id BIGINT NOT NULL,
    attribute_key VARCHAR(255) NOT NULL,
    attribute_value TEXT,
    PRIMARY KEY (user_id, attribute_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id BIGINT NOT NULL,
    preference_key VARCHAR(255) NOT NULL,
    preference_value TEXT,
    PRIMARY KEY (user_id, preference_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plugin registry table for storing plugin metadata
CREATE TABLE IF NOT EXISTS plugin_registry (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    type VARCHAR(50) NOT NULL, -- INTERNAL, EXTERNAL
    runtime VARCHAR(50) NOT NULL, -- JAR, GRPC, REST, MESSAGE_QUEUE
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE', -- ACTIVE, INACTIVE, ERROR, INSTALLING, UNINSTALLING, UNKNOWN
    path VARCHAR(500), -- Path to plugin file/directory
    endpoint VARCHAR(500), -- Endpoint URL for external plugins
    config JSONB DEFAULT '{}', -- Plugin configuration
    config_schema JSONB DEFAULT '{}', -- Configuration schema
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Plugin events table for tracking event subscriptions and publications
CREATE TABLE IF NOT EXISTS plugin_events (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    event_action VARCHAR(50) NOT NULL, -- 'subscribe' or 'publish'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plugin_id, event_type, event_action)
);

-- Plugin permissions table for tracking granted permissions
CREATE TABLE IF NOT EXISTS plugin_permissions (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL,
    granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plugin_id, permission)
);

-- Plugin execution logs table for auditing and monitoring
CREATE TABLE IF NOT EXISTS plugin_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    execution_type VARCHAR(50) NOT NULL, -- 'start', 'stop', 'event_handle', 'api_call'
    status VARCHAR(50) NOT NULL, -- 'success', 'error', 'timeout'
    message TEXT,
    execution_time_ms BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Plugin health checks table for storing health status
CREATE TABLE IF NOT EXISTS plugin_health_checks (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- 'HEALTHY', 'UNHEALTHY', 'DEGRADED', 'UNKNOWN'
    message TEXT,
    response_time_ms BIGINT,
    checked_at TIMESTAMP DEFAULT NOW()
);

-- Plugin configuration history for tracking config changes
CREATE TABLE IF NOT EXISTS plugin_config_history (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    config_before JSONB,
    config_after JSONB,
    changed_by VARCHAR(255),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_note_metadata_note_id ON application.note_metadata(note_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_attributes_user_id ON user_custom_attributes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_name ON plugin_registry(name);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry(status);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_type ON plugin_registry(type);
CREATE INDEX IF NOT EXISTS idx_plugin_events_plugin_id ON plugin_events(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_events_type ON plugin_events(event_type);
CREATE INDEX IF NOT EXISTS idx_plugin_permissions_plugin_id ON plugin_permissions(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_execution_logs_plugin_id ON plugin_execution_logs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_execution_logs_created_at ON plugin_execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_plugin_health_checks_plugin_id ON plugin_health_checks(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_health_checks_checked_at ON plugin_health_checks(checked_at);

-- Add comments for documentation
COMMENT ON TABLE plugin_registry IS 'Stores metadata and configuration for installed plugins';
COMMENT ON TABLE plugin_events IS 'Tracks event types that plugins subscribe to or publish';
COMMENT ON TABLE plugin_permissions IS 'Stores permissions granted to plugins';
COMMENT ON TABLE plugin_execution_logs IS 'Audit log for plugin operations and performance monitoring';
COMMENT ON TABLE plugin_health_checks IS 'Health check results for plugin monitoring';
COMMENT ON TABLE plugin_config_history IS 'History of plugin configuration changes';

COMMENT ON COLUMN plugin_registry.type IS 'INTERNAL for JAR plugins, EXTERNAL for microservice plugins';
COMMENT ON COLUMN plugin_registry.runtime IS 'Runtime environment: JAR, GRPC, REST, MESSAGE_QUEUE';
COMMENT ON COLUMN plugin_registry.config IS 'Plugin configuration as JSON';
COMMENT ON COLUMN plugin_registry.config_schema IS 'JSON schema for plugin configuration validation';

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_plugin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS plugin_registry_updated_at ON plugin_registry;
CREATE TRIGGER plugin_registry_updated_at
    BEFORE UPDATE ON plugin_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_updated_at();
