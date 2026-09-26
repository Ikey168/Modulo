-- Owner-scoped binary files for workspace plugins (e.g. the attachment library).
CREATE TABLE workspace_files (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id VARCHAR(128) NOT NULL,
    file_id VARCHAR(128) NOT NULL,
    name VARCHAR(512) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, workspace_id, file_id)
);
