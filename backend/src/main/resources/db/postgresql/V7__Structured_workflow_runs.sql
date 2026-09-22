-- Historical unowned Blueprints are retained but cannot run until reviewed ownership is assigned.
ALTER TABLE plugin_registry ADD COLUMN owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE plugin_registry ADD COLUMN blueprint_name VARCHAR(128);
CREATE UNIQUE INDEX blueprint_owner_name ON plugin_registry(owner_id,blueprint_name) WHERE runtime='BLUEPRINT';
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id BIGINT REFERENCES plugin_registry(id) ON DELETE SET NULL,
  blueprint_version VARCHAR(50) NOT NULL,
  blueprint_digest CHAR(64) NOT NULL,
  trigger_node_id VARCHAR(128) NOT NULL,
  trigger_type VARCHAR(128) NOT NULL,
  trigger_key VARCHAR(255) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK(state IN ('QUEUED','RUNNING','WAITING','RETRY_WAIT','SUCCEEDED','FAILED','CANCELLED')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt BETWEEN 1 AND 100),
  parent_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  retain_until TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + interval '90 days',
  error_class VARCHAR(64),
  input_metadata JSONB NOT NULL DEFAULT '{}' CHECK(octet_length(input_metadata::text)<=4096),
  output_metadata JSONB NOT NULL DEFAULT '{}' CHECK(octet_length(output_metadata::text)<=4096),
  payload_ref VARCHAR(256),
  UNIQUE(owner_id,blueprint_id,trigger_node_id,trigger_key)
);
CREATE INDEX workflow_owner_history ON workflow_runs(owner_id,created_at DESC,id);
CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 10001),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt BETWEEN 1 AND 100),
  node_id VARCHAR(128) NOT NULL,
  node_type VARCHAR(128) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK(state IN ('RUNNING','WAITING','RETRY_WAIT','SUCCEEDED','FAILED','SKIPPED','CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  error_class VARCHAR(64),
  input_metadata JSONB NOT NULL DEFAULT '{}' CHECK(octet_length(input_metadata::text)<=4096),
  output_metadata JSONB NOT NULL DEFAULT '{}' CHECK(octet_length(output_metadata::text)<=4096),
  payload_ref VARCHAR(256),
  UNIQUE(run_id,sequence,attempt)
);
CREATE FUNCTION enforce_workflow_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='QUEUED' AND NEW.state IN ('RUNNING','CANCELLED')) OR
    (OLD.state='RUNNING' AND NEW.state IN ('WAITING','RETRY_WAIT','SUCCEEDED','FAILED','SKIPPED','CANCELLED')) OR
    (OLD.state='WAITING' AND NEW.state IN ('RUNNING','FAILED','CANCELLED')) OR
    (OLD.state='RETRY_WAIT' AND NEW.state IN ('RUNNING','FAILED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'Invalid workflow transition % -> %',OLD.state,NEW.state; END IF;
  IF NEW.attempt<>OLD.attempt AND NOT (OLD.state='RETRY_WAIT' AND NEW.state='RUNNING' AND NEW.attempt=OLD.attempt+1)
    THEN RAISE EXCEPTION 'Invalid workflow attempt'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workflow_run_transition BEFORE UPDATE ON workflow_runs FOR EACH ROW EXECUTE FUNCTION enforce_workflow_transition();
CREATE TRIGGER workflow_step_transition BEFORE UPDATE ON workflow_steps FOR EACH ROW EXECUTE FUNCTION enforce_workflow_transition();
-- plugin_execution_logs and plugin_config_history are intentionally preserved.
