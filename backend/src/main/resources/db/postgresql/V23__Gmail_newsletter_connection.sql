CREATE TABLE gmail_newsletter_connections (
    owner_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    connection_id VARCHAR(64) NOT NULL,
    email VARCHAR(320) NOT NULL,
    refresh_token TEXT NOT NULL,
    search_query VARCHAR(500) NOT NULL DEFAULT 'label:newsletters newer_than:30d',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    page_token TEXT,
    last_sync TIMESTAMPTZ,
    next_sync TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until TIMESTAMPTZ,
    last_error VARCHAR(500),
    imported_count BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE gmail_newsletter_oauth (
    state_hash VARCHAR(64) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cookie_hash VARCHAR(64) NOT NULL,
    verifier TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX gmail_newsletter_oauth_expiry ON gmail_newsletter_oauth(expires_at);
