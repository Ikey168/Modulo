CREATE TABLE workspace_pack_drafts (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(128) NOT NULL,
  source TEXT NOT NULL CHECK(octet_length(source)<=2097152),
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX workspace_pack_draft_owner ON workspace_pack_drafts(owner_id,updated_at DESC);
CREATE TABLE workspace_pack_publications (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_key VARCHAR(128) NOT NULL,
  version VARCHAR(50) NOT NULL,
  source TEXT NOT NULL CHECK(octet_length(source)<=2097152),
  content_hash CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK(state IN ('PUBLISHING','PUBLISHED','FAILED')),
  attempt_token UUID NOT NULL,
  cid VARCHAR(128),
  failure_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,pack_key,version)
);
CREATE FUNCTION protect_pack_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.owner_id,NEW.pack_key,NEW.version,NEW.source,NEW.content_hash) IS DISTINCT FROM (OLD.owner_id,OLD.pack_key,OLD.version,OLD.source,OLD.content_hash)
  THEN RAISE EXCEPTION 'Published release source is immutable'; END IF;
  IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published receipt is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_pack_publication_immutable BEFORE UPDATE ON workspace_pack_publications FOR EACH ROW EXECUTE FUNCTION protect_pack_publication();
