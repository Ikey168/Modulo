# Production Environment Configuration
# This file contains production-specific variable values with enhanced security and reliability

# Basic Configuration
app_name    = "modulo"
environment = "prod"
location    = "East US"

# Network Configuration
vnet_address_space     = ["10.1.0.0/16"]
app_subnet_cidr        = "10.1.1.0/24"
database_subnet_cidr   = "10.1.2.0/24"

# Database Configuration - Production settings
db_sku_name              = "GP_Standard_D2s_v3"  # General Purpose for production
db_storage_mb            = 131072  # 128 GB
db_backup_retention_days = 35      # Maximum retention
db_geo_redundant_backup  = true    # Enable geo-redundancy
db_enable_high_availability = true # Enable HA for production
create_test_database     = false   # No test DB in production

# Storage Configuration - Production settings
storage_account_tier        = "Standard"
storage_replication_type    = "GRS"  # Geo-redundant for production
storage_enable_versioning   = true
storage_enable_change_feed  = true   # Enable for audit trails
storage_container_names     = ["uploads", "documents", "backups", "logs", "archives"]

# Storage lifecycle rules for production
storage_lifecycle_rules = [
  {
    name                          = "prod-lifecycle"
    enabled                       = true
    prefix_match                  = ["logs/", "temp/"]
    blob_types                    = ["blockBlob"]
    tier_to_cool_after_days      = 30
    tier_to_archive_after_days   = 90
    delete_after_days            = 2555  # 7 years retention
    snapshot_delete_after_days   = 90
    version_delete_after_days    = 90
  },
  {
    name                          = "archives-lifecycle"
    enabled                       = true
    prefix_match                  = ["archives/"]
    blob_types                    = ["blockBlob"]
    tier_to_cool_after_days      = 0
    tier_to_archive_after_days   = 1
    delete_after_days            = 3650  # 10 years for archives
    snapshot_delete_after_days   = 365
    version_delete_after_days    = 365
  }
]

# Monitoring Configuration - Production settings
log_analytics_sku           = "PerGB2018"
log_retention_days          = 365  # 1 year retention for production
app_insights_retention_days = 365
app_insights_daily_cap_gb   = 100

# Alert Configuration - Strict for production
enable_performance_alerts     = true
response_time_threshold_ms    = 3000   # 3 seconds for production
failure_rate_threshold        = 5      # Low tolerance for production
enable_log_alerts            = true
error_spike_threshold        = 20

# Database monitoring thresholds - Strict for production
enable_database_alerts         = true
database_cpu_threshold         = 70
database_connections_threshold = 80

# Storage monitoring - Enabled for production
enable_storage_alerts           = true
storage_availability_threshold  = 99.9

# Production features
create_monitoring_workbook = true

# Security and access - Restrictive for production
allow_azure_services = false  # More restrictive
# development_ip_range = null  # No dev access in production

# Private endpoints - Enabled for production security
enable_private_endpoint = true

# Backup - Enabled for production
enable_backup              = true
backup_redundancy          = "GloballyRedundant"
backup_retention_duration  = "P365D"  # 1 year backup retention

# Point-in-time restore for production
point_in_time_restore_days     = 30
container_delete_retention_days = 30
blob_delete_retention_days     = 30

# Alert recipients for production
alert_email_recipients = {
  # "ops-team"     = "ops-team@yourcompany.com"
  # "dev-leads"    = "dev-leads@yourcompany.com"
  # "on-call"      = "oncall@yourcompany.com"
}

# Webhook for integration with incident management
alert_webhooks = [
  # {
  #   name = "incident-management"
  #   uri  = "https://your-incident-management-system.com/webhook"
  # }
]

# SMS alerts for critical issues
alert_sms_recipients = {
  # "on-call-primary" = {
  #   country_code = "1"
  #   phone_number = "5551234567"
  # }
}

# Common tags
common_tags = {
  Environment = "prod"
  Project     = "modulo"
  Owner       = "platform-team"
  CostCenter  = "production"
  Criticality = "high"
  DataClass   = "confidential"
}
