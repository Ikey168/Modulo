#!/bin/bash

# Terraform Configuration Validation Script
# Validates Terraform configuration and environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"

# Validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

validate_tool() {
    local tool=$1
    local version_flag=$2
    local min_version=$3
    
    if ! command -v "$tool" &> /dev/null; then
        print_error "$tool is not installed or not in PATH"
        ((VALIDATION_ERRORS++))
        return 1
    fi
    
    local version_output
    version_output=$($tool $version_flag 2>&1 | head -1)
    print_success "$tool is installed: $version_output"
    return 0
}

validate_azure_auth() {
    print_status "Checking Azure authentication..."
    
    if ! az account show &> /dev/null; then
        print_error "Not logged into Azure. Run 'az login' first."
        ((VALIDATION_ERRORS++))
        return 1
    fi
    
    local account_name
    account_name=$(az account show --query name -o tsv)
    local subscription_id
    subscription_id=$(az account show --query id -o tsv)
    
    print_success "Authenticated to Azure"
    print_status "Subscription: $account_name ($subscription_id)"
    
    # Check permissions (basic check)
    if az role assignment list --assignee "$(az account show --query user.name -o tsv)" --query "[?roleDefinitionName=='Owner' || roleDefinitionName=='Contributor']" -o tsv | grep -q .; then
        print_success "User has sufficient permissions"
    else
        print_warning "User may not have sufficient permissions (Owner or Contributor required)"
        ((VALIDATION_WARNINGS++))
    fi
}

validate_terraform_syntax() {
    print_status "Validating Terraform syntax..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize without backend to validate syntax
    if terraform init -backend=false &> /dev/null; then
        print_success "Terraform initialization successful"
    else
        print_error "Terraform initialization failed"
        ((VALIDATION_ERRORS++))
        return 1
    fi
    
    # Validate configuration
    if terraform validate; then
        print_success "Terraform configuration is valid"
    else
        print_error "Terraform configuration validation failed"
        ((VALIDATION_ERRORS++))
        return 1
    fi
    
    # Format check
    if terraform fmt -check=true -diff=true; then
        print_success "Terraform configuration is properly formatted"
    else
        print_warning "Terraform configuration has formatting issues. Run 'terraform fmt' to fix."
        ((VALIDATION_WARNINGS++))
    fi
}

validate_environment_configs() {
    print_status "Validating environment configurations..."
    
    local environments=("dev" "prod")
    
    for env in "${environments[@]}"; do
        local tfvars_file="$TERRAFORM_DIR/environments/$env/terraform.tfvars"
        
        if [[ -f "$tfvars_file" ]]; then
            print_success "Environment configuration found: $env"
            
            # Basic syntax check for tfvars
            if terraform fmt -check=true "$tfvars_file" &> /dev/null; then
                print_success "  $env configuration is properly formatted"
            else
                print_warning "  $env configuration has formatting issues"
                ((VALIDATION_WARNINGS++))
            fi
            
            # Check for required variables
            if grep -q "app_name" "$tfvars_file" && grep -q "environment" "$tfvars_file"; then
                print_success "  $env configuration has required variables"
            else
                print_error "  $env configuration missing required variables"
                ((VALIDATION_ERRORS++))
            fi
        else
            print_error "Environment configuration not found: $env"
            ((VALIDATION_ERRORS++))
        fi
    done
}

validate_required_env_vars() {
    print_status "Checking required environment variables..."
    
    # Check for sensitive variables that should be set as env vars
    local required_vars=("TF_VAR_administrator_password")
    local optional_vars=("TF_VAR_alert_email_recipients")
    
    for var in "${required_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            print_success "$var is set"
        else
            print_error "$var is not set (required)"
            print_status "  Set with: export $var='your-value'"
            ((VALIDATION_ERRORS++))
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            print_success "$var is set"
        else
            print_warning "$var is not set (recommended)"
            print_status "  Set with: export $var='your-value'"
            ((VALIDATION_WARNINGS++))
        fi
    done
}

validate_azure_providers() {
    print_status "Checking Azure provider registration..."
    
    local required_providers=("Microsoft.Network" "Microsoft.Storage" "Microsoft.DBforPostgreSQL" "Microsoft.Insights" "Microsoft.OperationalInsights")
    
    for provider in "${required_providers[@]}"; do
        local state
        state=$(az provider show --namespace "$provider" --query registrationState -o tsv 2>/dev/null || echo "Unknown")
        
        if [[ "$state" == "Registered" ]]; then
            print_success "$provider is registered"
        elif [[ "$state" == "Registering" ]]; then
            print_warning "$provider is currently registering"
            ((VALIDATION_WARNINGS++))
        else
            print_error "$provider is not registered"
            print_status "  Register with: az provider register --namespace $provider"
            ((VALIDATION_ERRORS++))
        fi
    done
}

check_terraform_state() {
    print_status "Checking for existing Terraform state..."
    
    if [[ -f "$TERRAFORM_DIR/terraform.tfstate" ]]; then
        print_warning "Terraform state file exists locally"
        print_status "  Consider using remote state for production deployments"
        ((VALIDATION_WARNINGS++))
    elif [[ -f "$TERRAFORM_DIR/.terraform/terraform.tfstate" ]]; then
        print_success "Using remote state backend"
    else
        print_status "No existing state found (fresh deployment)"
    fi
}

show_summary() {
    echo ""
    echo "=================================="
    echo "     VALIDATION SUMMARY"
    echo "=================================="
    
    if [[ $VALIDATION_ERRORS -eq 0 && $VALIDATION_WARNINGS -eq 0 ]]; then
        print_success "All validations passed! Ready to deploy."
    elif [[ $VALIDATION_ERRORS -eq 0 ]]; then
        print_warning "Validation completed with $VALIDATION_WARNINGS warnings."
        print_status "You can proceed with deployment, but consider addressing warnings."
    else
        print_error "Validation failed with $VALIDATION_ERRORS errors and $VALIDATION_WARNINGS warnings."
        print_status "Please fix errors before attempting deployment."
        exit 1
    fi
    
    echo ""
    echo "Next steps:"
    echo "1. Set required environment variables if not done"
    echo "2. Run: ./deploy.sh -e dev                    # Plan dev deployment"
    echo "3. Run: ./deploy.sh -e dev -a apply          # Apply dev deployment"
    echo "4. Run: ./deploy.sh -e prod -a apply         # Apply prod deployment"
}

# Main validation
main() {
    print_status "Starting Terraform validation"
    print_status "Modulo Infrastructure Validation"
    echo "=================================="
    
    cd "$TERRAFORM_DIR"
    
    validate_tool "terraform" "version" "1.0"
    validate_tool "az" "--version" "2.0"
    
    validate_azure_auth
    validate_terraform_syntax
    validate_environment_configs
    validate_required_env_vars
    validate_azure_providers
    check_terraform_state
    
    show_summary
}

# Run main function
main
