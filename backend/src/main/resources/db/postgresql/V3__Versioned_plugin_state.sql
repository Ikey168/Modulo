CREATE TABLE plugin_state (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    state_key VARCHAR(128) NOT NULL,
    schema_id VARCHAR(256) NOT NULL,
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    version BIGINT NOT NULL CHECK (version > 0),
    value JSONB,
    payload_bytes INTEGER NOT NULL CHECK (payload_bytes >= 0),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, workspace_id, namespace, state_key),
    CHECK ((deleted AND value IS NULL AND payload_bytes = 0)
        OR (NOT deleted AND value IS NOT NULL))
);

-- Per-owner row locking serializes writes before allocating this sequence,
-- so committed changes for an owner cannot arrive behind its cursor.
CREATE TABLE plugin_state_events (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    state_key VARCHAR(128) NOT NULL,
    operation VARCHAR(16) NOT NULL,
    version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX plugin_state_events_owner_cursor
    ON plugin_state_events(owner_id, workspace_id, namespace, id);
