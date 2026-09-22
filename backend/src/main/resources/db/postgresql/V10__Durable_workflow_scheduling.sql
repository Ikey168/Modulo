ALTER TABLE workflow_runs DROP CONSTRAINT workflow_runs_state_check;
ALTER TABLE workflow_runs ADD CONSTRAINT workflow_runs_state_check CHECK(state IN ('QUEUED','RUNNING','WAITING','RETRY_WAIT','SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER'));
ALTER TABLE workflow_runs ADD COLUMN resume_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN resume_checkpoint INTEGER;
ALTER TABLE workflow_runs ADD COLUMN execution_worker TEXT;
ALTER TABLE workflow_runs ADD COLUMN max_auto_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_auto_attempts BETWEEN 1 AND 5);
ALTER TABLE workflow_runs ADD COLUMN retry_backoff_seconds INTEGER NOT NULL DEFAULT 30 CHECK(retry_backoff_seconds BETWEEN 5 AND 3600);
CREATE TABLE workflow_schedules (
  blueprint_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id VARCHAR(128) NOT NULL,
  cron VARCHAR(128) NOT NULL,
  zone VARCHAR(64) NOT NULL,
  next_fire TIMESTAMPTZ NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 5),
  backoff_seconds INTEGER NOT NULL DEFAULT 30 CHECK(backoff_seconds BETWEEN 5 AND 3600),
  PRIMARY KEY(blueprint_id,node_id)
);
CREATE TABLE workflow_schedule_jobs (
  id UUID PRIMARY KEY,
  blueprint_id BIGINT REFERENCES plugin_registry(id) ON DELETE SET NULL,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id VARCHAR(128) NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  next_attempt TIMESTAMPTZ NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','RUNNING','DELIVERED','DEAD_LETTER')),
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 5),
  backoff_seconds INTEGER NOT NULL CHECK(backoff_seconds BETWEEN 5 AND 3600),
  run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  error_class VARCHAR(64),
  parent_job_id UUID REFERENCES workflow_schedule_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blueprint_id,node_id,due_at)
);
CREATE INDEX workflow_schedule_due ON workflow_schedules(next_fire) WHERE enabled;
CREATE INDEX workflow_job_due ON workflow_schedule_jobs(next_attempt) WHERE state='PENDING';
CREATE INDEX workflow_resume_due ON workflow_runs(resume_at) WHERE state='WAITING';
CREATE OR REPLACE FUNCTION enforce_workflow_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state<>OLD.state AND NOT (
    (OLD.state='QUEUED' AND NEW.state IN ('RUNNING','CANCELLED','DEAD_LETTER')) OR
    (OLD.state='RUNNING' AND NEW.state IN ('WAITING','RETRY_WAIT','SUCCEEDED','FAILED','SKIPPED','CANCELLED','DEAD_LETTER')) OR
    (OLD.state='WAITING' AND NEW.state IN ('RUNNING','FAILED','CANCELLED','DEAD_LETTER')) OR
    (OLD.state='RETRY_WAIT' AND NEW.state IN ('RUNNING','FAILED','CANCELLED','DEAD_LETTER')) OR
    (OLD.state='FAILED' AND NEW.state='DEAD_LETTER')
  ) THEN RAISE EXCEPTION 'Invalid workflow transition % -> %',OLD.state,NEW.state; END IF;
  IF NEW.attempt<>OLD.attempt AND NOT (OLD.state='RETRY_WAIT' AND NEW.state='RUNNING' AND NEW.attempt=OLD.attempt+1)
    THEN RAISE EXCEPTION 'Invalid workflow attempt'; END IF;
  RETURN NEW;
END $$;
