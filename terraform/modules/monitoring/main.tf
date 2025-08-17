# Monitoring Module - Application Insights and Log Analytics
# Provides comprehensive monitoring, logging, and alerting capabilities

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.app_name}-${var.environment}-logs-${var.random_suffix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.log_analytics_sku
  retention_in_days   = var.log_retention_days

  # Data export and ingestion settings
  daily_quota_gb                 = var.daily_quota_gb
  internet_ingestion_enabled     = var.internet_ingestion_enabled
  internet_query_enabled         = var.internet_query_enabled
  local_authentication_disabled = var.disable_local_auth

  tags = var.common_tags
}

# Application Insights
resource "azurerm_application_insights" "main" {
  name                = "${var.app_name}-${var.environment}-insights-${var.random_suffix}"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = var.application_type

  # Sampling and data retention
  retention_in_days                 = var.app_insights_retention_days
  daily_data_cap_in_gb             = var.app_insights_daily_cap_gb
  daily_data_cap_notifications_disabled = var.disable_daily_cap_notifications

  # Disable IP masking for better analytics (adjust based on privacy requirements)
  disable_ip_masking = var.disable_ip_masking

  tags = var.common_tags
}

# Action Group for alerts
resource "azurerm_monitor_action_group" "main" {
  name                = "${var.app_name}-${var.environment}-alerts"
  resource_group_name = var.resource_group_name
  short_name          = substr("${var.app_name}-${var.environment}", 0, 12)

  # Email notifications
  dynamic "email_receiver" {
    for_each = var.alert_email_recipients
    content {
      name          = "email-${email_receiver.key}"
      email_address = email_receiver.value
    }
  }

  # Webhook notifications
  dynamic "webhook_receiver" {
    for_each = var.alert_webhooks
    content {
      name        = webhook_receiver.value.name
      service_uri = webhook_receiver.value.uri
    }
  }

  # SMS notifications (optional)
  dynamic "sms_receiver" {
    for_each = var.alert_sms_recipients
    content {
      name         = "sms-${sms_receiver.key}"
      country_code = sms_receiver.value.country_code
      phone_number = sms_receiver.value.phone_number
    }
  }

  tags = var.common_tags
}

# Application Performance Monitoring Alerts
resource "azurerm_monitor_metric_alert" "response_time" {
  count               = var.enable_performance_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-high-response-time"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when average response time exceeds threshold"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/duration"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.response_time_threshold_ms
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.common_tags
}

resource "azurerm_monitor_metric_alert" "failure_rate" {
  count               = var.enable_performance_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-high-failure-rate"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when failure rate exceeds threshold"
  severity            = 1
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/failed"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = var.failure_rate_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.common_tags
}

# Custom Log Analytics Queries and Alerts
resource "azurerm_monitor_scheduled_query_rules_alert_v2" "error_spike" {
  count               = var.enable_log_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-error-spike"
  resource_group_name = var.resource_group_name
  location            = var.location

  evaluation_frequency = "PT5M"
  window_duration      = "PT10M"
  scopes               = [azurerm_log_analytics_workspace.main.id]
  severity             = 2
  description          = "Alert when error count spikes"

  criteria {
    query                   = <<-QUERY
      AppTraces
      | where SeverityLevel >= 3
      | summarize ErrorCount = count() by bin(TimeGenerated, 5m)
      | where ErrorCount > ${var.error_spike_threshold}
    QUERY
    time_aggregation_method = "Count"
    threshold               = 1
    operator                = "GreaterThanOrEqual"

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.main.id]
  }

  tags = var.common_tags
}

# Database monitoring (if database resources are provided)
resource "azurerm_monitor_metric_alert" "database_cpu" {
  count               = var.database_server_id != null && var.enable_database_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-db-high-cpu"
  resource_group_name = var.resource_group_name
  scopes              = [var.database_server_id]
  description         = "Alert when database CPU usage is high"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.database_cpu_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.common_tags
}

resource "azurerm_monitor_metric_alert" "database_connections" {
  count               = var.database_server_id != null && var.enable_database_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-db-high-connections"
  resource_group_name = var.resource_group_name
  scopes              = [var.database_server_id]
  description         = "Alert when database connection count is high"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "active_connections"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.database_connections_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.common_tags
}

# Storage monitoring (if storage account is provided)
resource "azurerm_monitor_metric_alert" "storage_availability" {
  count               = var.storage_account_id != null && var.enable_storage_alerts ? 1 : 0
  name                = "${var.app_name}-${var.environment}-storage-low-availability"
  resource_group_name = var.resource_group_name
  scopes              = ["${var.storage_account_id}/blobServices/default"]
  description         = "Alert when storage availability is low"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Storage/storageAccounts/blobServices"
    metric_name      = "Availability"
    aggregation      = "Average"
    operator         = "LessThan"
    threshold        = var.storage_availability_threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = var.common_tags
}

# Workbook for monitoring dashboard
resource "azurerm_application_insights_workbook" "main" {
  count               = var.create_monitoring_workbook ? 1 : 0
  name                = "${var.app_name}-${var.environment}-monitoring-dashboard"
  resource_group_name = var.resource_group_name
  location            = var.location
  display_name        = "${var.app_name} ${var.environment} Monitoring Dashboard"
  source_id           = azurerm_application_insights.main.id

  # Basic monitoring workbook template
  data_json = jsonencode({
    version = "Notebook/1.0"
    items = [
      {
        type = 1
        content = {
          json = "# ${var.app_name} ${var.environment} Monitoring Dashboard\n\nThis dashboard provides key metrics and insights for your application."
        }
      },
      {
        type = 3
        content = {
          version = "KqlItem/1.0"
          query = "requests | summarize count() by bin(timestamp, 5m) | render timechart"
          size = 0
          title = "Request Count Over Time"
          timeContext = {
            durationMs = 3600000
          }
        }
      }
    ]
  })

  tags = var.common_tags
}
