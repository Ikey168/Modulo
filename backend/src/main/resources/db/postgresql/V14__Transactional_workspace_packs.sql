CREATE TABLE workspace_pack_installations (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_key VARCHAR(128) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK(state IN ('ACTIVE','UNINSTALLED')),
  active_release UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(owner_id,pack_key), UNIQUE(id,owner_id)
);
CREATE TABLE workspace_pack_releases (
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES workspace_pack_installations(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  manifest_digest CHAR(64) NOT NULL,
  manifest JSONB NOT NULL CHECK(octet_length(manifest::text)<=2500000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(installation_id,version)
);
ALTER TABLE workspace_pack_installations ADD FOREIGN KEY(active_release) REFERENCES workspace_pack_releases(id) ON DELETE SET NULL;
CREATE TABLE workspace_pack_resources (
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL,
  owner_id BIGINT NOT NULL,
  resource_key VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  spec JSONB NOT NULL CHECK(octet_length(spec::text)<=2097152),
  baseline_digest CHAR(64) NOT NULL,
  registry_id BIGINT REFERENCES plugin_registry(id) ON DELETE SET NULL,
  user_modified BOOLEAN NOT NULL DEFAULT FALSE,
  detached BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(installation_id,resource_key),
  FOREIGN KEY(installation_id,owner_id) REFERENCES workspace_pack_installations(id,owner_id) ON DELETE CASCADE
);
CREATE TABLE workspace_pack_demo_records (
  installation_id UUID NOT NULL REFERENCES workspace_pack_installations(id) ON DELETE CASCADE,
  resource_key VARCHAR(64) NOT NULL,
  demo_key VARCHAR(64) NOT NULL,
  note_id BIGINT REFERENCES application.notes(note_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(installation_id,resource_key,demo_key)
);
CREATE TABLE workspace_pack_operations (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_key VARCHAR(128) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK(kind IN ('INSTALL','UPGRADE','ROLLBACK','UNINSTALL')),
  from_release UUID,
  target_release UUID,
  manifest JSONB NOT NULL CHECK(octet_length(manifest::text)<=2500000),
  manifest_digest CHAR(64) NOT NULL,
  dependency_snapshot JSONB NOT NULL,
  consent JSONB NOT NULL,
  include_demo BOOLEAN NOT NULL,
  plan JSONB NOT NULL,
  status VARCHAR(16) NOT NULL CHECK(status IN ('PLANNED','APPLYING','SUCCEEDED','FAILED')),
  failure_code VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX workspace_pack_owner_history ON workspace_pack_operations(owner_id,created_at DESC,id);
CREATE FUNCTION immutable_pack_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Pack release history is immutable'; END $$;
CREATE TRIGGER workspace_pack_release_immutable BEFORE UPDATE ON workspace_pack_releases FOR EACH ROW EXECUTE FUNCTION immutable_pack_release();
CREATE FUNCTION protect_pack_operation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.owner_id,NEW.pack_key,NEW.kind,NEW.from_release,NEW.target_release,NEW.manifest,NEW.manifest_digest,NEW.dependency_snapshot,NEW.consent,NEW.include_demo,NEW.plan)
    IS DISTINCT FROM (OLD.owner_id,OLD.pack_key,OLD.kind,OLD.from_release,OLD.target_release,OLD.manifest,OLD.manifest_digest,OLD.dependency_snapshot,OLD.consent,OLD.include_demo,OLD.plan)
  THEN RAISE EXCEPTION 'Pack operation plan is immutable'; END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='PLANNED' AND NEW.status IN ('APPLYING','FAILED')) OR (OLD.status='APPLYING' AND NEW.status IN ('SUCCEEDED','FAILED')))
  THEN RAISE EXCEPTION 'Invalid pack operation transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_pack_operation_protected BEFORE UPDATE ON workspace_pack_operations FOR EACH ROW EXECUTE FUNCTION protect_pack_operation();
CREATE TABLE workspace_pack_runtime_refresh (
  registry_id BIGINT PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES workspace_pack_installations(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error VARCHAR(64)
);
