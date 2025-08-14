#!/bin/bash

# Modulo Production Environment Setup
set -e

echo "🏭 Setting up Modulo Production Environment..."

# Check prerequisites
echo "✅ Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo "⚠️ helm is not installed (recommended for production)"
fi

# Install nginx-ingress controller
echo "🌐 Installing nginx-ingress controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller to be ready
echo "⏳ Waiting for ingress controller..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Install cert-manager
echo "🔐 Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
echo "⏳ Waiting for cert-manager..."
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=300s

# Create ClusterIssuers
echo "📜 Creating certificate issuers..."
kubectl apply -f k8s/cert-manager-issuers.yaml

# Install metrics server (if not present)
if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
    echo "📊 Installing metrics server..."
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
fi

echo "✅ Production environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update email in cert-manager-issuers.yaml"
echo "2. Update domain name in 09-ingress.yaml"
echo "3. Build and push your container images"
echo "4. Run ./deploy.sh to deploy the application"
echo ""
echo "🔧 Optional production enhancements:"
echo "- Set up monitoring with Prometheus/Grafana"
echo "- Configure log aggregation"
echo "- Set up backup strategies"
echo "- Configure external secrets management"
