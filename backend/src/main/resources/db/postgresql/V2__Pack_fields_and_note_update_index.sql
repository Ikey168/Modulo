-- Pack system schema (#276).
-- Packs are stored in plugin_registry with runtime = 'PACK'.
-- The pack manifest JSON is stored in the config column.
-- Contributed node descriptors and blueprints are recorded in pack_contributions.

CREATE TABLE IF NOT EXISTS pack_contributions (
    id              BIGSERIAL PRIMARY KEY,
    pack_id         BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    kind            VARCHAR(20) NOT NULL, -- 'node' | 'blueprint'
    type_or_name    VARCHAR(255) NOT NULL,
    version         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (pack_id, kind, type_or_name, version)
);

CREATE INDEX IF NOT EXISTS idx_pack_contributions_pack_id ON pack_contributions(pack_id);

COMMENT ON TABLE pack_contributions IS 'Tracks node types and blueprint names contributed by each installed pack.';
COMMENT ON COLUMN pack_contributions.kind IS 'node or blueprint';
COMMENT ON COLUMN pack_contributions.type_or_name IS 'Node type id (e.g. action.note.create) or blueprint name';

-- Pack IPFS distribution fields (#277).
-- Tracks which packs have been published to IPFS and their integrity hash.

ALTER TABLE plugin_registry
    ADD COLUMN IF NOT EXISTS ipfs_cid     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source       VARCHAR(20) DEFAULT 'LOCAL';

CREATE INDEX IF NOT EXISTS idx_plugin_registry_ipfs_cid ON plugin_registry(ipfs_cid) WHERE ipfs_cid IS NOT NULL;

COMMENT ON COLUMN plugin_registry.ipfs_cid IS 'IPFS Content Identifier for the published pack bundle';
COMMENT ON COLUMN plugin_registry.content_hash IS 'SHA-256 hex digest of the manifest JSON for integrity verification';
COMMENT ON COLUMN plugin_registry.source IS 'LOCAL | IPFS — how the pack was installed';

-- Pack on-chain provenance + paid-pack economy (#278).
-- Anchors pack CID/hash on-chain (via NoteMonetization/ModuloToken) and
-- records premium pricing + royalty intent for paid packs.

ALTER TABLE plugin_registry
    ADD COLUMN IF NOT EXISTS anchor_tx       VARCHAR(80),
    ADD COLUMN IF NOT EXISTS onchain_id      BIGINT,
    ADD COLUMN IF NOT EXISTS author_address  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_premium      BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS access_price    NUMERIC(40, 0),
    ADD COLUMN IF NOT EXISTS royalty_bps     INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_plugin_registry_anchor_tx ON plugin_registry(anchor_tx) WHERE anchor_tx IS NOT NULL;

COMMENT ON COLUMN plugin_registry.anchor_tx IS 'Transaction hash of the on-chain provenance anchor';
COMMENT ON COLUMN plugin_registry.onchain_id IS 'NoteMonetization on-chain note id for this pack';
COMMENT ON COLUMN plugin_registry.author_address IS 'Wallet address that anchored the pack (verifiable authorship)';
COMMENT ON COLUMN plugin_registry.is_premium IS 'Whether this pack requires purchase before install';
COMMENT ON COLUMN plugin_registry.access_price IS 'Access price in MODO token base units (18 decimals)';
COMMENT ON COLUMN plugin_registry.royalty_bps IS 'Author royalty split in basis points (e.g. 250 = 2.5%)';

CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON application.notes(updated_at);
