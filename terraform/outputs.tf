# Resource Group Information
output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_location" {
  description = "Location of the resource group"
  value       = azurerm_resource_group.main.location
}

# Network Outputs
output "vnet_id" {
  description = "ID of the virtual network"
  value       = module.network.vnet_id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = module.network.vnet_name
}

output "app_subnet_id" {
  description = "ID of the application subnet"
  value       = module.network.app_subnet_id
}

output "database_subnet_id" {
  description = "ID of the database subnet"
  value       = module.network.database_subnet_id
}

output "app_nsg_id" {
  description = "ID of the application network security group"
  value       = module.network.app_nsg_id
}

output "database_nsg_id" {
  description = "ID of the database network security group"
  value       = module.network.database_nsg_id
}

# Database Outputs
output "database_server_name" {
  description = "Name of the PostgreSQL server"
  value       = module.database.server_name
}

output "database_server_fqdn" {
  description = "FQDN of the PostgreSQL server"
  value       = module.database.server_fqdn
  sensitive   = true
}

output "database_connection_string" {
  description = "Connection string for the PostgreSQL database"
  value       = module.database.connection_string
  sensitive   = true
}

output "database_admin_username" {
  description = "Administrator username for the PostgreSQL server"
  value       = module.database.admin_username
}

# Storage Outputs
output "storage_account_name" {
  description = "Name of the storage account"
  value       = module.storage.storage_account_name
}

output "storage_account_primary_endpoint" {
  description = "Primary blob endpoint of the storage account"
  value       = module.storage.primary_blob_endpoint
}

output "storage_account_connection_string" {
  description = "Connection string for the storage account"
  value       = module.storage.connection_string
  sensitive   = true
}

output "storage_container_names" {
  description = "Names of the storage containers"
  value       = module.storage.container_names
}

# Monitoring Outputs
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = module.monitoring.log_analytics_workspace_id
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = module.monitoring.application_insights_instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights"
  value       = module.monitoring.application_insights_connection_string
  sensitive   = true
}

# Deployment-specific outputs for CI/CD workflows
output "deployment_outputs" {
  description = "Combined outputs for deployment workflows"
  value = {
    # Infrastructure
    resource_group_name = azurerm_resource_group.main.name
    location           = azurerm_resource_group.main.location
    
    # Network
    vnet_name      = module.network.vnet_name
    app_subnet_id  = module.network.app_subnet_id
    
    # Database
    database_server_name = module.database.server_name
    database_server_fqdn = module.database.server_fqdn
    database_name        = module.database.database_name
    
    # Storage
    storage_account_name    = module.storage.storage_account_name
    storage_primary_endpoint = module.storage.primary_blob_endpoint
    
    # Monitoring
    app_insights_key = module.monitoring.application_insights_instrumentation_key
    log_workspace_id = module.monitoring.log_analytics_workspace_id
  }
  sensitive = true
}

# Environment-specific configuration for apps
output "app_configuration" {
  description = "Application configuration values"
  value = {
    DATABASE_URL = module.database.connection_string
    STORAGE_CONNECTION_STRING = module.storage.connection_string
    APPLICATIONINSIGHTS_CONNECTION_STRING = module.monitoring.application_insights_connection_string
    LOG_ANALYTICS_WORKSPACE_ID = module.monitoring.log_analytics_workspace_id
  }
  sensitive = true
}
