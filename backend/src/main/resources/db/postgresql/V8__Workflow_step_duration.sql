ALTER TABLE workflow_steps ADD COLUMN duration_ms BIGINT CHECK(duration_ms>=0);
