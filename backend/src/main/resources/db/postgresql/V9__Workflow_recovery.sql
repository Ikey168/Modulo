ALTER TABLE workflow_runs ADD COLUMN cancel_requested_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN cancelled_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE workflow_runs ADD COLUMN retry_requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE workflow_runs ADD COLUMN retry_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workflow_runs ADD COLUMN retry_from_sequence INTEGER;
CREATE TABLE workflow_checkpoints (
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK(sequence BETWEEN 0 AND 10001),
  snapshot JSONB NOT NULL CHECK(octet_length(snapshot::text)<=1048576),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(run_id,sequence)
);
-- Checkpoint payloads are private execution data. They are never returned by trace APIs.
