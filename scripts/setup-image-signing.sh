#!/bin/bash

# Script to install Kyverno and apply image signing policies
# This script sets up container image verification in Kubernetes using Cosign + Kyverno

set -euo pipefail

echo "🔐 Setting up Container Image Signing Enforcement with Kyverno"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is required but not installed. Please install kubectl first."
    exit 1
fi

# Check if we're connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Not connected to a Kubernetes cluster. Please configure kubectl first."
    exit 1
fi

echo "✅ Connected to Kubernetes cluster: $(kubectl config current-context)"

# Install Kyverno if not already installed
echo "📦 Checking if Kyverno is installed..."
if ! kubectl get namespace kyverno &> /dev/null; then
    echo "🚀 Installing Kyverno..."
    
    # Add Kyverno Helm repository
    helm repo add kyverno https://kyverno.github.io/kyverno/
    helm repo update
    
    # Install Kyverno
    helm install kyverno kyverno/kyverno \
        --version v1.8.5 \
        --namespace kyverno \
        --create-namespace \
        --set replicaCount=3 \
        --set resources.limits.memory=1Gi \
        --set resources.requests.memory=512Mi \
        --set admissionController.replicas=3 \
        --set backgroundController.replicas=2 \
        --set cleanupController.replicas=2 \
        --set reportsController.replicas=2 \
        --wait
        
    echo "✅ Kyverno installed successfully"
else
    echo "✅ Kyverno is already installed"
fi

# Wait for Kyverno to be ready
echo "⏳ Waiting for Kyverno to be ready..."
kubectl wait --namespace kyverno \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/name=kyverno \
    --timeout=300s

# Create modulo namespace if it doesn't exist
echo "🏗️  Creating modulo namespace if it doesn't exist..."
kubectl create namespace modulo --dry-run=client -o yaml | kubectl apply -f -

# Apply cluster-wide policies
echo "📋 Applying cluster-wide image signature verification policies..."
kubectl apply -f k8s/policies/verify-image-signatures.yaml

# Apply namespace-specific policies
echo "📋 Applying modulo namespace-specific policies..."
kubectl apply -f k8s/policies/modulo-namespace-policy.yaml

# Verify policy installation
echo "🔍 Verifying policy installation..."
echo "Cluster policies:"
kubectl get clusterpolicy

echo ""
echo "Namespace policies (modulo):"
kubectl get policy -n modulo

echo ""
echo "🎉 Container image signing enforcement is now active!"
echo ""
echo "📊 Policy Summary:"
echo "  ✅ Cluster-wide signature verification for ghcr.io/ikey168/modulo/* images"
echo "  ✅ Namespace policy enforcing signed images only in 'modulo' namespace"
echo "  ✅ Automatic image pull policy enforcement"
echo "  ✅ System namespaces allowed for infrastructure components"
echo ""
echo "🔒 All new deployments will now require Cosign-signed container images!"
echo ""
echo "💡 To test the policy:"
echo "   kubectl run test-unsigned --image=nginx -n modulo"
echo "   # This should be blocked"
echo ""
echo "   kubectl run test-signed --image=ghcr.io/ikey168/modulo/frontend:latest -n modulo"
echo "   # This should work if the image is properly signed"
