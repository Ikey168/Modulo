#!/bin/bash

# External Secrets Operator Deployment Script
# Deploys External Secrets Operator and configures secret management

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")/k8s"
EXTERNAL_SECRETS_DIR="$K8S_DIR/external-secrets"

# Configuration
NAMESPACE="modulo"
EXTERNAL_SECRETS_NAMESPACE="external-secrets-system"
HELM_RELEASE_NAME="external-secrets"

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
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if helm is available
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

create_namespaces() {
    log_info "Creating namespaces..."
    
    # Create external-secrets-system namespace
    kubectl apply -f "$EXTERNAL_SECRETS_DIR/00-namespace.yaml"
    
    # Create modulo namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Namespaces created"
}

install_external_secrets_operator() {
    log_info "Installing External Secrets Operator..."
    
    # Add External Secrets Helm repository
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update
    
    # Install or upgrade External Secrets Operator
    helm upgrade --install "$HELM_RELEASE_NAME" external-secrets/external-secrets \
        --namespace "$EXTERNAL_SECRETS_NAMESPACE" \
        --create-namespace \
        --version "0.9.11" \
        --set installCRDs=true \
        --set replicaCount=1 \
        --set webhook.create=true \
        --set certController.create=true \
        --set "resources.limits.cpu=100m" \
        --set "resources.limits.memory=128Mi" \
        --set "resources.requests.cpu=10m" \
        --set "resources.requests.memory=32Mi" \
        --wait --timeout=5m
    
    log_success "External Secrets Operator installed"
}

setup_rbac() {
    log_info "Setting up RBAC..."
    
    kubectl apply -f "$EXTERNAL_SECRETS_DIR/03-rbac.yaml"
    
    log_success "RBAC configured"
}

deploy_secret_stores() {
    log_info "Deploying SecretStores..."
    
    # Deploy SecretStore configurations
    kubectl apply -f "$EXTERNAL_SECRETS_DIR/02-secret-stores.yaml"
    
    log_success "SecretStores deployed"
}

deploy_external_secrets() {
    log_info "Deploying ExternalSecrets..."
    
    # Deploy ExternalSecret resources
    kubectl apply -f "$EXTERNAL_SECRETS_DIR/04-external-secrets.yaml"
    
    log_success "ExternalSecrets deployed"
}

wait_for_operator() {
    log_info "Waiting for External Secrets Operator to be ready..."
    
    kubectl wait --for=condition=available --timeout=300s deployment/external-secrets \
        -n "$EXTERNAL_SECRETS_NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-webhook \
        -n "$EXTERNAL_SECRETS_NAMESPACE"
    kubectl wait --for=condition=available --timeout=300s deployment/external-secrets-cert-controller \
        -n "$EXTERNAL_SECRETS_NAMESPACE"
    
    log_success "External Secrets Operator is ready"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check operator pods
    log_info "External Secrets Operator pods:"
    kubectl get pods -n "$EXTERNAL_SECRETS_NAMESPACE" -l app.kubernetes.io/name=external-secrets
    
    # Check SecretStores
    log_info "SecretStores:"
    kubectl get secretstores -n "$NAMESPACE"
    
    # Check ExternalSecrets
    log_info "ExternalSecrets:"
    kubectl get externalsecrets -n "$NAMESPACE"
    
    # Check if secrets are being created
    log_info "Generated secrets:"
    kubectl get secrets -n "$NAMESPACE" -l app.kubernetes.io/managed-by=external-secrets
    
    log_success "Deployment verification completed"
}

show_next_steps() {
    echo ""
    log_info "🔧 Next Steps:"
    echo ""
    echo "1. Configure Azure Key Vault:"
    echo "   - Create Azure Key Vault: modulo-keyvault"
    echo "   - Add secrets to Key Vault with proper names"
    echo "   - Configure service principal access"
    echo ""
    echo "2. Update credentials:"
    echo "   kubectl patch secret azure-keyvault-creds -n $NAMESPACE --type='merge' -p='{\"stringData\":{\"client-id\":\"YOUR_CLIENT_ID\",\"client-secret\":\"YOUR_CLIENT_SECRET\"}}'"
    echo ""
    echo "3. Update tenant ID in SecretStores:"
    echo "   kubectl patch secretstore azure-keyvault-store -n $NAMESPACE --type='merge' -p='{\"spec\":{\"provider\":{\"azurekv\":{\"tenantId\":\"YOUR_TENANT_ID\"}}}}'"
    echo ""
    echo "4. Verify secret synchronization:"
    echo "   kubectl get externalsecrets -n $NAMESPACE"
    echo "   kubectl describe externalsecret api-database-secret -n $NAMESPACE"
    echo ""
    echo "5. Test secret rotation (see rotation playbooks)"
    echo ""
    log_warning "Remember to update the Key Vault URL and tenant ID in the SecretStore configurations!"
}

# Main execution
main() {
    echo "🚀 External Secrets Operator Deployment"
    echo "========================================"
    
    check_prerequisites
    create_namespaces
    install_external_secrets_operator
    wait_for_operator
    setup_rbac
    deploy_secret_stores
    deploy_external_secrets
    verify_deployment
    show_next_steps
    
    echo ""
    log_success "External Secrets Operator deployment completed successfully!"
}

# Run main function
main "$@"
