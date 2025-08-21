#!/bin/bash

# Azure Key Vault Setup Script for External Secrets
# Creates and configures Azure Key Vault with all required secrets

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KEY_VAULT_NAME="${KEY_VAULT_NAME:-modulo-keyvault}"
RESOURCE_GROUP="${RESOURCE_GROUP:-modulo-rg}"
LOCATION="${LOCATION:-eastus}"
SERVICE_PRINCIPAL_NAME="${SERVICE_PRINCIPAL_NAME:-modulo-external-secrets-sp}"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Azure CLI is available
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check Azure CLI login
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure CLI. Run 'az login' first."
        exit 1
    fi
    
    # Check if openssl is available for secret generation
    if ! command -v openssl &> /dev/null; then
        log_error "openssl is not installed or not in PATH"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_resource_group() {
    log_info "Creating resource group: $RESOURCE_GROUP"
    
    # Create resource group if it doesn't exist
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        log_info "Resource group $RESOURCE_GROUP already exists"
    else
        az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
        log_success "Resource group $RESOURCE_GROUP created"
    fi
}

create_key_vault() {
    log_info "Creating Key Vault: $KEY_VAULT_NAME"
    
    # Create Key Vault if it doesn't exist
    if az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
        log_info "Key Vault $KEY_VAULT_NAME already exists"
    else
        az keyvault create \
            --name "$KEY_VAULT_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku standard \
            --enable-rbac-authorization false \
            --output none
        log_success "Key Vault $KEY_VAULT_NAME created"
    fi
}

create_service_principal() {
    log_info "Creating service principal: $SERVICE_PRINCIPAL_NAME"
    
    # Create service principal
    local sp_output
    sp_output=$(az ad sp create-for-rbac \
        --name "$SERVICE_PRINCIPAL_NAME" \
        --skip-assignment \
        --query '{clientId: appId, clientSecret: password, tenantId: tenant}' \
        --output json)
    
    local client_id
    local client_secret
    local tenant_id
    
    client_id=$(echo "$sp_output" | jq -r '.clientId')
    client_secret=$(echo "$sp_output" | jq -r '.clientSecret')
    tenant_id=$(echo "$sp_output" | jq -r '.tenantId')
    
    # Grant Key Vault access to service principal
    az keyvault set-policy \
        --name "$KEY_VAULT_NAME" \
        --spn "$client_id" \
        --secret-permissions get list \
        --output none
    
    log_success "Service principal created and granted access"
    
    # Save credentials to file for later use
    cat > "azure-credentials.json" <<EOF
{
    "clientId": "$client_id",
    "clientSecret": "$client_secret",
    "tenantId": "$tenant_id",
    "keyVaultName": "$KEY_VAULT_NAME"
}
EOF
    
    log_info "Credentials saved to azure-credentials.json"
    
    # Export for immediate use
    export AZURE_CLIENT_ID="$client_id"
    export AZURE_CLIENT_SECRET="$client_secret"
    export AZURE_TENANT_ID="$tenant_id"
}

generate_secret() {
    local secret_type="$1"
    
    case "$secret_type" in
        "jwt")
            openssl rand -base64 32
            ;;
        "api-key")
            echo "mod_$(openssl rand -hex 24)"
            ;;
        "password")
            openssl rand -base64 24 | tr -d "=+/" | cut -c1-24
            ;;
        "encryption-key")
            openssl rand -base64 32
            ;;
        *)
            openssl rand -base64 32
            ;;
    esac
}

populate_secrets() {
    log_info "Populating Key Vault with application secrets..."
    
    # Database secrets
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-database-host" --value "postgres-service" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-database-port" --value "5432" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-database-name" --value "modulo" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-database-username" --value "postgres" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-database-password" --value "$(generate_secret password)" --output none
    
    # Application secrets
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-jwt-secret" --value "$(generate_secret jwt)" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-api-key" --value "$(generate_secret api-key)" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-encryption-key" --value "$(generate_secret encryption-key)" --output none
    
    # Monitoring secrets (placeholder values)
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-app-insights-connection-string" --value "InstrumentationKey=placeholder;IngestionEndpoint=https://placeholder.in.applicationinsights.azure.com/" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-app-insights-instrumentation-key" --value "placeholder-instrumentation-key" --output none
    
    # Container registry secrets (placeholder values)
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-acr-url" --value "moduloacr.azurecr.io" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-acr-username" --value "moduloacr" --output none
    az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "modulo-acr-password" --value "placeholder-acr-password" --output none
    
    log_success "Secrets populated in Key Vault"
}

create_kubernetes_secret() {
    log_info "Creating Kubernetes secret for Azure authentication..."
    
    if [ -z "${AZURE_CLIENT_ID:-}" ] || [ -z "${AZURE_CLIENT_SECRET:-}" ]; then
        log_error "Azure credentials not set. Run service principal creation first."
        return 1
    fi
    
    # Check if kubectl is available
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        # Create or update the Kubernetes secret
        kubectl create secret generic azure-keyvault-creds \
            --namespace=modulo \
            --from-literal=client-id="$AZURE_CLIENT_ID" \
            --from-literal=client-secret="$AZURE_CLIENT_SECRET" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        log_success "Kubernetes secret created/updated"
    else
        log_warning "kubectl not available or cluster not accessible. Secret creation skipped."
        log_info "Create the secret manually when cluster is available:"
        echo "kubectl create secret generic azure-keyvault-creds --namespace=modulo --from-literal=client-id=\"$AZURE_CLIENT_ID\" --from-literal=client-secret=\"$AZURE_CLIENT_SECRET\""
    fi
}

update_secret_store_configs() {
    log_info "Updating SecretStore configurations..."
    
    if [ -z "${AZURE_TENANT_ID:-}" ]; then
        log_error "Azure tenant ID not set"
        return 1
    fi
    
    # Update SecretStore files with actual values
    local secret_store_file="/workspaces/Modulo/k8s/external-secrets/02-secret-stores.yaml"
    
    if [ -f "$secret_store_file" ]; then
        # Replace placeholder values
        sed -i "s|https://modulo-keyvault.vault.azure.net/|https://$KEY_VAULT_NAME.vault.azure.net/|g" "$secret_store_file"
        sed -i "s|REPLACE_WITH_YOUR_TENANT_ID|$AZURE_TENANT_ID|g" "$secret_store_file"
        
        log_success "SecretStore configurations updated"
    else
        log_warning "SecretStore configuration file not found: $secret_store_file"
    fi
}

verify_setup() {
    log_info "Verifying Key Vault setup..."
    
    # List secrets in Key Vault
    log_info "Secrets in Key Vault:"
    az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query '[].name' --output table
    
    # Test service principal access
    log_info "Testing service principal access..."
    az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "modulo-jwt-secret" --query 'value' --output tsv > /dev/null
    log_success "Service principal can access secrets"
}

show_summary() {
    echo ""
    log_info "🎉 Azure Key Vault Setup Complete!"
    echo "==================================="
    echo ""
    echo "Key Vault: $KEY_VAULT_NAME"
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Service Principal: $SERVICE_PRINCIPAL_NAME"
    echo ""
    
    if [ -f "azure-credentials.json" ]; then
        echo "Credentials saved to: azure-credentials.json"
        echo ""
        log_warning "⚠️  Keep azure-credentials.json secure and don't commit to git!"
    fi
    
    echo ""
    log_info "Next Steps:"
    echo "1. Deploy External Secrets Operator: ./scripts/deploy-external-secrets.sh"
    echo "2. Verify secret synchronization"
    echo "3. Test secret rotation: ./scripts/rotate-secrets.sh"
    echo ""
    
    echo "Manual updates needed:"
    echo "- Update Application Insights connection string in Key Vault"
    echo "- Update Azure Container Registry credentials in Key Vault"
    echo "- Configure actual database credentials as needed"
}

# Main execution
main() {
    echo "🔐 Azure Key Vault Setup for External Secrets"
    echo "=============================================="
    
    check_prerequisites
    create_resource_group
    create_key_vault
    create_service_principal
    populate_secrets
    update_secret_store_configs
    create_kubernetes_secret
    verify_setup
    show_summary
    
    echo ""
    log_success "Azure Key Vault setup completed successfully!"
}

# Run main function
main "$@"
