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
