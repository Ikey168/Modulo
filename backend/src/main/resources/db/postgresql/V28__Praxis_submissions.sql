-- Processes a Modulo user submitted to Praxis (#525). Praxis has no listing route and
-- scopes each process to the delegated user, so Modulo keeps the ids it submitted to
-- show a user their tasks. State, results and verification always come from Praxis.
CREATE TABLE praxis_submissions (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    process_id VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    objective VARCHAR(2000) NOT NULL,
    executor VARCHAR(64) NOT NULL,
    publish_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, process_id)
);
CREATE INDEX idx_praxis_submissions_owner_created ON praxis_submissions (owner_id, created_at DESC);
