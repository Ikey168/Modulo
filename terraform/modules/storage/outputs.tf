# Storage Module Outputs

output "storage_account_id" {
  description = "Storage account ID"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.main.name
}

output "storage_account_primary_endpoint" {
  description = "Primary blob service endpoint"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "storage_account_primary_access_key" {
  description = "Primary access key"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "storage_account_secondary_access_key" {
  description = "Secondary access key"
  value       = azurerm_storage_account.main.secondary_access_key
  sensitive   = true
}

output "storage_account_connection_string" {
  description = "Storage account connection string"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "container_names" {
  description = "Created container names"
  value       = [for container in azurerm_storage_container.containers : container.name]
}

output "container_urls" {
  description = "Container URLs"
  value = {
    for name, container in azurerm_storage_container.containers : 
    name => "${azurerm_storage_account.main.primary_blob_endpoint}${container.name}"
  }
}

output "private_endpoint_id" {
  description = "Private endpoint ID (if created)"
  value       = var.enable_private_endpoint ? azurerm_private_endpoint.storage[0].id : null
}

output "private_endpoint_ip" {
  description = "Private endpoint IP address (if created)"
  value       = var.enable_private_endpoint ? azurerm_private_endpoint.storage[0].private_service_connection[0].private_ip_address : null
}

output "backup_vault_id" {
  description = "Backup vault ID (if created)"
  value       = var.enable_backup ? azurerm_data_protection_backup_vault.main[0].id : null
}

output "backup_policy_id" {
  description = "Backup policy ID (if created)"
  value       = var.enable_backup ? azurerm_data_protection_backup_policy_blob_storage.main[0].id : null
}

# Configuration outputs for application use
output "blob_service_endpoint" {
  description = "Blob service endpoint for application configuration"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "storage_configuration" {
  description = "Storage configuration for application"
  value = {
    account_name       = azurerm_storage_account.main.name
    blob_endpoint      = azurerm_storage_account.main.primary_blob_endpoint
    containers         = [for container in azurerm_storage_container.containers : container.name]
    account_tier       = azurerm_storage_account.main.account_tier
    replication_type   = azurerm_storage_account.main.account_replication_type
    versioning_enabled = var.enable_versioning
  }
  sensitive = false
}
