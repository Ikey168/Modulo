-- Migration V5: Add Blockchain Access Control Support
-- This migration adds tables and fields to support blockchain-based access control

-- Create note_permissions table to track access control
CREATE TABLE IF NOT EXISTS application.note_permissions (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT NOT NULL REFERENCES application.notes(id) ON DELETE CASCADE,
    user_address VARCHAR(42) NOT NULL, -- Ethereum address
    permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('READ', 'write', 'admin')),
    granted_by_address VARCHAR(42) NOT NULL, -- Address that granted permission
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blockchain_tx_hash VARCHAR(66), -- Transaction hash of permission grant
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique permission per user per note
    UNIQUE(note_id, user_address)
);

-- Add access control fields to notes table
ALTER TABLE application.notes 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS access_control_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS owner_address VARCHAR(42), -- Blockchain owner address
ADD COLUMN IF NOT EXISTS access_control_tx_hash VARCHAR(66); -- Transaction hash for access control setup

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_permissions_note_id ON application.note_permissions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_permissions_user_address ON application.note_permissions(user_address);
CREATE INDEX IF NOT EXISTS idx_note_permissions_permission_level ON application.note_permissions(permission_level);
CREATE INDEX IF NOT EXISTS idx_note_permissions_active ON application.note_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON application.notes(is_public);
CREATE INDEX IF NOT EXISTS idx_notes_access_control_enabled ON application.notes(access_control_enabled);
CREATE INDEX IF NOT EXISTS idx_notes_owner_address ON application.notes(owner_address);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_note_permissions_note_user ON application.note_permissions(note_id, user_address);
CREATE INDEX IF NOT EXISTS idx_note_permissions_user_permission ON application.note_permissions(user_address, permission_level);

-- Create audit table for access control events
CREATE TABLE IF NOT EXISTS application.access_control_audit (
    id BIGSERIAL PRIMARY KEY,
    note_id BIGINT NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('grant_permission', 'revoke_permission', 'change_visibility', 'transfer_ownership')),
    actor_address VARCHAR(42) NOT NULL, -- Address performing the action
    target_address VARCHAR(42), -- Address being granted/revoked permission (null for visibility changes)
    permission_level VARCHAR(20), -- Permission level (null for visibility/ownership changes)
    old_value TEXT, -- Previous state (for changes)
    new_value TEXT, -- New state
    blockchain_tx_hash VARCHAR(66), -- Transaction hash
    block_number BIGINT, -- Block number
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit table
CREATE INDEX IF NOT EXISTS idx_access_control_audit_note_id ON application.access_control_audit(note_id);
CREATE INDEX IF NOT EXISTS idx_access_control_audit_actor ON application.access_control_audit(actor_address);
CREATE INDEX IF NOT EXISTS idx_access_control_audit_action ON application.access_control_audit(action_type);
CREATE INDEX IF NOT EXISTS idx_access_control_audit_created_at ON application.access_control_audit(created_at);

-- Create view for easy access to note permissions with user details
CREATE OR REPLACE VIEW application.v_note_permissions AS
SELECT 
    np.id,
    np.note_id,
    n.title as note_title,
    n.user_id as note_owner_user_id,
    np.user_address,
    np.permission_level,
    np.granted_by_address,
    np.granted_at,
    np.blockchain_tx_hash,
    np.is_active,
    n.is_public,
    n.access_control_enabled,
    n.owner_address as note_owner_address
FROM application.note_permissions np
JOIN application.notes n ON np.note_id = n.id
WHERE np.is_active = TRUE AND n.is_active = TRUE;

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION application.check_note_permission(
    p_note_id BIGINT,
    p_user_address VARCHAR(42),
    p_required_permission VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
    note_record RECORD;
    user_permission VARCHAR(20);
    permission_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    -- Get note details
    SELECT is_public, access_control_enabled, owner_address 
    INTO note_record 
    FROM application.notes 
    WHERE id = p_note_id AND is_active = TRUE;
    
    -- Note doesn't exist
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Owner has all permissions
    IF note_record.owner_address = p_user_address THEN
        RETURN TRUE;
    END IF;
    
    -- Public read access
    IF note_record.is_public = TRUE AND p_required_permission = 'read' THEN
        RETURN TRUE;
    END IF;
    
    -- Access control not enabled
    IF note_record.access_control_enabled = FALSE THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's permission level
    SELECT permission_level 
    INTO user_permission 
    FROM application.note_permissions 
    WHERE note_id = p_note_id 
      AND user_address = p_user_address 
      AND is_active = TRUE;
    
    -- No explicit permission
    IF user_permission IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Convert permission levels to hierarchy
    permission_hierarchy := CASE user_permission
        WHEN 'read' THEN 1
        WHEN 'write' THEN 2
        WHEN 'admin' THEN 3
        ELSE 0
    END;
    
    required_hierarchy := CASE p_required_permission
        WHEN 'read' THEN 1
        WHEN 'write' THEN 2
        WHEN 'admin' THEN 3
        ELSE 0
    END;
    
    -- Check if user has sufficient permission level
    RETURN permission_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION application.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for note_permissions table
DROP TRIGGER IF EXISTS update_note_permissions_updated_at ON application.note_permissions;
CREATE TRIGGER update_note_permissions_updated_at
    BEFORE UPDATE ON application.note_permissions
    FOR EACH ROW
    EXECUTE FUNCTION application.update_updated_at_column();

-- Add comments to document the schema
COMMENT ON TABLE application.note_permissions IS 'Stores blockchain-based access control permissions for notes';
COMMENT ON COLUMN application.note_permissions.user_address IS 'Ethereum address of the user with permission';
COMMENT ON COLUMN application.note_permissions.permission_level IS 'Permission level: read, write, or admin';
COMMENT ON COLUMN application.note_permissions.granted_by_address IS 'Ethereum address that granted this permission';
COMMENT ON COLUMN application.note_permissions.blockchain_tx_hash IS 'Transaction hash of the permission grant on blockchain';

COMMENT ON TABLE application.access_control_audit IS 'Audit trail for all access control changes';
COMMENT ON COLUMN application.access_control_audit.action_type IS 'Type of access control action performed';
COMMENT ON COLUMN application.access_control_audit.blockchain_tx_hash IS 'Transaction hash of the blockchain operation';

COMMENT ON COLUMN application.notes.is_public IS 'Whether the note is publicly readable';
COMMENT ON COLUMN application.notes.access_control_enabled IS 'Whether blockchain-based access control is enabled for this note';
COMMENT ON COLUMN application.notes.owner_address IS 'Ethereum address of the note owner';
COMMENT ON COLUMN application.notes.access_control_tx_hash IS 'Transaction hash for access control setup';

COMMENT ON VIEW application.v_note_permissions IS 'Convenient view for querying note permissions with related data';
COMMENT ON FUNCTION application.check_note_permission IS 'Function to check if a user has specific permission on a note';
