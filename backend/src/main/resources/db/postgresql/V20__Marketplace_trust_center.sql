CREATE TABLE IF NOT EXISTS marketplace_publishers (
    id UUID PRIMARY KEY,
    owner_id BIGINT,
    display_name VARCHAR(160) NOT NULL,
    verification_level VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    signing_identity VARCHAR(500),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    reviewed_by BIGINT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_releases (
    id UUID PRIMARY KEY,
    plugin_key VARCHAR(200) NOT NULL,
    version VARCHAR(80) NOT NULL,
    image_reference VARCHAR(500),
    image_digest VARCHAR(80) NOT NULL,
    publisher_id UUID REFERENCES marketplace_publishers(id),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    runtime_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    immutable_digest VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(plugin_key, version),
    UNIQUE(plugin_key, image_digest)
);

CREATE TABLE IF NOT EXISTS marketplace_trust_evidence (
    id UUID PRIMARY KEY,
    release_id UUID NOT NULL REFERENCES marketplace_releases(id) ON DELETE CASCADE,
    evidence_type VARCHAR(40) NOT NULL,
    status VARCHAR(24) NOT NULL,
    source VARCHAR(160) NOT NULL,
    summary TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_marketplace_trust_evidence_latest
    ON marketplace_trust_evidence(release_id, evidence_type, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_installations (
    id UUID PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    plugin_key VARCHAR(200) NOT NULL,
    release_id UUID NOT NULL REFERENCES marketplace_releases(id),
    previous_release_id UUID REFERENCES marketplace_releases(id),
    action VARCHAR(24) NOT NULL,
    permission_diff JSONB NOT NULL DEFAULT '{}'::jsonb,
    consented BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL,
    failure TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_installations_owner_plugin
    ON marketplace_installations(owner_id, plugin_key, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_publisher_history (
    id UUID PRIMARY KEY,
    publisher_id UUID NOT NULL REFERENCES marketplace_publishers(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL,
    old_level VARCHAR(32),
    new_level VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verified_marketplace_publisher_name
    ON marketplace_publishers ((lower(display_name)))
    WHERE verification_level <> 'UNVERIFIED' AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_marketplace_signing_identity
    ON marketplace_publishers (signing_identity)
    WHERE signing_identity IS NOT NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS marketplace_trust_reports (
    id UUID PRIMARY KEY,
    owner_id BIGINT NOT NULL,
    plugin_key VARCHAR(200) NOT NULL,
    release_id UUID REFERENCES marketplace_releases(id),
    reason VARCHAR(80) NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
