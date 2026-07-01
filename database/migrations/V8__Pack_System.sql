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
