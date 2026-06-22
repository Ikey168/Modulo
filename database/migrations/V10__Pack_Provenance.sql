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
