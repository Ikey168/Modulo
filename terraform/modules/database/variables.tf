# Database Module Variables

variable "app_name" {
  description = "Application name"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group name"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "random_suffix" {
  description = "Random suffix for unique naming"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for database server"
  type        = string
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for PostgreSQL"
  type        = string
}

variable "administrator_login" {
  description = "PostgreSQL administrator login"
  type        = string
  default     = "modulo_admin"
}

variable "administrator_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "db_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "14"
  validation {
    condition     = contains(["11", "12", "13", "14", "15"], var.db_version)
    error_message = "Database version must be 11, 12, 13, 14, or 15."
  }
}

variable "sku_name" {
  description = "Database SKU name"
  type        = string
  default     = "GP_Standard_D2s_v3"
  validation {
    condition = can(regex("^(B_Standard_B[1-4]ms|GP_Standard_D[2-64]s_v3|MO_Standard_E[2-64]s_v3)$", var.sku_name))
    error_message = "SKU name must be a valid PostgreSQL Flexible Server SKU."
  }
}

variable "storage_mb" {
  description = "Storage size in MB"
  type        = number
  default     = 32768  # 32 GB
  validation {
    condition     = var.storage_mb >= 32768 && var.storage_mb <= 16777216
    error_message = "Storage must be between 32 GB (32768 MB) and 16 TB (16777216 MB)."
  }
}

variable "backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_days >= 7 && var.backup_retention_days <= 35
    error_message = "Backup retention must be between 7 and 35 days."
  }
}

variable "geo_redundant_backup" {
  description = "Enable geo-redundant backup"
  type        = bool
  default     = false
}

variable "enable_high_availability" {
  description = "Enable high availability (zone redundant)"
  type        = bool
  default     = false
}

variable "maintenance_window" {
  description = "Maintenance window configuration"
  type = object({
    day_of_week  = number
    start_hour   = number
    start_minute = number
  })
  default = {
    day_of_week  = 0  # Sunday
    start_hour   = 3  # 3 AM
    start_minute = 0
  }
  validation {
    condition = (
      var.maintenance_window.day_of_week >= 0 && var.maintenance_window.day_of_week <= 6 &&
      var.maintenance_window.start_hour >= 0 && var.maintenance_window.start_hour <= 23 &&
      var.maintenance_window.start_minute >= 0 && var.maintenance_window.start_minute <= 59
    )
    error_message = "Invalid maintenance window configuration."
  }
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

variable "development_ip_range" {
  description = "IP range for development access (CIDR notation)"
  type        = string
  default     = null
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
