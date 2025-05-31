terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
  # Ensure you are logged in via Azure CLI (`az login`)
  # or configure authentication using other methods like Service Principal.
  # To manually register providers, use: az provider register --namespace <ProviderName>
  # See: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs#resource_provider_registrations
}
# Debug resource removed after validation

variable "resource_group_name" {
  description = "The name of the Azure Resource Group."
  type        = string
  default     = "Modulo"
}

variable "location" {
  description = "The Azure region where resources will be created."
  type        = string
  default     = "westeurope"
}

variable "acr_name" {
  description = "The globally unique name of the Azure Container Registry."
  type        = string
  default     = "moduloacr2025test" # This ACR should exist or be creatable with this unique name
}

variable "app_service_plan_name_backend" {
  description = "The name of the App Service Plan for the backend."
  type        = string
  default     = "modulo-backend-plan"
}

variable "app_service_name_backend" {
  description = "The name of the App Service for the backend."
  type        = string
  default     = "moduloapp-backend"
}

variable "backend_docker_image" {
  description = "The Docker image for the backend service."
  type        = string
  default     = "moduloacr.azurecr.io/modulo-backend:dev" # Assumes ACR name is 'moduloacr'
}

variable "backend_app_port" {
  description = "The port the backend application listens on."
  type        = number
  default     = 8080
}

variable "backend_health_check_path" {
  description = "The path for the backend health check probe."
  type        = string
  default     = "/actuator/health" # Common for Spring Boot, adjust if different
}

variable "autoscale_min_instances" {
  description = "Minimum number of instances for autoscaling."
  type        = number
  default     = 1
}

variable "autoscale_max_instances" {
  description = "Maximum number of instances for autoscaling."
  type        = number
  default     = 3
}

variable "autoscale_default_instances" {
  description = "Default number of instances for autoscaling."
  type        = number
  default     = 1
}

variable "autoscale_cpu_high_threshold" {
  description = "CPU percentage threshold to scale out."
  type        = number
  default     = 75
}

variable "autoscale_cpu_low_threshold" {
  description = "CPU percentage threshold to scale in."
  type        = number
  default     = 25
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

// ACR, App Service Plan, and App Service resources will be added next.

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "Basic"
  admin_enabled       = true // Set to false if you manage access via RBAC/service principals

  tags = {
    environment = "dev"
    project     = "modulo"
  }
}

resource "azurerm_service_plan" "asp_backend" {
  name                = var.app_service_plan_name_backend
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "B1" # Basic tier, 1 core, 1.75GB RAM - choose based on needs

  tags = {
    environment = "dev"
    project     = "modulo"
    service     = "backend"
  }
}

resource "azurerm_linux_web_app" "app_service_backend" {
  name                = var.app_service_name_backend
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_service_plan.asp_backend.location
  service_plan_id     = azurerm_service_plan.asp_backend.id

  site_config {
    always_on = false # Set to true for B1 SKU and above if needed, helps keep app warm
    # For custom Docker images from ACR, linux_fx_version is key.
    # The format is DOCKER|repository/image:tag
    # linux_fx_version removed: this attribute is now managed by the provider automatically
    # To verify the image, see the value of var.backend_docker_image: ${var.backend_docker_image}

    # If your ACR admin_enabled = false, or for better security, you'd configure managed identity for ACR pull
    # acr_use_managed_identity_creds = true
    # acr_user_managed_identity_client_id = "your-managed-identity-client-id" # Only if using user-assigned identity
    health_check_path = var.backend_health_check_path
    http2_enabled     = true # Recommended for modern applications
  }

  app_settings = {
    "WEBSITES_PORT"                   = var.backend_app_port
    "DOCKER_REGISTRY_SERVER_URL"      = "https://${var.acr_name}.azurecr.io"
    "DOCKER_REGISTRY_SERVER_USERNAME" = azurerm_container_registry.acr.admin_username
    "DOCKER_REGISTRY_SERVER_PASSWORD" = azurerm_container_registry.acr.admin_password
    // Add other application-specific environment variables here
    // "SPRING_PROFILES_ACTIVE"        = "prod"
    // "DATABASE_URL"                  = "your_db_connection_string"
  }

  # Enable system-assigned managed identity if you want to use it for ACR pull or other Azure services
  # identity {
  #   type = "SystemAssigned"
  # }

  tags = {
    environment = "dev"
    project     = "modulo"
    service     = "backend"
  }
}

resource "azurerm_monitor_autoscale_setting" "asp_backend_autoscale" {
  name                = "${var.app_service_plan_name_backend}-autoscale"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  target_resource_id  = azurerm_service_plan.asp_backend.id

  profile {
    name = "defaultProfile"

    capacity {
      default = var.autoscale_default_instances
      minimum = var.autoscale_min_instances
      maximum = var.autoscale_max_instances
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.asp_backend.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = var.autoscale_cpu_high_threshold
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.asp_backend.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = var.autoscale_cpu_low_threshold
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT10M" # Longer cooldown for scaling in is often a good practice
      }
    }
  }

  notification {
    email {
      send_to_subscription_administrator    = true
      send_to_subscription_co_administrator = true
      custom_emails                         = [] # Add any specific emails if needed
    }
  }

  tags = {
    environment = "dev"
    project     = "modulo"
    service     = "backend-autoscale"
  }
}