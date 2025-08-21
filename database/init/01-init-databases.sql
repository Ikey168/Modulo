-- PostgreSQL Database Initialization Script
-- This script creates necessary databases for different environments

-- Create staging database if it doesn't exist
SELECT 'CREATE DATABASE modulodb_staging'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'modulodb_staging')\gexec

-- Create test database if it doesn't exist  
SELECT 'CREATE DATABASE modulodb_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'modulodb_test')\gexec
