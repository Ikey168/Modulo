CREATE TABLE approval_signing_keys (
  key_id VARCHAR(64) PRIMARY KEY,
  algorithm VARCHAR(32) NOT NULL CHECK (algorithm='Ed25519'),
  key_version INTEGER NOT NULL CHECK (key_version=1),
  public_key TEXT NOT NULL CHECK (octet_length(public_key)<=4096),
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE approval_signatures (
  decision_id UUID PRIMARY KEY REFERENCES approval_decisions(id) ON DELETE CASCADE,
  key_id VARCHAR(64) NOT NULL REFERENCES approval_signing_keys(key_id),
  format_version INTEGER NOT NULL CHECK (format_version=1),
  statement TEXT NOT NULL CHECK (octet_length(statement)<=32768),
  statement_digest VARCHAR(64) NOT NULL,
  signature TEXT NOT NULL CHECK (octet_length(signature)<=256),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION immutable_approval_signature() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Approval signature and key records are immutable'; END $$;
CREATE TRIGGER approval_signatures_immutable BEFORE UPDATE ON approval_signatures FOR EACH ROW EXECUTE FUNCTION immutable_approval_signature();
CREATE TRIGGER approval_keys_immutable BEFORE UPDATE OR DELETE ON approval_signing_keys FOR EACH ROW EXECUTE FUNCTION immutable_approval_signature();
