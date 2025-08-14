#!/bin/bash

set -e

echo "🚀 Deploying Kubernetes Auto-Scaling Configuration..."

# Create namespace if it doesn't exist
kubectl create namespace modulo --dry-run=client -o yaml | kubectl apply -f -

# Deploy PostgreSQL Operator (if not already installed)
echo "📦 Installing PostgreSQL Operator..."
kubectl apply -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.20/releases/cnpg-1.20.0.yaml

# Wait for operator to be ready
kubectl wait --for=condition=Available deployment/cnpg-controller-manager -n cnpg-system --timeout=300s

# Apply secrets (ensure these exist)
echo "🔐 Applying secrets..."
kubectl apply -f k8s/secrets.yaml

# Deploy PostgreSQL cluster
echo "🐘 Deploying PostgreSQL cluster..."
kubectl apply -f k8s/postgresql-cluster.yaml

# Deploy read replicas
echo "📖 Deploying read replicas..."
kubectl apply -f k8s/postgres-read-replicas.yaml

# Deploy API with autoscaling
echo "🔧 Deploying API..."
kubectl apply -f k8s/api-deployment.yaml

# Deploy HPA configurations
echo "📈 Deploying HPA configurations..."
kubectl apply -f k8s/api-hpa.yaml

# Deploy VPA configurations (optional)
echo "📊 Deploying VPA configurations..."
kubectl apply -f k8s/vpa-config.yaml

# Deploy monitoring
echo "📋 Deploying monitoring..."
kubectl apply -f k8s/monitoring-servicemonitor.yaml

# Verify deployments
echo "✅ Verifying deployments..."
kubectl get pods -n modulo
kubectl get hpa -n modulo
kubectl get vpa -n modulo

echo "🎉 Auto-scaling configuration deployed successfully!"
echo ""
echo "📊 Monitor scaling with:"
echo "  kubectl get hpa -n modulo -w"
echo "  kubectl top pods -n modulo"
echo ""
echo "🔍 Check logs with:"
echo "  kubectl logs -f deployment/modulo-api -n modulo"
