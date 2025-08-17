# Core Configuration
variable "app_name" {
  description = "Base name for all resources"
  type        = string
  default     = "modulo"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Network Configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "app_subnet_address_prefixes" {
  description = "Address prefixes for application subnet"
  type        = list(string)
  default     = ["10.0.1.0/24"]
}

variable "db_subnet_address_prefixes" {
  description = "Address prefixes for database subnet"
  type        = list(string)
  default     = ["10.0.2.0/24"]
}

# Database Configuration
variable "db_admin_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "modulo_admin"
}

variable "db_admin_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "db_sku_name" {
  description = "Database SKU name"
  type        = string
  default     = "GP_Standard_D2s_v3"
  validation {
    condition = can(regex("^(B_Standard_B[1-4]ms|GP_Standard_D[2-64]s_v3|MO_Standard_E[2-64]s_v3)$", var.db_sku_name))
    error_message = "SKU name must be a valid PostgreSQL Flexible Server SKU."
  }
}

variable "db_storage_mb" {
  description = "Storage size in MB"
  type        = number
  default     = 32768  # 32 GB
  validation {
    condition     = var.db_storage_mb >= 32768 && var.db_storage_mb <= 16777216
    error_message = "Storage must be between 32 GB (32768 MB) and 16 TB (16777216 MB)."
  }
}

variable "db_backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 7 && var.db_backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

variable "db_geo_redundant_backup" {
  description = "Enable geo-redundant backup"
  type        = bool
  default     = false
}

variable "db_version" {
  description = "PostgreSQL server version"
  type        = string
  default     = "14"
  validation {
    condition     = contains(["11", "12", "13", "14", "15"], var.db_version)
    error_message = "PostgreSQL version must be 11, 12, 13, 14, or 15."
  }
}

variable "db_enable_high_availability" {
  description = "Enable high availability for PostgreSQL server"
  type        = bool
  default     = false
}

variable "create_test_database" {
  description = "Create additional test database"
  type        = bool
  default     = false
}

variable "allow_azure_services" {
  description = "Allow Azure services to access the database"
  type        = bool
  default     = true
}

# Storage Configuration
variable "storage_account_tier" {
  description = "Performance tier for storage account"
  type        = string
  default     = "Standard"
  validation {
    condition     = contains(["Standard", "Premium"], var.storage_account_tier)
    error_message = "Storage account tier must be Standard or Premium."
  }
}

variable "storage_replication_type" {
  description = "Replication type for storage account"
  type        = string
  default     = "LRS"
  validation {
    condition = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_replication_type)
    error_message = "Storage replication type must be LRS, GRS, RAGRS, ZRS, GZRS, or RAGZRS."
  }
}

variable "storage_enable_versioning" {
  description = "Enable blob versioning"
  type        = bool
  default     = true
}

variable "storage_enable_change_feed" {
  description = "Enable blob change feed"
  type        = bool
  default     = false
}

variable "storage_container_names" {
  description = "List of container names to create"
  type        = list(string)
  default     = ["uploads", "documents", "backups", "logs"]
}

variable "storage_lifecycle_rules" {
  description = "Lifecycle management rules for blob storage"
  type = list(object({
    name                                     = string
    enabled                                  = bool
    prefix_match                            = list(string)
    blob_types                              = list(string)
    tier_to_cool_after_days                = number
    tier_to_archive_after_days             = number
    delete_after_days                      = number
    snapshot_delete_after_days             = number
    version_delete_after_days              = number
  }))
  default = []
}

# Monitoring Configuration
variable "log_retention_days" {
  description = "Log retention period in days"
  type        = number
  default     = 30
  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention must be between 30 and 730 days."
  }
}

variable "log_analytics_sku" {
  description = "Log Analytics workspace SKU"
  type        = string
  default     = "PerGB2018"
  validation {
    condition     = contains(["Free", "Standalone", "PerNode", "PerGB2018"], var.log_analytics_sku)
    error_message = "Log Analytics SKU must be Free, Standalone, PerNode, or PerGB2018."
  }
}

variable "app_insights_retention_days" {
  description = "Application Insights retention in days"
  type        = number
  default     = 90
  validation {
    condition     = var.app_insights_retention_days >= 30 && var.app_insights_retention_days <= 730
    error_message = "Application Insights retention must be between 30 and 730 days."
  }
}

variable "app_insights_daily_cap_gb" {
  description = "Application Insights daily cap in GB"
  type        = number
  default     = 100
}

variable "alert_email_recipients" {
  description = "Email addresses for alert notifications"
  type        = map(string)
  default     = {}
}

variable "enable_performance_alerts" {
  description = "Enable performance monitoring alerts"
  type        = bool
  default     = true
}

variable "response_time_threshold_ms" {
  description = "Response time threshold in milliseconds"
  type        = number
  default     = 5000
}

variable "failure_rate_threshold" {
  description = "Failure rate threshold (count per 5 minutes)"
  type        = number
  default     = 10
}

variable "enable_log_alerts" {
  description = "Enable log-based alerts"
  type        = bool
  default     = true
}

variable "error_spike_threshold" {
  description = "Error spike threshold (errors per 5 minutes)"
  type        = number
  default     = 50
}

variable "enable_database_alerts" {
  description = "Enable database monitoring alerts"
  type        = bool
  default     = true
}

variable "database_cpu_threshold" {
  description = "Database CPU usage threshold percentage"
  type        = number
  default     = 80
  validation {
    condition     = var.database_cpu_threshold >= 0 && var.database_cpu_threshold <= 100
    error_message = "Database CPU threshold must be between 0 and 100."
  }
}

variable "database_connections_threshold" {
  description = "Database connections threshold"
  type        = number
  default     = 80
}

variable "enable_storage_alerts" {
  description = "Enable storage monitoring alerts"
  type        = bool
  default     = true
}

variable "storage_availability_threshold" {
  description = "Storage availability threshold percentage"
  type        = number
  default     = 99.9
  validation {
    condition     = var.storage_availability_threshold >= 0 && var.storage_availability_threshold <= 100
    error_message = "Storage availability threshold must be between 0 and 100."
  }
}

variable "create_monitoring_workbook" {
  description = "Create monitoring workbook dashboard"
  type        = bool
  default     = true
}