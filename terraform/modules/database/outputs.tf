# Database Module Outputs

output "server_id" {
  description = "PostgreSQL server ID"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "server_name" {
  description = "PostgreSQL server name"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "server_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_name" {
  description = "Main database name"
  value       = azurerm_postgresql_flexible_server_database.main.name
}

output "test_database_name" {
  description = "Test database name (if created)"
  value       = var.create_test_database ? azurerm_postgresql_flexible_server_database.testing[0].name : null
}

output "administrator_login" {
  description = "Database administrator login"
  value       = azurerm_postgresql_flexible_server.main.administrator_login
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}@${azurerm_postgresql_flexible_server.main.name}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  sensitive   = true
}

output "jdbc_url" {
  description = "JDBC URL for Java applications"
  value       = "jdbc:postgresql://${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
}

output "host" {
  description = "Database host"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "port" {
  description = "Database port"
  value       = 5432
}

output "server_version" {
  description = "PostgreSQL server version"
  value       = azurerm_postgresql_flexible_server.main.version
}

output "storage_mb" {
  description = "Allocated storage in MB"
  value       = azurerm_postgresql_flexible_server.main.storage_mb
}

output "backup_retention_days" {
  description = "Backup retention period in days"
  value       = azurerm_postgresql_flexible_server.main.backup_retention_days
}

output "high_availability_enabled" {
  description = "Whether high availability is enabled"
  value       = var.enable_high_availability
}
