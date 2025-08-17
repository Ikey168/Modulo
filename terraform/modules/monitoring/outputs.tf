# Monitoring Module Outputs

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID"
  value       = azurerm_log_analytics_workspace.main.id
}

output "log_analytics_workspace_name" {
  description = "Log Analytics workspace name"
  value       = azurerm_log_analytics_workspace.main.name
}

output "log_analytics_workspace_key" {
  description = "Log Analytics workspace primary shared key"
  value       = azurerm_log_analytics_workspace.main.primary_shared_key
  sensitive   = true
}

output "application_insights_id" {
  description = "Application Insights ID"
  value       = azurerm_application_insights.main.id
}

output "application_insights_name" {
  description = "Application Insights name"
  value       = azurerm_application_insights.main.name
}

output "application_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Application Insights connection string"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "application_insights_app_id" {
  description = "Application Insights application ID"
  value       = azurerm_application_insights.main.app_id
}

output "action_group_id" {
  description = "Action group ID for alerts"
  value       = azurerm_monitor_action_group.main.id
}

output "action_group_name" {
  description = "Action group name"
  value       = azurerm_monitor_action_group.main.name
}

output "workbook_id" {
  description = "Monitoring workbook ID (if created)"
  value       = var.create_monitoring_workbook ? azurerm_application_insights_workbook.main[0].id : null
}

# Alert rule IDs for reference
output "response_time_alert_id" {
  description = "Response time alert rule ID"
  value       = var.enable_performance_alerts ? azurerm_monitor_metric_alert.response_time[0].id : null
}

output "failure_rate_alert_id" {
  description = "Failure rate alert rule ID"
  value       = var.enable_performance_alerts ? azurerm_monitor_metric_alert.failure_rate[0].id : null
}

output "error_spike_alert_id" {
  description = "Error spike alert rule ID"
  value       = var.enable_log_alerts ? azurerm_monitor_scheduled_query_rules_alert_v2.error_spike[0].id : null
}

output "database_cpu_alert_id" {
  description = "Database CPU alert rule ID"
  value       = var.database_server_id != null && var.enable_database_alerts ? azurerm_monitor_metric_alert.database_cpu[0].id : null
}

output "database_connections_alert_id" {
  description = "Database connections alert rule ID"
  value       = var.database_server_id != null && var.enable_database_alerts ? azurerm_monitor_metric_alert.database_connections[0].id : null
}

output "storage_availability_alert_id" {
  description = "Storage availability alert rule ID"
  value       = var.storage_account_id != null && var.enable_storage_alerts ? azurerm_monitor_metric_alert.storage_availability[0].id : null
}

# Configuration outputs for applications
output "monitoring_configuration" {
  description = "Monitoring configuration for applications"
  value = {
    application_insights = {
      instrumentation_key = azurerm_application_insights.main.instrumentation_key
      connection_string   = azurerm_application_insights.main.connection_string
      app_id             = azurerm_application_insights.main.app_id
    }
    log_analytics = {
      workspace_id  = azurerm_log_analytics_workspace.main.workspace_id
      workspace_key = azurerm_log_analytics_workspace.main.primary_shared_key
    }
  }
  sensitive = true
}

# Endpoints for application integration
output "log_analytics_endpoint" {
  description = "Log Analytics data collection endpoint"
  value       = "https://${azurerm_log_analytics_workspace.main.workspace_id}.ods.opinsights.azure.com"
}

output "application_insights_endpoint" {
  description = "Application Insights ingestion endpoint"
  value       = "https://dc.applicationinsights.azure.com/v2/track"
}
