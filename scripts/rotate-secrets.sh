#!/bin/bash

# Secret Rotation Playbook for External Secrets
# Demonstrates end-to-end secret rotation without application redeployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="modulo"
KEY_VAULT_NAME="modulo-keyvault"
RESOURCE_GROUP="modulo-rg"

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
    
    # Check if required tools are available
    for tool in kubectl az openssl; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check Azure CLI login
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure CLI. Run 'az login' first."
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

generate_new_secret() {
    local secret_name="$1"
    local secret_type="${2:-random}"
    
    case "$secret_type" in
        "jwt")
            # Generate 256-bit JWT secret
            openssl rand -base64 32
            ;;
        "api-key")
            # Generate API key with prefix
            echo "mod_$(openssl rand -hex 24)"
            ;;
        "password")
            # Generate strong password
            openssl rand -base64 24 | tr -d "=+/" | cut -c1-24
            ;;
        "random"|*)
            # Generate random secret
            openssl rand -base64 32
            ;;
    esac
}

rotate_secret_in_keyvault() {
    local secret_name="$1"
    local secret_type="${2:-random}"
    
    log_info "Rotating secret: $secret_name"
    
    # Generate new secret value
    local new_secret_value
    new_secret_value=$(generate_new_secret "$secret_name" "$secret_type")
    
    # Update secret in Azure Key Vault
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$secret_name" \
        --value "$new_secret_value" \
        --output none
    
    log_success "Secret $secret_name rotated in Key Vault"
    
    # Return the new value for verification
    echo "$new_secret_value"
}

wait_for_secret_sync() {
    local external_secret_name="$1"
    local timeout="${2:-300}"
    
    log_info "Waiting for ExternalSecret $external_secret_name to sync..."
    
    local start_time
    start_time=$(date +%s)
    
    while true; do
        local current_time
        current_time=$(date +%s)
        
        if [ $((current_time - start_time)) -gt "$timeout" ]; then
            log_error "Timeout waiting for secret sync"
            return 1
        fi
        
        # Check if ExternalSecret is synced
        local sync_status
        sync_status=$(kubectl get externalsecret "$external_secret_name" -n "$NAMESPACE" \
            -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
        
        if [ "$sync_status" = "True" ]; then
            log_success "ExternalSecret $external_secret_name synced"
            break
        fi
        
        sleep 5
    done
}

verify_secret_in_pod() {
    local pod_selector="$1"
    local env_var_name="$2"
    local expected_prefix="${3:-}"
    
    log_info "Verifying secret in pods with selector: $pod_selector"
    
    # Get pod name
    local pod_name
    pod_name=$(kubectl get pods -n "$NAMESPACE" -l "$pod_selector" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        log_error "No pods found with selector: $pod_selector"
        return 1
    fi
    
    # Get environment variable value from pod
    local actual_value
    actual_value=$(kubectl exec -n "$NAMESPACE" "$pod_name" -- printenv "$env_var_name" 2>/dev/null || echo "")
    
    if [ -z "$actual_value" ]; then
        log_error "Environment variable $env_var_name not found in pod"
        return 1
    fi
    
    # Verify prefix if provided
    if [ -n "$expected_prefix" ] && [[ ! "$actual_value" =~ ^$expected_prefix ]]; then
        log_error "Secret value doesn't match expected prefix: $expected_prefix"
        return 1
    fi
    
    log_success "Secret verified in pod: $pod_name"
    echo "First 10 characters: ${actual_value:0:10}..."
}

restart_deployment_if_needed() {
    local deployment_name="$1"
    local restart="${2:-false}"
    
    if [ "$restart" = "true" ]; then
        log_info "Restarting deployment: $deployment_name"
        kubectl rollout restart deployment "$deployment_name" -n "$NAMESPACE"
        kubectl rollout status deployment "$deployment_name" -n "$NAMESPACE" --timeout=300s
        log_success "Deployment $deployment_name restarted"
    else
        log_info "Deployment restart not required (secrets auto-refresh)"
    fi
}

perform_jwt_secret_rotation() {
    log_info "🔄 Performing JWT Secret Rotation"
    echo "=================================="
    
    # 1. Rotate secret in Key Vault
    local new_jwt_secret
    new_jwt_secret=$(rotate_secret_in_keyvault "modulo-jwt-secret" "jwt")
    
    # 2. Wait for External Secrets to sync
    wait_for_secret_sync "api-application-secret"
    
    # 3. Verify in application pods
    verify_secret_in_pod "app=spring-boot-api" "JWT_SECRET"
    
    # 4. Optional: Restart deployment (not needed with External Secrets auto-refresh)
    restart_deployment_if_needed "spring-boot-api" "false"
    
    log_success "JWT secret rotation completed"
}

perform_database_password_rotation() {
    log_info "🔄 Performing Database Password Rotation"
    echo "========================================"
    
    log_warning "Database password rotation requires coordination with database system"
    log_info "This example shows the External Secrets part only"
    
    # 1. Generate new password
    local new_password
    new_password=$(generate_new_secret "database-password" "password")
    
    log_info "New password generated (in production, update database first)"
    
    # 2. Update in Key Vault (in production, do this after updating database)
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "modulo-database-password" \
        --value "$new_password" \
        --output none
    
    # 3. Wait for sync
    wait_for_secret_sync "api-database-secret"
    
    # 4. Verify in pods
    verify_secret_in_pod "app=spring-boot-api" "SPRING_DATASOURCE_PASSWORD"
    
    log_success "Database password rotation completed (database update required separately)"
}

perform_api_key_rotation() {
    log_info "🔄 Performing API Key Rotation"
    echo "=============================="
    
    # 1. Rotate API key in Key Vault
    local new_api_key
    new_api_key=$(rotate_secret_in_keyvault "modulo-api-key" "api-key")
    
    # 2. Wait for sync
    wait_for_secret_sync "api-application-secret"
    
    # 3. Verify in pods
    verify_secret_in_pod "app=spring-boot-api" "API_KEY" "mod_"
    
    log_success "API key rotation completed"
}

show_rotation_status() {
    log_info "📊 Secret Rotation Status"
    echo "========================="
    
    # Show ExternalSecrets status
    echo ""
    log_info "ExternalSecrets Status:"
    kubectl get externalsecrets -n "$NAMESPACE" -o custom-columns=\
"NAME:.metadata.name,READY:.status.conditions[?(@.type=='Ready')].status,LAST-SYNC:.status.refreshTime"
    
    # Show Secret ages
    echo ""
    log_info "Secret Last Updated:"
    kubectl get secrets -n "$NAMESPACE" -l app.kubernetes.io/managed-by=external-secrets \
        -o custom-columns="NAME:.metadata.name,AGE:.metadata.creationTimestamp"
}

interactive_rotation_menu() {
    while true; do
        echo ""
        log_info "🔄 Secret Rotation Playbook"
        echo "==========================="
        echo "1. Rotate JWT Secret"
        echo "2. Rotate API Key"
        echo "3. Rotate Database Password (demo)"
        echo "4. Show Rotation Status"
        echo "5. Exit"
        echo ""
        read -p "Select an option (1-5): " choice
        
        case $choice in
            1)
                perform_jwt_secret_rotation
                ;;
            2)
                perform_api_key_rotation
                ;;
            3)
                perform_database_password_rotation
                ;;
            4)
                show_rotation_status
                ;;
            5)
                log_info "Exiting..."
                break
                ;;
            *)
                log_error "Invalid option. Please select 1-5."
                ;;
        esac
    done
}

# Main execution
main() {
    echo "🔄 External Secrets Rotation Playbook"
    echo "====================================="
    
    check_prerequisites
    
    if [ $# -eq 0 ]; then
        # Interactive mode
        interactive_rotation_menu
    else
        # Command line mode
        case "$1" in
            "jwt")
                perform_jwt_secret_rotation
                ;;
            "api-key")
                perform_api_key_rotation
                ;;
            "database")
                perform_database_password_rotation
                ;;
            "status")
                show_rotation_status
                ;;
            *)
                echo "Usage: $0 [jwt|api-key|database|status]"
                echo "Or run without arguments for interactive mode"
                exit 1
                ;;
        esac
    fi
    
    echo ""
    log_success "Secret rotation playbook completed!"
}

# Run main function
main "$@"
