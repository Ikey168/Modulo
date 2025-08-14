#!/bin/bash

# Modulo Kubernetes Deployment Script
set -e

echo "🚀 Starting Modulo Kubernetes Deployment..."

# Variables
NAMESPACE="modulo"
REGISTRY="${REGISTRY:-modulo-registry}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if we can connect to cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

echo "✅ Connected to Kubernetes cluster"

# Create namespace
echo "📁 Creating namespace: $NAMESPACE"
kubectl apply -f k8s/00-namespace.yaml

# Apply resource quota
echo "📊 Applying resource quota"
kubectl apply -f k8s/01-resourcequota.yaml

# Deploy PostgreSQL database
echo "🗄️ Deploying PostgreSQL database"
kubectl apply -f k8s/01.5-postgres-deployment.yaml

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s

# Apply API configurations
echo "⚙️ Applying API configurations"
kubectl apply -f k8s/02-api-configmap.yaml
kubectl apply -f k8s/03-api-secret.yaml

# Build and push Docker image (if needed)
if [ "$BUILD_IMAGE" = "true" ]; then
    echo "🔨 Building Docker image"
    docker build -t $REGISTRY/modulo-backend:$IMAGE_TAG ./backend
    docker push $REGISTRY/modulo-backend:$IMAGE_TAG
    
    # Update image in deployment
    sed -i "s|modulo-backend:latest|$REGISTRY/modulo-backend:$IMAGE_TAG|g" k8s/04-api-deployment.yaml
fi

# Deploy API
echo "🚀 Deploying Spring Boot API"
kubectl apply -f k8s/04-api-deployment.yaml
kubectl apply -f k8s/05-api-service.yaml

# Deploy frontend
echo "🌐 Deploying frontend"
kubectl apply -f k8s/06-frontend-configmap.yaml
kubectl apply -f k8s/07-frontend-deployment.yaml
kubectl apply -f k8s/08-frontend-service.yaml

# Setup Horizontal Pod Autoscaler
echo "📈 Setting up autoscaling"
kubectl apply -f k8s/10-api-hpa.yaml

# Deploy ingress (requires ingress controller to be installed)
echo "🌍 Deploying ingress"
kubectl apply -f k8s/09-ingress.yaml

# Wait for API deployment to be ready
echo "⏳ Waiting for API deployment to be ready..."
kubectl wait --for=condition=available deployment/spring-boot-api -n $NAMESPACE --timeout=600s

# Check status
echo "📊 Deployment Status:"
kubectl get all -n $NAMESPACE

# Get ingress info
echo "🌐 Ingress Information:"
kubectl get ingress -n $NAMESPACE

echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Update DNS to point modulo-api.example.com to your ingress IP"
echo "2. Install cert-manager for automatic HTTPS certificates"
echo "3. Update the image registry in the deployment files"
echo "4. Configure monitoring and logging"
echo ""
echo "🔗 API will be available at: https://modulo-api.example.com/api"
echo "🔗 Frontend will be available at: https://modulo-api.example.com"
