# Modulo Infrastructure Baseline
# Issue #98: Terraform baseline (VNet/VPC, Postgres, object storage, monitoring)

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure the Microsoft Azure Provider
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Random suffix for unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.app_name}-${var.environment}-rg"
  location = var.location

  tags = var.common_tags
}

# Network module
module "network" {
  source = "./modules/network"

  app_name                     = var.app_name
  environment                  = var.environment
  location                     = azurerm_resource_group.main.location
  resource_group_name          = azurerm_resource_group.main.name
  common_tags                  = var.common_tags
  
  # Network configuration
  vnet_address_space           = var.vnet_address_space
  app_subnet_address_prefixes  = var.app_subnet_address_prefixes
  db_subnet_address_prefixes   = var.db_subnet_address_prefixes
  management_ip_range          = var.management_ip_range
}

# Database module
module "database" {
  source = "./modules/database"

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id          = module.network.database_subnet_id
  private_dns_zone_id = module.network.private_dns_zone_id
  random_suffix      = random_string.suffix.result
  common_tags        = var.common_tags

  # Database configuration
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  db_version            = var.db_version
  sku_name              = var.db_sku_name
  storage_mb            = var.db_storage_mb
  backup_retention_days  = var.db_backup_retention_days
  geo_redundant_backup   = var.db_geo_redundant_backup
  enable_high_availability = var.db_enable_high_availability
  create_test_database  = var.create_test_database
  allow_azure_services  = var.allow_azure_services
}

# Storage module
module "storage" {
  source = "./modules/storage"

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  random_suffix      = random_string.suffix.result
  common_tags        = var.common_tags

  # Storage configuration
  account_tier             = var.storage_account_tier
  replication_type         = var.storage_replication_type
  enable_versioning        = var.storage_enable_versioning
  enable_change_feed       = var.storage_enable_change_feed
  container_names          = var.storage_container_names
  lifecycle_rules          = var.storage_lifecycle_rules
}

# Monitoring module
module "monitoring" {
  source = "./modules/monitoring"

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  random_suffix      = random_string.suffix.result
  common_tags        = var.common_tags

  # Monitoring configuration
  log_analytics_sku           = var.log_analytics_sku
  log_retention_days          = var.log_retention_days
  app_insights_retention_days = var.app_insights_retention_days
  app_insights_daily_cap_gb   = var.app_insights_daily_cap_gb
  
  # Alert configuration
  alert_email_recipients     = var.alert_email_recipients
  enable_performance_alerts  = var.enable_performance_alerts
  response_time_threshold_ms = var.response_time_threshold_ms
  failure_rate_threshold     = var.failure_rate_threshold
  enable_log_alerts         = var.enable_log_alerts
  error_spike_threshold     = var.error_spike_threshold
  
  # Database monitoring
  database_server_id         = module.database.server_id
  enable_database_alerts     = var.enable_database_alerts
  database_cpu_threshold     = var.database_cpu_threshold
  database_connections_threshold = var.database_connections_threshold
  
  # Storage monitoring
  storage_account_id         = module.storage.storage_account_id
  enable_storage_alerts      = var.enable_storage_alerts
  storage_availability_threshold = var.storage_availability_threshold
  
  # Additional features
  create_monitoring_workbook = var.create_monitoring_workbook
}
