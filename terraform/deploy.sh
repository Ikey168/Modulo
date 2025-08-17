#!/bin/bash

# Terraform Infrastructure Deployment Script for Modulo
# This script automates the deployment of infrastructure for different environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR"

# Default values
ENVIRONMENT=""
ACTION="plan"
AUTO_APPROVE="false"
DESTROY="false"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Terraform infrastructure for Modulo application.

OPTIONS:
    -e, --environment ENV    Environment to deploy (dev, prod)
    -a, --action ACTION      Terraform action (plan, apply, destroy) [default: plan]
    -y, --auto-approve       Auto-approve terraform apply (use with caution)
    -d, --destroy            Destroy infrastructure (same as --action destroy)
    -h, --help               Show this help message

EXAMPLES:
    $0 -e dev                           # Plan development deployment
    $0 -e dev -a apply                  # Apply development deployment
    $0 -e prod -a apply -y             # Apply production with auto-approve
    $0 -e dev -d                       # Destroy development environment

ENVIRONMENT SETUP:
    Before running, ensure these environment variables are set:
    - TF_VAR_administrator_password     # PostgreSQL admin password
    - TF_VAR_alert_email_recipients     # JSON map of alert recipients

    Example:
    export TF_VAR_administrator_password="SecurePassword123!"
    export TF_VAR_alert_email_recipients='{"team":"alerts@company.com"}'

EOF
}

# Function to validate prerequisites
validate_prerequisites() {
    print_status "Validating prerequisites..."
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Check if logged into Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged into Azure. Run 'az login' first."
        exit 1
    fi
    
    # Check if environment is specified
    if [[ -z "$ENVIRONMENT" ]]; then
        print_error "Environment must be specified with -e flag"
        show_usage
        exit 1
    fi
    
    # Check if environment configuration exists
    if [[ ! -f "$TERRAFORM_DIR/environments/$ENVIRONMENT/terraform.tfvars" ]]; then
        print_error "Environment configuration not found: environments/$ENVIRONMENT/terraform.tfvars"
        exit 1
    fi
    
    # Check required environment variables
    if [[ -z "$TF_VAR_administrator_password" ]]; then
        print_error "TF_VAR_administrator_password environment variable is required"
        exit 1
    fi
    
    print_success "Prerequisites validated"
}

# Function to initialize Terraform
terraform_init() {
    print_status "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    
    terraform init
    
    if [[ $? -eq 0 ]]; then
        print_success "Terraform initialized"
    else
        print_error "Terraform initialization failed"
        exit 1
    fi
}

# Function to run terraform plan
terraform_plan() {
    print_status "Running Terraform plan for environment: $ENVIRONMENT"
    
    terraform plan \
        -var-file="environments/$ENVIRONMENT/terraform.tfvars" \
        -out="$ENVIRONMENT.tfplan"
    
    if [[ $? -eq 0 ]]; then
        print_success "Terraform plan completed"
        print_status "Plan file saved as: $ENVIRONMENT.tfplan"
    else
        print_error "Terraform plan failed"
        exit 1
    fi
}

# Function to run terraform apply
terraform_apply() {
    print_status "Applying Terraform configuration for environment: $ENVIRONMENT"
    
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        print_warning "Auto-approve is enabled. This will apply changes without confirmation!"
        terraform apply \
            -var-file="environments/$ENVIRONMENT/terraform.tfvars" \
            -auto-approve
    else
        terraform apply \
            -var-file="environments/$ENVIRONMENT/terraform.tfvars"
    fi
    
    if [[ $? -eq 0 ]]; then
        print_success "Terraform apply completed"
        print_status "Infrastructure deployed successfully!"
        
        # Show important outputs
        print_status "Getting deployment outputs..."
        terraform output
    else
        print_error "Terraform apply failed"
        exit 1
    fi
}

# Function to run terraform destroy
terraform_destroy() {
    print_warning "This will DESTROY all infrastructure for environment: $ENVIRONMENT"
    print_warning "This action cannot be undone!"
    
    if [[ "$AUTO_APPROVE" != "true" ]]; then
        read -p "Are you sure you want to destroy the infrastructure? Type 'yes' to confirm: " confirmation
        if [[ "$confirmation" != "yes" ]]; then
            print_status "Destroy cancelled"
            exit 0
        fi
    fi
    
    terraform destroy \
        -var-file="environments/$ENVIRONMENT/terraform.tfvars" \
        $([ "$AUTO_APPROVE" == "true" ] && echo "-auto-approve")
    
    if [[ $? -eq 0 ]]; then
        print_success "Infrastructure destroyed"
    else
        print_error "Terraform destroy failed"
        exit 1
    fi
}

# Function to show environment info
show_environment_info() {
    print_status "Environment: $ENVIRONMENT"
    print_status "Action: $ACTION"
    print_status "Configuration file: environments/$ENVIRONMENT/terraform.tfvars"
    
    if [[ -f "environments/$ENVIRONMENT/terraform.tfvars" ]]; then
        print_status "Environment configuration preview:"
        echo "----------------------------------------"
        head -20 "environments/$ENVIRONMENT/terraform.tfvars" | grep -E "^[a-zA-Z]" | head -10
        echo "----------------------------------------"
    fi
    
    # Show current Azure context
    local subscription=$(az account show --query name -o tsv 2>/dev/null || echo "Unknown")
    print_status "Azure subscription: $subscription"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -y|--auto-approve)
            AUTO_APPROVE="true"
            shift
            ;;
        -d|--destroy)
            DESTROY="true"
            ACTION="destroy"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate action
case $ACTION in
    plan|apply|destroy)
        ;;
    *)
        print_error "Invalid action: $ACTION. Must be plan, apply, or destroy."
        exit 1
        ;;
esac

# Main execution
main() {
    print_status "Starting Terraform deployment script"
    print_status "Modulo Infrastructure Deployment"
    echo "=================================="
    
    validate_prerequisites
    show_environment_info
    terraform_init
    
    case $ACTION in
        plan)
            terraform_plan
            ;;
        apply)
            terraform_plan
            terraform_apply
            ;;
        destroy)
            terraform_destroy
            ;;
    esac
    
    print_success "Script completed successfully!"
}

# Run main function
main
