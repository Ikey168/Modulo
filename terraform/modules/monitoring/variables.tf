# Monitoring Module Variables

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

# Log Analytics Configuration
variable "log_analytics_sku" {
  description = "Log Analytics workspace SKU"
  type        = string
  default     = "PerGB2018"
  validation {
    condition     = contains(["Free", "Standalone", "PerNode", "PerGB2018"], var.log_analytics_sku)
    error_message = "Log Analytics SKU must be Free, Standalone, PerNode, or PerGB2018."
  }
}

variable "log_retention_days" {
  description = "Log retention in days"
  type        = number
  default     = 30
  validation {
    condition     = var.log_retention_days >= 30 && var.log_retention_days <= 730
    error_message = "Log retention must be between 30 and 730 days."
  }
}

variable "daily_quota_gb" {
  description = "Daily ingestion quota in GB (-1 for unlimited)"
  type        = number
  default     = -1
}

variable "internet_ingestion_enabled" {
  description = "Enable internet ingestion for Log Analytics"
  type        = bool
  default     = true
}

variable "internet_query_enabled" {
  description = "Enable internet query for Log Analytics"
  type        = bool
  default     = true
}

variable "disable_local_auth" {
  description = "Disable local authentication"
  type        = bool
  default     = false
}

# Application Insights Configuration
variable "application_type" {
  description = "Application Insights application type"
  type        = string
  default     = "web"
  validation {
    condition     = contains(["ios", "java", "MobileCenter", "Node.JS", "other", "phone", "store", "web"], var.application_type)
    error_message = "Application type must be a valid Application Insights type."
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

variable "disable_daily_cap_notifications" {
  description = "Disable daily cap notifications"
  type        = bool
  default     = false
}

variable "disable_ip_masking" {
  description = "Disable IP masking in Application Insights"
  type        = bool
  default     = false
}

# Alert Configuration
variable "alert_email_recipients" {
  description = "Map of email recipients for alerts"
  type        = map(string)
  default     = {}
}

variable "alert_webhooks" {
  description = "List of webhook configurations for alerts"
  type = list(object({
    name = string
    uri  = string
  }))
  default = []
}

variable "alert_sms_recipients" {
  description = "Map of SMS recipients for alerts"
  type = map(object({
    country_code = string
    phone_number = string
  }))
  default = {}
}

# Performance Alert Thresholds
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

# Log Alert Configuration
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

# Database Monitoring (optional)
variable "database_server_id" {
  description = "Database server resource ID for monitoring"
  type        = string
  default     = null
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

# Storage Monitoring (optional)
variable "storage_account_id" {
  description = "Storage account resource ID for monitoring"
  type        = string
  default     = null
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

# Additional Features
variable "create_monitoring_workbook" {
  description = "Create monitoring workbook dashboard"
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
