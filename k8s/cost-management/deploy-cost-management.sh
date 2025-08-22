#!/bin/bash

# Cost Management Deployment Script
# This script deploys the complete cost management and budget monitoring solution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
    
    print_success "kubectl is available and connected to cluster"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check kubectl
    check_kubectl
    
    # Check if observability namespace exists (for Prometheus/Grafana integration)
    if ! kubectl get namespace observability &> /dev/null; then
        print_warning "observability namespace not found. Some features may not work properly."
        print_status "Consider deploying observability stack first: kubectl apply -f k8s/observability/"
    else
        print_success "observability namespace found"
    fi
    
    print_success "Prerequisites check completed"
}

# Function to create namespace
create_namespace() {
    print_status "Creating cost-management namespace..."
    
    if kubectl apply -f k8s/cost-management/00-resource-tagging.yaml; then
        print_success "Namespace and resource tagging policies created"
    else
        print_error "Failed to create namespace"
        exit 1
    fi
}

# Function to setup secrets
setup_secrets() {
    print_status "Setting up Azure API secrets..."
    
    # Check if secrets are already configured
    if kubectl get secret azure-cost-api-secret -n cost-management &> /dev/null; then
        print_warning "azure-cost-api-secret already exists. Skipping secret creation."
        print_status "Update the secret manually with your Azure credentials:"
        echo "  kubectl create secret generic azure-cost-api-secret -n cost-management \\"
        echo "    --from-literal=AZURE_TENANT_ID=your-tenant-id \\"
        echo "    --from-literal=AZURE_CLIENT_ID=your-client-id \\"
        echo "    --from-literal=AZURE_CLIENT_SECRET=your-client-secret \\"
        echo "    --from-literal=AZURE_SUBSCRIPTION_ID=your-subscription-id \\"
        echo "    --from-literal=SLACK_WEBHOOK_URL=your-slack-webhook \\"
        echo "    --from-literal=EMAIL_SMTP_SERVER=smtp.gmail.com \\"
        echo "    --from-literal=EMAIL_SMTP_PORT=587 \\"
        echo "    --from-literal=EMAIL_USERNAME=your-email \\"
        echo "    --from-literal=EMAIL_PASSWORD=your-password \\"
        echo "    --dry-run=client -o yaml | kubectl replace -f -"
    else
        if kubectl apply -f k8s/cost-management/01-cost-management-api.yaml; then
            print_success "Azure API configuration created"
            print_warning "Please update the azure-cost-api-secret with your actual Azure credentials"
        else
            print_error "Failed to create Azure API configuration"
            exit 1
        fi
    fi
}

# Function to deploy budget alerts
deploy_budget_alerts() {
    print_status "Deploying budget alerts and monitoring..."
    
    if kubectl apply -f k8s/cost-management/02-budget-alerts.yaml; then
        print_success "Budget alerts and Prometheus rules deployed"
    else
        print_error "Failed to deploy budget alerts"
        exit 1
    fi
}

# Function to deploy cost monitoring
deploy_cost_monitoring() {
    print_status "Deploying cost monitoring service..."
    
    if kubectl apply -f k8s/cost-management/03-cost-monitoring.yaml; then
        print_success "Cost monitoring service deployed"
    else
        print_error "Failed to deploy cost monitoring"
        exit 1
    fi
}

# Function to deploy cost reporting
deploy_cost_reporting() {
    print_status "Deploying cost reporting service..."
    
    if kubectl apply -f k8s/cost-management/04-cost-reporting.yaml; then
        print_success "Cost reporting service deployed"
    else
        print_error "Failed to deploy cost reporting"
        exit 1
    fi
}

# Function to update Grafana dashboards
update_grafana_dashboards() {
    print_status "Updating Grafana dashboards with cost visualizations..."
    
    if kubectl apply -f k8s/observability/grafana-dashboards.yaml; then
        print_success "Grafana dashboards updated with cost management dashboards"
    else
        print_warning "Failed to update Grafana dashboards. You may need to deploy observability stack first."
    fi
}

# Function to wait for deployments
wait_for_deployments() {
    print_status "Waiting for deployments to be ready..."
    
    deployments=(
        "cost-monitoring"
        "budget-monitor"
        "cost-reporting-service"
    )
    
    for deployment in "${deployments[@]}"; do
        print_status "Waiting for deployment/$deployment to be ready..."
        if kubectl rollout status deployment/$deployment -n cost-management --timeout=300s; then
            print_success "Deployment $deployment is ready"
        else
            print_warning "Deployment $deployment is not ready within timeout"
        fi
    done
}

# Function to verify installation
verify_installation() {
    print_status "Verifying cost management installation..."
    
    # Check pods
    print_status "Checking pod status..."
    kubectl get pods -n cost-management
    
    # Check services
    print_status "Checking service status..."
    kubectl get services -n cost-management
    
    # Check Prometheus rules
    print_status "Checking Prometheus rules..."
    if kubectl get prometheusrules -n cost-management &> /dev/null; then
        kubectl get prometheusrules -n cost-management
        print_success "Prometheus rules are configured"
    else
        print_warning "Prometheus rules not found. Budget alerts may not work."
    fi
    
    # Check ConfigMaps
    print_status "Checking configuration..."
    kubectl get configmaps -n cost-management
    
    print_success "Installation verification completed"
}

# Function to display access information
display_access_info() {
    print_success "Cost Management System deployed successfully!"
    echo
    print_status "Access Information:"
    echo "===================="
    echo
    echo "📊 Grafana Dashboards:"
    echo "  Port forward: kubectl port-forward service/grafana 3000:3000 -n observability"
    echo "  URL: http://localhost:3000"
    echo "  Dashboards: Cost Management Overview, Environment Cost Analysis"
    echo
    echo "💰 Cost Monitoring Service:"
    echo "  Port forward: kubectl port-forward service/cost-monitoring-service 8080:8080 -n cost-management"
    echo "  Health check: curl http://localhost:8080/health"
    echo
    echo "📈 Budget Monitor:"
    echo "  Port forward: kubectl port-forward service/budget-monitor-service 8080:8080 -n cost-management"
    echo "  Metrics: Available via Prometheus"
    echo
    echo "📧 Cost Reporting:"
    echo "  Scheduled: Monthly reports on 1st of each month at 9 AM UTC"
    echo "  Manual trigger: kubectl create job manual-report --from=cronjob/monthly-cost-report -n cost-management"
    echo
    echo "🔧 Configuration:"
    echo "  Update Azure credentials: kubectl edit secret azure-cost-api-secret -n cost-management"
    echo "  Update budgets: kubectl edit configmap budget-configuration -n cost-management"
    echo "  Update monitoring config: kubectl edit configmap cost-management-config -n cost-management"
    echo
    echo "📋 Logs:"
    echo "  Cost monitoring: kubectl logs -l app.kubernetes.io/component=monitoring -n cost-management"
    echo "  Budget alerts: kubectl logs -l app.kubernetes.io/component=budget-monitor -n cost-management"
    echo "  Reporting: kubectl logs -l app.kubernetes.io/component=reporting -n cost-management"
    echo
    echo "⚠️  Important Notes:"
    echo "  1. Update azure-cost-api-secret with your actual Azure credentials"
    echo "  2. Configure email/Slack settings for notifications"
    echo "  3. Adjust budget thresholds in budget-configuration ConfigMap"
    echo "  4. Monitor logs for any authentication or API access issues"
    echo
}

# Function to show help
show_help() {
    echo "Cost Management Deployment Script"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --skip-wait         Skip waiting for deployments to be ready"
    echo "  --verify-only       Only verify existing installation"
    echo "  --update-secrets    Update Azure API secrets interactively"
    echo
    echo "Examples:"
    echo "  $0                  Full deployment"
    echo "  $0 --skip-wait      Deploy without waiting for readiness"
    echo "  $0 --verify-only    Check existing installation"
    echo
}

# Function to update secrets interactively
update_secrets_interactive() {
    print_status "Interactive Azure credentials update..."
    
    read -p "Azure Tenant ID: " AZURE_TENANT_ID
    read -p "Azure Client ID: " AZURE_CLIENT_ID
    read -s -p "Azure Client Secret: " AZURE_CLIENT_SECRET
    echo
    read -p "Azure Subscription ID: " AZURE_SUBSCRIPTION_ID
    read -p "Slack Webhook URL (optional): " SLACK_WEBHOOK_URL
    read -p "Email Username (optional): " EMAIL_USERNAME
    read -s -p "Email Password (optional): " EMAIL_PASSWORD
    echo
    
    kubectl create secret generic azure-cost-api-secret -n cost-management \
        --from-literal=AZURE_TENANT_ID="$AZURE_TENANT_ID" \
        --from-literal=AZURE_CLIENT_ID="$AZURE_CLIENT_ID" \
        --from-literal=AZURE_CLIENT_SECRET="$AZURE_CLIENT_SECRET" \
        --from-literal=AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID" \
        --from-literal=SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL" \
        --from-literal=EMAIL_SMTP_SERVER="smtp.gmail.com" \
        --from-literal=EMAIL_SMTP_PORT="587" \
        --from-literal=EMAIL_USERNAME="$EMAIL_USERNAME" \
        --from-literal=EMAIL_PASSWORD="$EMAIL_PASSWORD" \
        --dry-run=client -o yaml | kubectl replace -f -
    
    print_success "Azure credentials updated successfully"
}

# Main deployment function
main() {
    print_status "Starting Cost Management System deployment..."
    echo
    
    # Parse command line arguments
    SKIP_WAIT=false
    VERIFY_ONLY=false
    UPDATE_SECRETS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --skip-wait)
                SKIP_WAIT=true
                shift
                ;;
            --verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            --update-secrets)
                UPDATE_SECRETS=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Update secrets if requested
    if [[ "$UPDATE_SECRETS" == true ]]; then
        update_secrets_interactive
        exit 0
    fi
    
    # Verify only if requested
    if [[ "$VERIFY_ONLY" == true ]]; then
        check_kubectl
        verify_installation
        display_access_info
        exit 0
    fi
    
    # Full deployment
    check_prerequisites
    create_namespace
    setup_secrets
    deploy_budget_alerts
    deploy_cost_monitoring
    deploy_cost_reporting
    update_grafana_dashboards
    
    if [[ "$SKIP_WAIT" != true ]]; then
        wait_for_deployments
    fi
    
    verify_installation
    display_access_info
    
    print_success "Cost Management System deployment completed successfully!"
}

# Run main function
main "$@"
