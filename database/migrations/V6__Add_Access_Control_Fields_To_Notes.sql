-- V6__Add_Access_Control_Fields_To_Notes.sql
-- Migration to add access control fields to the notes table

ALTER TABLE application.notes 
ADD COLUMN IF NOT EXISTS access_control_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS owner_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS access_control_tx_hash VARCHAR(255);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notes_access_control_enabled ON application.notes(access_control_enabled);
CREATE INDEX IF NOT EXISTS idx_notes_owner_address ON application.notes(owner_address);
CREATE INDEX IF NOT EXISTS idx_notes_access_control_tx_hash ON application.notes(access_control_tx_hash);

-- Add comments for documentation
COMMENT ON COLUMN application.notes.access_control_enabled IS 'Indicates if blockchain-based access control is enabled for this note';
COMMENT ON COLUMN application.notes.owner_address IS 'Ethereum address of the note owner for blockchain access control';
COMMENT ON COLUMN application.notes.access_control_tx_hash IS 'Transaction hash when access control was enabled on blockchain';
