-- Note templates for slash-command and template-picker feature (#267).

CREATE TABLE IF NOT EXISTS note_templates (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    content     TEXT         NOT NULL DEFAULT '',
    variables   TEXT,
    owner_id    VARCHAR(255),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_templates_owner_id ON note_templates(owner_id);
