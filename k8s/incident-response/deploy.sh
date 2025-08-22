#!/bin/bash

# Incident Response System Deployment Script
# This script deploys PagerDuty integration, status page, and incident response infrastructure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="incident-response"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if required namespaces exist
    if ! kubectl get namespace monitoring &> /dev/null; then
        log_warning "Monitoring namespace not found. Some features may not work correctly."
    fi
    
    log_success "Prerequisites check completed"
}

configure_secrets() {
    log_info "Configuring secrets..."
    
    # Check if PagerDuty secrets exist
    if kubectl get secret pagerduty-secrets -n "$NAMESPACE" &> /dev/null; then
        log_warning "PagerDuty secrets already exist. Skipping secret creation."
        log_info "To update secrets, delete the existing secret first:"
        log_info "kubectl delete secret pagerduty-secrets -n $NAMESPACE"
        return
    fi
    
    # Prompt for PagerDuty configuration
    echo
    log_info "PagerDuty Integration Setup"
    echo "You need to provide PagerDuty API credentials."
    echo "Get these from: https://[your-subdomain].pagerduty.com/api_keys"
    echo
    
    read -p "Enter PagerDuty API Key: " -s PAGERDUTY_API_KEY
    echo
    read -p "Enter PagerDuty Routing Key: " -s PAGERDUTY_ROUTING_KEY
    echo
    read -p "Enter Webhook Secret (optional, press enter to generate): " WEBHOOK_SECRET
    echo
    
    if [ -z "$WEBHOOK_SECRET" ]; then
        WEBHOOK_SECRET=$(openssl rand -hex 32)
        log_info "Generated webhook secret: $WEBHOOK_SECRET"
    fi
    
    # Create the secret
    kubectl create secret generic pagerduty-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=api-key="$PAGERDUTY_API_KEY" \
        --from-literal=routing-key="$PAGERDUTY_ROUTING_KEY" \
        --from-literal=webhook-secret="$WEBHOOK_SECRET"
    
    log_success "PagerDuty secrets configured"
}

deploy_component() {
    local component_file="$1"
    local component_name="$2"
    
    log_info "Deploying $component_name..."
    
    if [ ! -f "$component_file" ]; then
        log_error "Component file not found: $component_file"
        return 1
    fi
    
    if kubectl apply -f "$component_file"; then
        log_success "$component_name deployed successfully"
    else
        log_error "Failed to deploy $component_name"
        return 1
    fi
}

wait_for_deployment() {
    local deployment_name="$1"
    local timeout="$2"
    
    log_info "Waiting for $deployment_name to be ready..."
    
    if kubectl wait --for=condition=available --timeout="${timeout}s" deployment/"$deployment_name" -n "$NAMESPACE"; then
        log_success "$deployment_name is ready"
    else
        log_error "$deployment_name failed to become ready within ${timeout}s"
        return 1
    fi
}

test_deployment() {
    log_info "Testing deployment..."
    
    # Test PagerDuty integration
    log_info "Testing PagerDuty integration..."
    if kubectl exec -n "$NAMESPACE" deployment/pagerduty-integration -- curl -f http://localhost:8080/health &> /dev/null; then
        log_success "PagerDuty integration health check passed"
    else
        log_warning "PagerDuty integration health check failed"
    fi
    
    # Test status page
    log_info "Testing status page..."
    if kubectl exec -n "$NAMESPACE" deployment/status-page -- curl -f http://localhost:3000/health &> /dev/null; then
        log_success "Status page health check passed"
    else
        log_warning "Status page health check failed"
    fi
    
    # Test alert rules
    log_info "Testing alert rules..."
    if kubectl get prometheusrule incident-response-alerts -n "$NAMESPACE" &> /dev/null; then
        log_success "Alert rules are configured"
    else
        log_warning "Alert rules not found"
    fi
}

show_access_info() {
    log_info "Deployment completed! Here's how to access the services:"
    echo
    
    # Status page access
    echo "📊 Status Page:"
    if kubectl get ingress status-page-ingress -n "$NAMESPACE" &> /dev/null; then
        INGRESS_HOST=$(kubectl get ingress status-page-ingress -n "$NAMESPACE" -o jsonpath='{.spec.rules[0].host}')
        echo "   External: https://$INGRESS_HOST"
    fi
    echo "   Internal: kubectl port-forward -n $NAMESPACE svc/status-page 8080:80"
    echo "   Then access: http://localhost:8080"
    echo
    
    # PagerDuty integration
    echo "🚨 PagerDuty Integration:"
    echo "   Health Check: kubectl exec -n $NAMESPACE deployment/pagerduty-integration -- curl http://localhost:8080/health"
    echo "   Test Page: kubectl exec -n $NAMESPACE deployment/pagerduty-integration -- curl -X GET http://localhost:8080/test-page"
    echo "   Metrics: kubectl port-forward -n $NAMESPACE svc/pagerduty-integration 9090:9090"
    echo
    
    # Useful commands
    echo "🔧 Useful Commands:"
    echo "   View logs: kubectl logs -n $NAMESPACE -l app=pagerduty-integration -f"
    echo "   Check status: kubectl get all -n $NAMESPACE"
    echo "   Update secrets: kubectl delete secret pagerduty-secrets -n $NAMESPACE && ./deploy.sh"
    echo
    
    # Documentation
    echo "📚 Documentation:"
    echo "   Incident Response Runbook: docs/incident-response-runbook.md"
    echo "   Postmortem Template: docs/postmortem-template.md"
    echo "   Tabletop Drill: docs/tabletop-drill-1.md"
    echo
}

main() {
    echo "🚀 Deploying Incident Response System"
    echo "======================================"
    
    # Check prerequisites
    check_prerequisites
    
    # Deploy components in order
    deploy_component "$SCRIPT_DIR/00-namespace-rbac.yaml" "Namespace and RBAC"
    
    # Configure secrets (interactive)
    configure_secrets
    
    deploy_component "$SCRIPT_DIR/01-pagerduty-integration.yaml" "PagerDuty Integration"
    deploy_component "$SCRIPT_DIR/02-alertmanager-config.yaml" "AlertManager Configuration"
    deploy_component "$SCRIPT_DIR/03-status-page.yaml" "Status Page"
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    wait_for_deployment "pagerduty-integration" 300
    wait_for_deployment "status-page" 300
    
    # Test the deployment
    test_deployment
    
    # Show access information
    show_access_info
    
    log_success "Incident response system deployment completed!"
    echo
    log_info "Next steps:"
    echo "1. Configure your monitoring system to send alerts to the PagerDuty webhook"
    echo "2. Set up your DNS to point to the status page ingress"
    echo "3. Schedule your first tabletop drill using docs/tabletop-drill-1.md"
    echo "4. Test the paging system with: kubectl exec -n $NAMESPACE deployment/pagerduty-integration -- curl -X GET http://localhost:8080/test-page"
}

# Cleanup function for SIGINT
cleanup() {
    echo
    log_warning "Deployment interrupted. You may need to clean up partially created resources."
    exit 1
}

# Trap SIGINT
trap cleanup SIGINT

# Check if running with specific component
if [ $# -eq 1 ]; then
    case "$1" in
        "test")
            check_prerequisites
            test_deployment
            ;;
        "secrets")
            configure_secrets
            ;;
        "status")
            kubectl get all -n "$NAMESPACE"
            ;;
        "clean")
            log_warning "This will delete the entire incident-response namespace and all resources."
            read -p "Are you sure? (y/N): " confirm
            if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
                kubectl delete namespace "$NAMESPACE"
                log_success "Incident response system removed"
            else
                log_info "Cleanup cancelled"
            fi
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [COMMAND]"
            echo
            echo "Commands:"
            echo "  (no args)  Deploy the complete incident response system"
            echo "  test       Test existing deployment"
            echo "  secrets    Reconfigure PagerDuty secrets"
            echo "  status     Show deployment status"
            echo "  clean      Remove the entire deployment"
            echo "  help       Show this help message"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
else
    # Run full deployment
    main
fi
