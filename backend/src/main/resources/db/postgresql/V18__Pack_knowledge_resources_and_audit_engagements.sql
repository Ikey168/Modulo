ALTER TABLE workspace_pack_resources ADD COLUMN knowledge_id UUID REFERENCES saved_property_queries(id) ON DELETE SET NULL;
ALTER TABLE workspace_pack_resources ADD COLUMN knowledge_revision BIGINT;
CREATE TABLE audit_pack_engagements (
 id UUID PRIMARY KEY,
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(256) NOT NULL,
 engagement_key VARCHAR(64) NOT NULL,
 intake_note BIGINT REFERENCES application.notes(note_id) ON DELETE SET NULL,
 checklist_note BIGINT REFERENCES application.notes(note_id) ON DELETE SET NULL,
 report_note BIGINT REFERENCES application.notes(note_id) ON DELETE SET NULL,
 review_run UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
 demo BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_id,engagement_key)
);
CREATE TABLE audit_pack_engagement_records (
 engagement_id UUID NOT NULL REFERENCES audit_pack_engagements(id) ON DELETE CASCADE,
 note_id BIGINT NOT NULL REFERENCES application.notes(note_id) ON DELETE CASCADE,
 kind VARCHAR(24) NOT NULL,
 PRIMARY KEY(engagement_id,note_id)
);
CREATE TABLE approval_report_artifacts (
 request_id UUID PRIMARY KEY REFERENCES approval_requests(id) ON DELETE CASCADE,
 engagement_id UUID NOT NULL REFERENCES audit_pack_engagements(id),
 report_canonical TEXT NOT NULL CHECK(octet_length(report_canonical)<=2097152),
 evidence_canonical TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION immutable_approval_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Approval report artifacts are immutable'; END $$;
CREATE TRIGGER immutable_approval_report BEFORE UPDATE ON approval_report_artifacts
 FOR EACH ROW EXECUTE FUNCTION immutable_approval_report();
