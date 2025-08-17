# Terraform Infrastructure for Modulo

This directory contains the Terraform infrastructure-as-code for the Modulo application, providing a complete baseline infrastructure including networking, database, storage, and monitoring components.

## Architecture Overview

The infrastructure includes:

- **Networking**: Virtual Network with subnets for application and database tiers
- **Database**: PostgreSQL Flexible Server with private endpoint integration
- **Storage**: Azure Blob Storage with lifecycle management and security features
- **Monitoring**: Application Insights and Log Analytics with comprehensive alerting

## Directory Structure

```
terraform/
├── main.tf                     # Root Terraform configuration
├── variables.tf                # Variable definitions
├── outputs.tf                  # Output values
├── terraform.tfvars.example    # Example variable values
├── modules/                    # Reusable Terraform modules
│   ├── network/               # Virtual network and security groups
│   ├── database/              # PostgreSQL Flexible Server
│   ├── storage/               # Azure Blob Storage
│   └── monitoring/            # Application Insights and Log Analytics
├── environments/              # Environment-specific configurations
│   ├── dev/
│   │   └── terraform.tfvars   # Development environment variables
│   └── prod/
│       └── terraform.tfvars   # Production environment variables
└── README.md                  # This file
```

## Prerequisites

1. **Azure CLI**: Install and authenticate with Azure
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

2. **Terraform**: Install Terraform >= 1.0
   ```bash
   # Using package manager (example for Ubuntu)
   curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
   sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
   sudo apt-get update && sudo apt-get install terraform
   ```

3. **Azure Subscription**: Ensure you have appropriate permissions to create resources

## Quick Start

### 1. Clone and Navigate

```bash
cd /workspaces/Modulo/terraform
```

### 2. Set Up Environment Variables

For development:
```bash
export TF_VAR_administrator_password="YourSecurePassword123!"
export TF_VAR_alert_email_recipients='{"dev-team":"dev@yourcompany.com"}'
```

For production:
```bash
export TF_VAR_administrator_password="YourSecurePassword123!"
export TF_VAR_alert_email_recipients='{"ops":"ops@yourcompany.com","oncall":"oncall@yourcompany.com"}'
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan Deployment

For development:
```bash
terraform plan -var-file="environments/dev/terraform.tfvars"
```

For production:
```bash
terraform plan -var-file="environments/prod/terraform.tfvars"
```

### 5. Apply Configuration

For development:
```bash
terraform apply -var-file="environments/dev/terraform.tfvars"
```

For production:
```bash
terraform apply -var-file="environments/prod/terraform.tfvars"
```

## Environment Configurations

### Development Environment

- **Database**: Basic tier (B_Standard_B1ms) with 32GB storage
- **Storage**: Locally redundant storage (LRS)
- **Monitoring**: Basic alerting with relaxed thresholds
- **Security**: More permissive for development needs
- **Costs**: Optimized for minimal cost

### Production Environment

- **Database**: General Purpose tier with high availability
- **Storage**: Geo-redundant storage with lifecycle management
- **Monitoring**: Comprehensive alerting with strict thresholds
- **Security**: Private endpoints and restrictive access
- **Backup**: Enabled with long-term retention

## Module Documentation

### Network Module

Creates a Virtual Network with:
- Application subnet for compute resources
- Database subnet with PostgreSQL delegation
- Network Security Groups with least-privilege rules
- Private DNS zone for database connectivity

### Database Module

Deploys PostgreSQL Flexible Server with:
- Private endpoint integration
- Automated backups and point-in-time recovery
- High availability options for production
- Performance monitoring and alerting

### Storage Module

Provides Azure Blob Storage with:
- Multiple containers for different use cases
- Lifecycle management policies
- Security features (encryption, access controls)
- Optional private endpoints

### Monitoring Module

Sets up comprehensive monitoring with:
- Application Insights for application telemetry
- Log Analytics for centralized logging
- Alert rules for performance and availability
- Monitoring dashboard workbook

## Configuration

### Required Variables

- `administrator_password`: PostgreSQL administrator password (sensitive)
- `alert_email_recipients`: Map of email addresses for alerts

### Optional Customization

Edit the environment-specific `.tfvars` files to customize:
- Resource sizing and SKUs
- Alert thresholds and recipients
- Security and access settings
- Backup and retention policies

## Outputs

After deployment, Terraform provides outputs including:
- Database connection strings
- Storage account details
- Monitoring configuration
- Network information

These outputs can be used for CI/CD integration and application configuration.

## Security Considerations

1. **Secrets Management**: Use Azure Key Vault or environment variables for sensitive data
2. **Network Security**: Private endpoints are recommended for production
3. **Access Control**: Configure RBAC and network access rules appropriately
4. **Monitoring**: Enable all monitoring and alerting for production workloads

## Cost Management

- Development environments use lower-tier resources to minimize costs
- Production environments balance performance and cost
- Use lifecycle policies to manage storage costs
- Monitor usage with Azure Cost Management

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   ```bash
   az login
   az account show  # Verify correct subscription
   ```

2. **Resource Name Conflicts**
   - Resource names include random suffixes to avoid conflicts
   - Check for existing resources with similar names

3. **Permission Issues**
   ```bash
   az role assignment list --assignee $(az account show --query user.name -o tsv)
   ```

### Getting Help

- Check Terraform plan output for detailed resource information
- Review Azure Activity Log for deployment issues
- Consult module documentation for specific configuration options

## Next Steps

After infrastructure deployment:

1. **Database Schema**: Apply database migrations using Flyway
2. **Application Deployment**: Deploy application using CI/CD pipeline
3. **Monitoring Setup**: Configure application-specific monitoring
4. **Backup Testing**: Verify backup and recovery procedures

## Contributing

When modifying the infrastructure:

1. Test changes in development environment first
2. Update documentation for any new variables or outputs
3. Follow Terraform best practices for module design
4. Ensure production configurations maintain security standards
