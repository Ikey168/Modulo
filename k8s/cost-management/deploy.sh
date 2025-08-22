#!/bin/bash

# Deploy Cost Management and Budget Alerts System
# This script deploys the complete cost monitoring solution for Modulo

set -e

echo "🚀 Deploying Cost Management and Budget Alerts System..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we're connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Not connected to a Kubernetes cluster"
    exit 1
fi

echo "✅ Connected to Kubernetes cluster"

# Deploy in order
echo "📦 Deploying resource tagging and namespace..."
kubectl apply -f k8s/cost-management/00-resource-tagging.yaml

echo "🔐 Deploying Azure Cost Management API integration..."
kubectl apply -f k8s/cost-management/01-cost-management-api.yaml

echo "💰 Deploying budget alerts and monitoring rules..."
kubectl apply -f k8s/cost-management/02-budget-alerts.yaml

echo "📊 Deploying cost monitoring service..."
kubectl apply -f k8s/cost-management/03-cost-monitoring.yaml

echo "📈 Deploying cost reporting system..."
kubectl apply -f k8s/cost-management/04-cost-reporting.yaml

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."

kubectl wait --for=condition=available --timeout=300s deployment/cost-monitoring-api -n cost-management
kubectl wait --for=condition=available --timeout=300s deployment/budget-monitor -n cost-management
kubectl wait --for=condition=available --timeout=300s deployment/cost-monitoring -n cost-management
kubectl wait --for=condition=available --timeout=300s deployment/cost-reporting-service -n cost-management

echo "✅ All deployments are ready!"

# Check pod status
echo "📋 Current pod status:"
kubectl get pods -n cost-management

# Display service information
echo "🌐 Service endpoints:"
kubectl get services -n cost-management

echo "📊 To access cost dashboards:"
echo "   kubectl port-forward service/grafana 3000:3000 -n observability"
echo "   Open http://localhost:3000/dashboards"

echo "💰 Budget alert thresholds:"
echo "   Development: $500/month (Warning: 80%, Critical: 95%)"
echo "   Staging: $1000/month (Warning: 80%, Critical: 95%)"  
echo "   Production: $5000/month (Warning: 80%, Critical: 95%)"

echo "📧 Monthly reports will be sent to configured recipients on the 1st of each month"

echo "🎯 Cost Management System deployed successfully!"
echo ""
echo "📖 Next steps:"
echo "1. Update Azure service principal credentials in the secret:"
echo "   kubectl edit secret azure-cost-api-secret -n cost-management"
echo ""
echo "2. Configure notification endpoints (Slack, email) in the secret"
echo ""
echo "3. Review and adjust budget thresholds in:"
echo "   kubectl edit configmap budget-configuration -n cost-management"
echo ""
echo "4. Monitor cost metrics in Grafana dashboards"
echo ""
echo "5. Check cost monitoring logs:"
echo "   kubectl logs -l app.kubernetes.io/component=monitoring -n cost-management"
