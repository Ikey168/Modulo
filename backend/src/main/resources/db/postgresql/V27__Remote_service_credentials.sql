-- Per-user credentials for server-side service adapters (#495): feed readers,
-- CalDAV, ntfy and metadata providers. Values are AES-GCM encrypted by the
-- application with modulo.remote.credential-key; they are never returned.
CREATE TABLE remote_service_credentials (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_key VARCHAR(64) NOT NULL,
    ciphertext BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, credential_key)
);
