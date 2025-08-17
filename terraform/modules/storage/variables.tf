# Storage Module Variables

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

variable "account_tier" {
  description = "Storage account tier"
  type        = string
  default     = "Standard"
  validation {
    condition     = contains(["Standard", "Premium"], var.account_tier)
    error_message = "Account tier must be Standard or Premium."
  }
}

variable "replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"
  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.replication_type)
    error_message = "Replication type must be LRS, GRS, RAGRS, ZRS, GZRS, or RAGZRS."
  }
}

variable "container_names" {
  description = "List of container names to create"
  type        = list(string)
  default     = ["uploads", "documents", "backups", "logs"]
}

variable "container_access_type" {
  description = "Container access type"
  type        = string
  default     = "private"
  validation {
    condition     = contains(["private", "blob", "container"], var.container_access_type)
    error_message = "Container access type must be private, blob, or container."
  }
}

variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access storage"
  type        = list(string)
  default     = []
}

variable "allowed_subnet_ids" {
  description = "List of subnet IDs allowed to access storage"
  type        = list(string)
  default     = []
}

variable "enable_versioning" {
  description = "Enable blob versioning"
  type        = bool
  default     = true
}

variable "enable_change_feed" {
  description = "Enable blob change feed"
  type        = bool
  default     = false
}

variable "point_in_time_restore_days" {
  description = "Number of days for point-in-time restore (0 to disable)"
  type        = number
  default     = 0
  validation {
    condition     = var.point_in_time_restore_days >= 0 && var.point_in_time_restore_days <= 365
    error_message = "Point-in-time restore days must be between 0 and 365."
  }
}

variable "container_delete_retention_days" {
  description = "Container delete retention in days (0 to disable)"
  type        = number
  default     = 7
  validation {
    condition     = var.container_delete_retention_days >= 0 && var.container_delete_retention_days <= 365
    error_message = "Container delete retention must be between 0 and 365 days."
  }
}

variable "blob_delete_retention_days" {
  description = "Blob delete retention in days (0 to disable)"
  type        = number
  default     = 7
  validation {
    condition     = var.blob_delete_retention_days >= 0 && var.blob_delete_retention_days <= 365
    error_message = "Blob delete retention must be between 0 and 365 days."
  }
}

variable "lifecycle_rules" {
  description = "List of lifecycle management rules"
  type = list(object({
    name                          = string
    enabled                       = bool
    prefix_match                  = list(string)
    blob_types                    = list(string)
    tier_to_cool_after_days      = number
    tier_to_archive_after_days   = number
    delete_after_days            = number
    snapshot_delete_after_days   = number
    version_delete_after_days    = number
  }))
  default = [
    {
      name                          = "default-lifecycle"
      enabled                       = true
      prefix_match                  = ["logs/", "temp/"]
      blob_types                    = ["blockBlob"]
      tier_to_cool_after_days      = 30
      tier_to_archive_after_days   = 90
      delete_after_days            = 365
      snapshot_delete_after_days   = 30
      version_delete_after_days    = 30
    }
  ]
}

variable "enable_private_endpoint" {
  description = "Enable private endpoint for storage account"
  type        = bool
  default     = false
}

variable "private_endpoint_subnet_id" {
  description = "Subnet ID for private endpoint"
  type        = string
  default     = null
}

variable "private_dns_zone_ids" {
  description = "Private DNS zone IDs for private endpoint"
  type        = list(string)
  default     = []
}

variable "enable_diagnostics" {
  description = "Enable diagnostic settings"
  type        = bool
  default     = true
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for diagnostics"
  type        = string
  default     = null
}

variable "enable_backup" {
  description = "Enable Azure backup for storage account"
  type        = bool
  default     = false
}

variable "backup_redundancy" {
  description = "Backup redundancy type"
  type        = string
  default     = "LocallyRedundant"
  validation {
    condition     = contains(["LocallyRedundant", "GloballyRedundant"], var.backup_redundancy)
    error_message = "Backup redundancy must be LocallyRedundant or GloballyRedundant."
  }
}

variable "backup_retention_duration" {
  description = "Backup retention duration (ISO 8601 format)"
  type        = string
  default     = "P30D"  # 30 days
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
