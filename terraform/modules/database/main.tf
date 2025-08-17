# Database Module - PostgreSQL Flexible Server
# Provides managed PostgreSQL database with security and backup configuration

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "${var.app_name}-${var.environment}-postgres-${var.random_suffix}"
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = var.db_version
  delegated_subnet_id    = var.subnet_id
  private_dns_zone_id    = var.private_dns_zone_id
  
  administrator_login    = var.administrator_login
  administrator_password = var.administrator_password

  zone = "1"

  storage_mb = var.storage_mb

  sku_name   = var.sku_name

  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup

  # High availability configuration (optional)
  dynamic "high_availability" {
    for_each = var.enable_high_availability ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }

  # Maintenance window
  maintenance_window {
    day_of_week  = var.maintenance_window.day_of_week
    start_hour   = var.maintenance_window.start_hour
    start_minute = var.maintenance_window.start_minute
  }

  tags = var.common_tags

  depends_on = [var.private_dns_zone_id]
}

# Main application database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "${var.app_name}_${var.environment}"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Additional databases for specific purposes
resource "azurerm_postgresql_flexible_server_database" "testing" {
  count     = var.create_test_database ? 1 : 0
  name      = "${var.app_name}_${var.environment}_test"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# PostgreSQL Configuration for optimal performance
resource "azurerm_postgresql_flexible_server_configuration" "shared_preload_libraries" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "pg_stat_statements,pg_audit"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_statement" {
  name      = "log_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "all"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_min_duration_statement" {
  name      = "log_min_duration_statement"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "1000"  # Log queries taking longer than 1 second
}

# Firewall rules (since we're using VNet integration, this is mainly for development)
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  count            = var.allow_azure_services ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Optional: Firewall rule for development access
resource "azurerm_postgresql_flexible_server_firewall_rule" "development" {
  count            = var.development_ip_range != null ? 1 : 0
  name             = "DevelopmentAccess"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = split("/", var.development_ip_range)[0]
  end_ip_address   = split("/", var.development_ip_range)[0]
}
