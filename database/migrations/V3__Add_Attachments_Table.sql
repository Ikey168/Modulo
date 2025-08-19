-- Migration for Azure Blob Storage Attachments
-- Version: V3__Add_Attachments_Table.sql

-- Create attachments table
CREATE TABLE IF NOT EXISTS application.attachments (
    attachment_id BIGSERIAL PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    blob_name VARCHAR(255) NOT NULL UNIQUE,
    content_type VARCHAR(100),
    file_size BIGINT,
    container_name VARCHAR(100) NOT NULL,
    blob_url TEXT NOT NULL,
    cdn_url TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by VARCHAR(255),
    note_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_attachment_note FOREIGN KEY (note_id) REFERENCES application.notes(note_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON application.attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON application.attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_blob_name ON application.attachments(blob_name);
CREATE INDEX IF NOT EXISTS idx_attachments_is_active ON application.attachments(is_active);
CREATE INDEX IF NOT EXISTS idx_attachments_content_type ON application.attachments(content_type);

-- Add comments for documentation
COMMENT ON TABLE application.attachments IS 'File attachments stored in Azure Blob Storage';
COMMENT ON COLUMN application.attachments.blob_name IS 'Unique blob name in Azure Storage';
COMMENT ON COLUMN application.attachments.container_name IS 'Azure Blob Storage container name';
COMMENT ON COLUMN application.attachments.blob_url IS 'Direct blob URL for file access';
COMMENT ON COLUMN application.attachments.cdn_url IS 'CDN URL for faster file access';
COMMENT ON COLUMN application.attachments.is_active IS 'Soft delete flag - false means deleted';
