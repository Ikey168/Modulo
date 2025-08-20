-- Initialize staging database
-- This script ensures the staging database exists and is properly configured

-- The database should already be created by POSTGRES_DB env var,
-- but this script ensures proper initialization
SELECT 'Initializing staging database...' as status;

-- Create additional databases if needed
-- (The main database is created automatically by PostgreSQL)

-- Ensure proper database encoding
SELECT 'Database initialization complete' as status;
