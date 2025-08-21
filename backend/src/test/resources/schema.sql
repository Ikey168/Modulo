-- Test schema for H2 database
-- Plugin registry table for tests
CREATE TABLE IF NOT EXISTS plugin_registry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    author VARCHAR(255),
    type VARCHAR(50) NOT NULL DEFAULT 'INTERNAL',
    runtime VARCHAR(50) NOT NULL DEFAULT 'JAR',
    status VARCHAR(50) NOT NULL DEFAULT 'INACTIVE',
    config TEXT,
    config_schema TEXT,
    jar_path VARCHAR(500),
    main_class VARCHAR(500),
    dependencies TEXT,
    permissions TEXT,
    api_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    min_app_version VARCHAR(20),
    max_app_version VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    installed_at TIMESTAMP,
    last_loaded_at TIMESTAMP
);

-- Plugin submissions table for tests
CREATE TABLE IF NOT EXISTS plugin_submissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plugin_id BIGINT NOT NULL REFERENCES plugin_registry(id) ON DELETE CASCADE,
    submission_data TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);
