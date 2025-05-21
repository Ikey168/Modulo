-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schemas
CREATE SCHEMA IF NOT EXISTS application;
CREATE SCHEMA IF NOT EXISTS security;

-- Tables
CREATE TABLE IF NOT EXISTS application.notes (
    note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    user_id UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS application.tags (
    tag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS application.note_tags (
    note_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES application.notes(note_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES application.tags(tag_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS application.note_links (
    link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id UUID NOT NULL,
    target_note_id UUID NOT NULL,
    link_type VARCHAR(255) NOT NULL,
    FOREIGN KEY (source_note_id) REFERENCES application.notes(note_id) ON DELETE CASCADE,
    FOREIGN KEY (target_note_id) REFERENCES application.notes(note_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS security.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS security.roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS security.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES security.users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES security.roles(role_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON application.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON application.note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_note_links_source_note_id ON application.note_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target_note_id ON application.note_links(target_note_id);

-- Full-Text Search
ALTER TABLE application.notes ADD COLUMN tsvector TSVECTOR;
UPDATE application.notes SET tsvector = to_tsvector('english', title || ' ' || content);

CREATE INDEX idx_notes_tsvector ON application.notes USING GIN (tsvector);

CREATE TRIGGER notes_tsvectorupdate BEFORE INSERT OR UPDATE
ON application.notes FOR EACH ROW
EXECUTE PROCEDURE tsvector_update_trigger('tsvector', 'pg_catalog.english', 'title', 'content');

-- Row-Level Security (Example - adapt to your multi-tenant strategy)
ALTER TABLE application.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_policy ON application.notes
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());

-- Functions
CREATE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT current_setting('app.current_user_id')::UUID;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Audit Trigger
CREATE OR REPLACE FUNCTION application.set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON application.notes
FOR EACH ROW
EXECUTE PROCEDURE application.set_timestamp();

-- Versioning (Flyway or Liquibase would be used for real migrations)
-- Example: V1__Initial_Schema.sql, V2__Add_Indexes.sql, etc.

-- Down migration example (for schema evolution)
-- DROP TABLE IF EXISTS application.note_links;
-- DROP TABLE IF EXISTS application.note_tags;
-- DROP TABLE IF EXISTS application.notes;
-- DROP TABLE IF EXISTS application.tags;
-- DROP TABLE IF EXISTS security.user_roles;
-- DROP TABLE IF EXISTS security.roles;
-- DROP TABLE IF EXISTS security.users;
-- DROP SCHEMA IF EXISTS application;
-- DROP SCHEMA IF EXISTS security;