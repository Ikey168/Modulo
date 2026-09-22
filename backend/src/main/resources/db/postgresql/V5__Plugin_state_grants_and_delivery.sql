CREATE TABLE plugin_state_grants (
    token_hash CHAR(64) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id VARCHAR(128) NOT NULL,
    namespace VARCHAR(128) NOT NULL,
    plugin_id VARCHAR(128) NOT NULL,
    can_read BOOLEAN NOT NULL,
    can_write BOOLEAN NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX plugin_state_grants_owner ON plugin_state_grants(owner_id, created_at);

CREATE TABLE plugin_state_schemas (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    namespace VARCHAR(128) NOT NULL,
    schema_id VARCHAR(256) NOT NULL,
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    definition JSONB NOT NULL,
    PRIMARY KEY(owner_id,namespace,schema_id,schema_version)
);

ALTER TABLE plugin_state_events ADD COLUMN schema_id VARCHAR(256);
ALTER TABLE plugin_state_events ADD COLUMN schema_version INTEGER;
ALTER TABLE plugin_state_events ADD COLUMN actor_plugin VARCHAR(128) NOT NULL DEFAULT 'host';
ALTER TABLE plugin_state_events ADD COLUMN request_id UUID;
ALTER TABLE plugin_state_events ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE plugin_state_events ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plugin_state_events ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- Historical events remain available through the authorized change feed, without replaying old socket alerts.
UPDATE plugin_state_events SET delivered_at=CURRENT_TIMESTAMP;
CREATE INDEX plugin_state_delivery_pending ON plugin_state_events(next_attempt_at,id) WHERE delivered_at IS NULL;
