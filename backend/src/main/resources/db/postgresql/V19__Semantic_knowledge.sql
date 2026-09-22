CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS application.note_embeddings (
    owner_id BIGINT NOT NULL,
    note_id BIGINT NOT NULL REFERENCES application.notes(note_id) ON DELETE CASCADE,
    provider VARCHAR(80) NOT NULL,
    model VARCHAR(160) NOT NULL,
    dimensions INTEGER NOT NULL,
    content_digest VARCHAR(64) NOT NULL,
    embedding vector(64),
    state VARCHAR(24) NOT NULL DEFAULT 'READY',
    error TEXT,
    embedded_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, note_id)
);
CREATE INDEX IF NOT EXISTS idx_note_embeddings_owner_model
    ON application.note_embeddings(owner_id, provider, model, state);
CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector_cosine
    ON application.note_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS application.suggested_note_links (
    id UUID PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    source_note_id BIGINT NOT NULL REFERENCES application.notes(note_id) ON DELETE CASCADE,
    target_note_id BIGINT NOT NULL REFERENCES application.notes(note_id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    explanation TEXT NOT NULL,
    provider VARCHAR(80) NOT NULL,
    model VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    UNIQUE(owner_id, source_note_id, target_note_id)
);
CREATE INDEX IF NOT EXISTS idx_suggested_note_links_owner_status
    ON application.suggested_note_links(owner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS application.knowledge_preferences (
    owner_id BIGINT PRIMARY KEY,
    provider_mode VARCHAR(24) NOT NULL DEFAULT 'LOCAL',
    remote_consent BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_budget_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
