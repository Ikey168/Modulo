CREATE TABLE saved_property_queries (
 id UUID PRIMARY KEY,
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title VARCHAR(256) NOT NULL,
 configuration JSONB NOT NULL,
 revision BIGINT NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX saved_property_queries_owner ON saved_property_queries(owner_id,updated_at DESC,id);
CREATE TABLE embedded_database_note_imports (
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 database_id VARCHAR(256) NOT NULL,
 row_id VARCHAR(256) NOT NULL,
 note_id BIGINT REFERENCES application.notes(note_id) ON DELETE SET NULL,
 PRIMARY KEY(owner_id,database_id,row_id)
);
CREATE TABLE embedded_database_query_imports (
 owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 database_id VARCHAR(256) NOT NULL,
 query_id UUID REFERENCES saved_property_queries(id) ON DELETE SET NULL,
 PRIMARY KEY(owner_id,database_id)
);
