ALTER TABLE workflow_runs ADD COLUMN parent_run_ref UUID;
UPDATE workflow_runs SET parent_run_ref=parent_run_id;
CREATE FUNCTION preserve_workflow_parent_ref() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.parent_run_ref:=NEW.parent_run_id;
  ELSE NEW.parent_run_ref:=COALESCE(OLD.parent_run_ref,OLD.parent_run_id,NEW.parent_run_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_parent_ref BEFORE INSERT OR UPDATE ON workflow_runs FOR EACH ROW EXECUTE FUNCTION preserve_workflow_parent_ref();
CREATE TABLE workflow_ops_policies (
  blueprint_id BIGINT PRIMARY KEY REFERENCES plugin_registry(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK(retention_days BETWEEN 7 AND 365),
  payload_hours INTEGER NOT NULL DEFAULT 2160 CHECK(payload_hours BETWEEN 1 AND 8760),
  failure_threshold INTEGER NOT NULL DEFAULT 3 CHECK(failure_threshold BETWEEN 1 AND 1000),
  window_minutes INTEGER NOT NULL DEFAULT 15 CHECK(window_minutes BETWEEN 1 AND 1440),
  route VARCHAR(32) NOT NULL DEFAULT 'EXECUTION_CENTER' CHECK(route IN ('NONE','EXECUTION_CENTER','INBOX'))
);
CREATE TABLE workflow_alerts (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id BIGINT REFERENCES plugin_registry(id) ON DELETE SET NULL,
  bucket BIGINT NOT NULL,
  failure_count INTEGER NOT NULL,
  route VARCHAR(32) NOT NULL,
  message VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMPTZ,
  UNIQUE(blueprint_id,bucket)
);
ALTER TABLE notifications ADD COLUMN workflow_alert_id UUID UNIQUE REFERENCES workflow_alerts(id) ON DELETE SET NULL;
CREATE INDEX workflow_alert_owner ON workflow_alerts(owner_id,created_at DESC);
CREATE INDEX workflow_recent_finished ON workflow_runs(finished_at) WHERE finished_at IS NOT NULL;
CREATE INDEX workflow_recent_failure ON workflow_runs(owner_id,blueprint_id,finished_at) WHERE state IN ('FAILED','DEAD_LETTER');
