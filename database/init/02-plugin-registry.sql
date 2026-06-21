-- Plugin system tables for the local docker stack.
--
-- These tables are NOT JPA entities -- the backend's PluginRegistry accesses
-- them with raw, unqualified JdbcTemplate SQL (e.g. "SELECT * FROM
-- plugin_registry ..."), so Hibernate's ddl-auto does not create them. They are
-- the only schema objects the app needs that Hibernate doesn't provide.
--
-- Previously these came from Flyway's V2 migration, but Flyway's V1 migration
-- defines an incompatible UUID-based schema for notes/users/tags that collides
-- with the live JPA entities (BIGINT ids) on the `application` schema and aborts
-- the whole Flyway run (the RLS policy fails with "operator does not exist:
-- uuid = bigint"), so V2 never executed and plugin_registry never got created.
-- The app runs entirely on Hibernate's schema, so for the local stack we let
-- Hibernate own everything and seed just these plugin tables here instead.
--
-- This file runs once, as the superuser, against POSTGRES_DB (modulodb) during
-- Postgres first-init -- before the backend connects. Objects are unqualified,
-- so they land in `public`, which is on the backend's default search_path.

CREATE TABLE IF NOT EXISTS plugin_registry (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    runtime VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
    path VARCHAR(500),
    endpoint VARCHAR(500),
    config JSONB DEFAULT '{}',
    config_schema JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_events (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    event_type VARCHAR(255) NOT NULL,
    event_action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plugin_id, event_type, event_action)
);

CREATE TABLE IF NOT EXISTS plugin_permissions (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL,
    granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plugin_id, permission)
);

CREATE TABLE IF NOT EXISTS plugin_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    execution_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    execution_time_ms BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_health_checks (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    response_time_ms BIGINT,
    checked_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_config_history (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    config_before JSONB,
    config_after JSONB,
    changed_by VARCHAR(255),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE OR REPLACE FUNCTION update_plugin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plugin_registry_updated_at ON plugin_registry;
CREATE TRIGGER plugin_registry_updated_at
    BEFORE UPDATE ON plugin_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_updated_at();
