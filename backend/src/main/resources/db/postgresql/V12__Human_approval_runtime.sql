CREATE TABLE approval_grants (
  blueprint_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY(blueprint_id,approver_id),
  CHECK(owner_id<>approver_id)
);
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_ref VARCHAR(64) NOT NULL,
  approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approver_ref VARCHAR(64) NOT NULL,
  run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  run_ref UUID NOT NULL,
  run_attempt INTEGER NOT NULL,
  blueprint_id BIGINT REFERENCES plugin_registry(id) ON DELETE SET NULL,
  blueprint_digest VARCHAR(64) NOT NULL,
  blueprint_version VARCHAR(50) NOT NULL,
  blueprint_updated_at TIMESTAMP,
  node_id VARCHAR(128) NOT NULL,
  request_step_id UUID NOT NULL,
  wait_step_id UUID,
  checkpoint INTEGER,
  resume_nonce BYTEA NOT NULL CHECK(octet_length(resume_nonce)=32),
  evidence_digest VARCHAR(64) NOT NULL,
  evidence_checks JSONB NOT NULL CHECK(octet_length(evidence_checks::text)<=65536),
  safe_summary JSONB NOT NULL CHECK(octet_length(safe_summary::text)<=4096),
  policy_digest VARCHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK(state IN ('REQUESTED','PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED')),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  reminders_requested INTEGER NOT NULL DEFAULT 0 CHECK(reminders_requested BETWEEN 0 AND 3),
  reminders_sent INTEGER NOT NULL DEFAULT 0 CHECK(reminders_sent BETWEEN 0 AND 3),
  next_reminder_at TIMESTAMPTZ,
  UNIQUE(run_ref,request_step_id),
  CHECK(requester_ref<>approver_ref)
);
CREATE TABLE approval_decisions (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  request_revision INTEGER NOT NULL,
  actor_ref VARCHAR(64) NOT NULL,
  outcome VARCHAR(8) NOT NULL CHECK(outcome IN ('APPROVE','REJECT')),
  comment_text TEXT CHECK(octet_length(comment_text)<=4096),
  comment_digest VARCHAR(64) NOT NULL,
  idempotency_key UUID NOT NULL,
  payload_digest VARCHAR(64) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL,
  binding JSONB NOT NULL CHECK(octet_length(binding::text)<=16384),
  UNIQUE(request_id,actor_ref),
  UNIQUE(request_id,idempotency_key)
);
CREATE TABLE approval_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  state VARCHAR(16) NOT NULL,
  actor_ref VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION enforce_approval_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state<>OLD.state AND NOT ((OLD.state='REQUESTED' AND NEW.state IN ('PENDING','CANCELLED')) OR (OLD.state='PENDING' AND NEW.state IN ('APPROVED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED')))
    THEN RAISE EXCEPTION 'Invalid approval transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approval_transition BEFORE UPDATE ON approval_requests FOR EACH ROW EXECUTE FUNCTION enforce_approval_transition();
CREATE FUNCTION immutable_approval_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Approval decisions are immutable'; END $$;
CREATE TRIGGER approval_decision_immutable BEFORE UPDATE ON approval_decisions FOR EACH ROW EXECUTE FUNCTION immutable_approval_decision();
ALTER TABLE workflow_runs ADD COLUMN resume_approval_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN approval_request_id UUID REFERENCES approval_requests(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN approval_notification_key VARCHAR(128) UNIQUE;
CREATE INDEX approval_pending_reviewer ON approval_requests(approver_id,expires_at) WHERE state='PENDING';
CREATE INDEX approval_owner_history ON approval_requests(owner_id,created_at DESC);
CREATE INDEX approval_due ON approval_requests(expires_at) WHERE state='PENDING';
