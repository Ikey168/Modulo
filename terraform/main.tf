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

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  common_tags        = var.common_tags
}

# Database module
module "database" {
  source = "./modules/database"

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id          = module.network.database_subnet_id
  random_suffix      = random_string.suffix.result
  common_tags        = var.common_tags

  # Database configuration
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  sku_name              = var.db_sku_name
  storage_mb            = var.db_storage_mb
  backup_retention_days  = var.db_backup_retention_days
  geo_redundant_backup   = var.db_geo_redundant_backup
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
  account_replication_type = var.storage_replication_type
  enable_https_traffic     = var.storage_enable_https
  lifecycle_rules          = var.storage_lifecycle_rules
}

# Monitoring module
module "monitoring" {
  source = "./modules/monitoring"

  app_name           = var.app_name
  environment        = var.environment
  location           = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  common_tags        = var.common_tags

  # Monitoring targets
  database_server_id = module.database.server_id
  storage_account_id = module.storage.storage_account_id
}
