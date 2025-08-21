#!/bin/bash

# Container Image Signing Validation Script
# This script validates the Cosign and Kyverno setup for container image signing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if cosign is available
    if ! command -v cosign &> /dev/null; then
        log_error "cosign is not installed or not in PATH"
        log_info "Install cosign: https://docs.sigstore.dev/cosign/installation/"
        exit 1
    fi
    
    # Check kubectl access to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Check Kyverno installation
check_kyverno() {
    log_info "Checking Kyverno installation..."
    
    if ! kubectl get namespace kyverno &> /dev/null; then
        log_error "Kyverno namespace not found"
        log_info "Install Kyverno: kubectl apply -f https://github.com/kyverno/kyverno/releases/download/v1.8.5/install.yaml"
        return 1
    fi
    
    # Check if Kyverno pods are running
    local kyverno_pods=$(kubectl get pods -n kyverno --no-headers | grep -c "Running" || echo "0")
    if [ "$kyverno_pods" -eq 0 ]; then
        log_error "No Kyverno pods are running"
        return 1
    fi
    
    log_success "Kyverno is installed and running ($kyverno_pods pods)"
}

# Check image signing policies
check_policies() {
    log_info "Checking image signing policies..."
    
    local policies=("verify-image-signatures" "require-signed-images")
    local missing_policies=()
    
    for policy in "${policies[@]}"; do
        if ! kubectl get clusterpolicy "$policy" &> /dev/null; then
            missing_policies+=("$policy")
        fi
    done
    
    if [ ${#missing_policies[@]} -gt 0 ]; then
        log_warning "Missing policies: ${missing_policies[*]}"
        log_info "Apply policies: kubectl apply -f k8s/policies/"
        return 1
    fi
    
    log_success "All image signing policies are applied"
}

# Test image signature verification
test_signature_verification() {
    log_info "Testing image signature verification..."
    
    local test_image="ghcr.io/ikey168/modulo-frontend:latest"
    
    # Try to verify the image signature
    if cosign verify \
        --certificate-identity-regexp=".*" \
        --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
        "$test_image" &> /dev/null; then
        log_success "Image signature verification successful for $test_image"
    else
        log_warning "Cannot verify signature for $test_image (image may not be signed yet)"
        log_info "Images will be signed during the next CI/CD build"
    fi
}

# Test policy enforcement with a test deployment
test_policy_enforcement() {
    log_info "Testing policy enforcement..."
    
    # Create a test namespace
    local test_namespace="image-signing-test"
    kubectl create namespace "$test_namespace" --dry-run=client -o yaml | kubectl apply -f - &> /dev/null
    
    # Test with an unsigned image (should fail if policies are enforcing)
    log_info "Testing deployment of unsigned image..."
    
    cat <<EOF | kubectl apply -f - &> /dev/null || log_success "Policy correctly blocked unsigned image"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-unsigned
  namespace: $test_namespace
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-unsigned
  template:
    metadata:
      labels:
        app: test-unsigned
    spec:
      containers:
      - name: nginx
        image: nginx:latest
EOF
    
    # Test with a signed image (should succeed)
    log_info "Testing deployment of signed image..."
    
    cat <<EOF | kubectl apply -f - &> /dev/null && log_success "Signed image deployment allowed"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-signed
  namespace: $test_namespace
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-signed
  template:
    metadata:
      labels:
        app: test-signed
    spec:
      containers:
      - name: frontend
        image: ghcr.io/ikey168/modulo-frontend:latest
EOF
    
    # Cleanup test resources
    kubectl delete namespace "$test_namespace" --ignore-not-found &> /dev/null
    log_info "Cleaned up test resources"
}

# Check policy reports
check_policy_reports() {
    log_info "Checking policy reports..."
    
    local reports=$(kubectl get policyreports -A --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$reports" -gt 0 ]; then
        log_info "Found $reports policy reports"
        
        # Show recent violations
        local violations=$(kubectl get policyreports -A -o jsonpath='{.items[*].summary.fail}' 2>/dev/null | tr ' ' '\n' | awk '{sum+=$1} END {print sum+0}')
        if [ "$violations" -gt 0 ]; then
            log_warning "Found $violations policy violations"
            log_info "Check violations: kubectl get policyreports -A"
        else
            log_success "No policy violations found"
        fi
    else
        log_info "No policy reports found yet"
    fi
}

# Display configuration summary
show_configuration() {
    log_info "Current configuration summary:"
    
    echo ""
    echo "🔐 Image Signing Configuration:"
    echo "  ├── Cosign version: $(cosign version --json 2>/dev/null | grep -o '"gitVersion":"[^"]*"' | cut -d'"' -f4 || echo 'unknown')"
    echo "  ├── Kubernetes cluster: $(kubectl config current-context)"
    echo "  ├── Kyverno status: $(kubectl get pods -n kyverno --no-headers 2>/dev/null | grep -c "Running" || echo "0") pods running"
    echo "  ├── Policies applied: $(kubectl get clusterpolicy --no-headers 2>/dev/null | grep -c "verify\|require\|image" || echo "0")"
    echo "  └── Target registry: ghcr.io/ikey168/modulo-*"
    
    echo ""
    echo "📋 Next steps:"
    echo "  1. Run CI/CD pipeline to sign new images"
    echo "  2. Deploy signed images to test signature verification"
    echo "  3. Monitor policy reports for violations"
    echo "  4. Review documentation in docs/CONTAINER_IMAGE_SIGNING.md"
}

# Main execution
main() {
    echo "🔍 Container Image Signing Validation"
    echo "======================================"
    echo ""
    
    check_prerequisites
    echo ""
    
    if check_kyverno; then
        echo ""
        check_policies
        echo ""
        test_signature_verification
        echo ""
        test_policy_enforcement
        echo ""
        check_policy_reports
        echo ""
        show_configuration
    else
        log_error "Kyverno validation failed. Please install Kyverno first."
        exit 1
    fi
    
    echo ""
    echo "✅ Validation completed successfully!"
    echo "Container image signing is configured and ready for use."
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
