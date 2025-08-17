# Development Environment Configuration
# This file contains development-specific variable values

# Basic Configuration
app_name    = "modulo"
environment = "dev"
location    = "East US"

# Network Configuration
vnet_address_space     = ["10.0.0.0/16"]
app_subnet_cidr        = "10.0.1.0/24"
database_subnet_cidr   = "10.0.2.0/24"

# Database Configuration
db_sku_name              = "B_Standard_B1ms"  # Basic tier for dev
db_storage_mb            = 32768  # 32 GB
db_backup_retention_days = 7
db_geo_redundant_backup  = false
db_enable_high_availability = false
create_test_database     = true

# Storage Configuration
storage_account_tier        = "Standard"
storage_replication_type    = "LRS"
storage_enable_versioning   = true
storage_enable_change_feed  = false
storage_container_names     = ["uploads", "documents", "backups", "logs", "temp"]

# Storage lifecycle rules for development
storage_lifecycle_rules = [
  {
    name                          = "dev-lifecycle"
    enabled                       = true
    prefix_match                  = ["temp/", "logs/"]
    blob_types                    = ["blockBlob"]
    tier_to_cool_after_days      = 7   # Quick cool for dev
    tier_to_archive_after_days   = 30  # Quick archive for dev
    delete_after_days            = 90  # Keep for 3 months
    snapshot_delete_after_days   = 7
    version_delete_after_days    = 7
  }
]

# Monitoring Configuration
log_analytics_sku           = "PerGB2018"
log_retention_days          = 30  # Minimum for dev
app_insights_retention_days = 30
app_insights_daily_cap_gb   = 10  # Lower cap for dev

# Alert Configuration (relaxed for dev)
enable_performance_alerts     = true
response_time_threshold_ms    = 10000  # 10 seconds for dev
failure_rate_threshold        = 20     # Higher tolerance for dev
enable_log_alerts            = false   # Disable for dev to reduce noise
error_spike_threshold        = 100

# Database monitoring thresholds (relaxed for dev)
enable_database_alerts         = true
database_cpu_threshold         = 90
database_connections_threshold = 50

# Storage monitoring
enable_storage_alerts           = false  # Disable for dev
storage_availability_threshold  = 95

# Development-specific features
create_monitoring_workbook = true

# Security and access (more open for dev)
allow_azure_services = true
# development_ip_range = "YOUR_DEV_IP/32"  # Uncomment and set your IP

# Private endpoints (disabled for dev to reduce costs)
enable_private_endpoint = false

# Backup (disabled for dev to reduce costs)
enable_backup = false

# Alert recipients for development
alert_email_recipients = {
  # "dev-team" = "dev-team@yourcompany.com"
}

# Common tags
common_tags = {
  Environment = "dev"
  Project     = "modulo"
  Owner       = "dev-team"
  CostCenter  = "development"
}
