-- Database Performance Optimization for Issue #50
-- API Response Time Improvements through Indexing

-- Notes table indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_notes_last_viewed_at ON notes(last_viewed_at);
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes(is_public);
CREATE INDEX IF NOT EXISTS idx_notes_title_search ON notes(LOWER(title));

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_viewed ON notes(user_id, last_viewed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_notes_public_updated ON notes(is_public, updated_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_notes_user_public ON notes(user_id, is_public);

-- Full-text search optimization (PostgreSQL specific)
-- For H2, these will be ignored but won't cause errors
CREATE INDEX IF NOT EXISTS idx_notes_content_gin ON notes USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
CREATE INDEX IF NOT EXISTS idx_notes_title_trgm ON notes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_content_trgm ON notes USING gin (content gin_trgm_ops);

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_name_lower ON tags(LOWER(name));

-- Note-Tag junction table indexes for many-to-many relationships
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_composite ON note_tags(note_id, tag_id);

-- Note links table indexes
CREATE INDEX IF NOT EXISTS idx_note_links_source ON note_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target ON note_links(target_note_id);

-- Attachments table indexes
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_filename ON attachments(filename);

-- Note metadata table indexes
CREATE INDEX IF NOT EXISTS idx_note_metadata_note_id ON note_metadata(note_id);
CREATE INDEX IF NOT EXISTS idx_note_metadata_key ON note_metadata(metadata_key);
CREATE INDEX IF NOT EXISTS idx_note_metadata_composite ON note_metadata(note_id, metadata_key);

-- Users table indexes (if applicable)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Blockchain-related indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_blockchain_id ON notes(blockchain_note_id) WHERE blockchain_note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_ipfs_cid ON notes(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_is_decentralized ON notes(is_decentralized) WHERE is_decentralized = true;
CREATE INDEX IF NOT EXISTS idx_notes_on_blockchain ON notes(is_on_blockchain) WHERE is_on_blockchain = true;

-- Performance optimization: Update table statistics
-- PostgreSQL specific - will be ignored in H2
ANALYZE notes;
ANALYZE tags;
ANALYZE note_tags;
ANALYZE attachments;
ANALYZE note_metadata;

-- Comments for documentation
COMMENT ON INDEX idx_notes_user_updated IS 'Optimizes user note listing queries ordered by update time';
COMMENT ON INDEX idx_notes_user_viewed IS 'Optimizes recently accessed notes queries for dashboard';
COMMENT ON INDEX idx_notes_content_gin IS 'Enables fast full-text search across title and content';
COMMENT ON INDEX idx_note_tags_composite IS 'Optimizes note-tag relationship queries';

-- Additional performance hints for PostgreSQL
SET random_page_cost = 1.1; -- Assumes fast SSD storage
SET effective_cache_size = '4GB'; -- Adjust based on available memory
SET shared_buffers = '256MB'; -- 25% of available RAM
SET work_mem = '64MB'; -- Memory for sorts and hash joins
