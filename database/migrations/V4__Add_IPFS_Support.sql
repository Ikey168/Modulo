-- Migration V4: Add IPFS support to notes table
-- This migration adds IPFS Content Identifier (CID) and metadata fields for decentralized storage

-- Add IPFS fields to notes table
ALTER TABLE application.notes 
ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255),
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS ipfs_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_decentralized BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index on IPFS CID for fast lookups
CREATE INDEX IF NOT EXISTS idx_notes_ipfs_cid ON application.notes(ipfs_cid);

-- Create index on content hash for integrity verification
CREATE INDEX IF NOT EXISTS idx_notes_content_hash ON application.notes(content_hash);

-- Create index on decentralized flag for filtering
CREATE INDEX IF NOT EXISTS idx_notes_is_decentralized ON application.notes(is_decentralized);

-- Add comment to document the purpose
COMMENT ON COLUMN application.notes.ipfs_cid IS 'IPFS Content Identifier for decentralized storage';
COMMENT ON COLUMN application.notes.content_hash IS 'SHA-256 hash of note content for integrity verification';
COMMENT ON COLUMN application.notes.ipfs_uploaded_at IS 'Timestamp when note was uploaded to IPFS';
COMMENT ON COLUMN application.notes.is_decentralized IS 'Flag indicating if note is stored on IPFS';
