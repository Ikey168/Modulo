CREATE TABLE plugin_state_workloads (
    token_hash CHAR(64) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plugin_id VARCHAR(128) NOT NULL,
    can_read BOOLEAN NOT NULL,
    can_write BOOLEAN NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX plugin_state_workloads_owner
    ON plugin_state_workloads(owner_id, created_at DESC);
CREATE INDEX plugin_state_workloads_active
    ON plugin_state_workloads(token_hash, plugin_id, owner_id)
    WHERE NOT revoked;

