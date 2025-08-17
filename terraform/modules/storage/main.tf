# Storage Module - Azure Blob Storage
# Provides object storage with containers and lifecycle management

# Storage Account
resource "azurerm_storage_account" "main" {
  name                = "${var.app_name}${var.environment}storage${var.random_suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location

  account_tier             = var.account_tier
  account_replication_type = var.replication_type
  account_kind            = "StorageV2"

  # Security configurations
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  enable_https_traffic_only       = true

  # Network access rules
  network_rules {
    default_action             = "Deny"
    ip_rules                   = var.allowed_ip_ranges
    virtual_network_subnet_ids = var.allowed_subnet_ids
    bypass                     = ["AzureServices"]
  }

  # Blob properties
  blob_properties {
    # Versioning
    versioning_enabled = var.enable_versioning
    
    # Change feed
    change_feed_enabled = var.enable_change_feed
    
    # Point-in-time restore
    dynamic "restore_policy" {
      for_each = var.point_in_time_restore_days > 0 ? [1] : []
      content {
        days = var.point_in_time_restore_days
      }
    }

    # Container delete retention
    dynamic "container_delete_retention_policy" {
      for_each = var.container_delete_retention_days > 0 ? [1] : []
      content {
        days = var.container_delete_retention_days
      }
    }

    # Blob delete retention
    dynamic "delete_retention_policy" {
      for_each = var.blob_delete_retention_days > 0 ? [1] : []
      content {
        days = var.blob_delete_retention_days
      }
    }
  }

  tags = var.common_tags
}

# Storage containers
resource "azurerm_storage_container" "containers" {
  for_each              = toset(var.container_names)
  name                  = each.value
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = var.container_access_type
}

# Storage Management Policy for lifecycle rules - Disabled for now due to API changes
# resource "azurerm_storage_management_policy" "main" {
#   count              = length(var.lifecycle_rules) > 0 ? 1 : 0
#   storage_account_id = azurerm_storage_account.main.id

#   dynamic "rule" {
#     for_each = var.lifecycle_rules
#     content {
#       name    = rule.value.name
#       enabled = rule.value.enabled

#       filters {
#         prefix_match = rule.value.prefix_match
#         blob_types   = rule.value.blob_types
#       }

#       actions {
#         base_blob {
#           tier_to_cool_after_days_since_modification_greater_than    = rule.value.tier_to_cool_after_days
#           tier_to_archive_after_days_since_modification_greater_than = rule.value.tier_to_archive_after_days
#           delete_after_days_since_modification_greater_than          = rule.value.delete_after_days
#         }

#         dynamic "snapshot" {
#           for_each = rule.value.snapshot_delete_after_days != null ? [1] : []
#           content {
#             days_after_creation_greater_than = rule.value.snapshot_delete_after_days
#           }
#         }

#         dynamic "version" {
#           for_each = rule.value.version_delete_after_days != null ? [1] : []
#           content {
#             days_after_creation_greater_than = rule.value.version_delete_after_days
#           }
#         }
#       }
#     }
#   }
# }

# Private endpoint for storage account (optional)
resource "azurerm_private_endpoint" "storage" {
  count               = var.enable_private_endpoint ? 1 : 0
  name                = "${azurerm_storage_account.main.name}-endpoint"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_subnet_id

  private_service_connection {
    name                           = "${azurerm_storage_account.main.name}-connection"
    private_connection_resource_id = azurerm_storage_account.main.id
    subresource_names              = ["blob"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = var.private_dns_zone_ids
  }

  tags = var.common_tags
}

# Storage account diagnostics
resource "azurerm_monitor_diagnostic_setting" "storage" {
  count              = var.enable_diagnostics ? 1 : 0
  name               = "${azurerm_storage_account.main.name}-diagnostics"
  target_resource_id = "${azurerm_storage_account.main.id}/blobServices/default"
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "StorageRead"
  }

  enabled_log {
    category = "StorageWrite"
  }

  enabled_log {
    category = "StorageDelete"
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = false
    }
  }
}

# Data protection - backup vault (optional)
resource "azurerm_data_protection_backup_vault" "main" {
  count               = var.enable_backup ? 1 : 0
  name                = "${var.app_name}-${var.environment}-backup-vault-${var.random_suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  datastore_type      = "VaultStore"
  redundancy          = var.backup_redundancy

  tags = var.common_tags
}

# Backup policy for storage account
resource "azurerm_data_protection_backup_policy_blob_storage" "main" {
  count              = var.enable_backup ? 1 : 0
  name               = "${var.app_name}-${var.environment}-blob-backup-policy"
  vault_id           = azurerm_data_protection_backup_vault.main[0].id
  retention_duration = var.backup_retention_duration
}

# Backup instance for storage account
resource "azurerm_data_protection_backup_instance_blob_storage" "main" {
  count              = var.enable_backup ? 1 : 0
  name               = "${azurerm_storage_account.main.name}-backup"
  vault_id           = azurerm_data_protection_backup_vault.main[0].id
  location           = var.location
  storage_account_id = azurerm_storage_account.main.id
  backup_policy_id   = azurerm_data_protection_backup_policy_blob_storage.main[0].id
}
