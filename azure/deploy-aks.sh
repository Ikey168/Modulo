#!/bin/bash

# Azure Kubernetes Service (AKS) Deployment Script
# This script creates an AKS cluster and deploys the containerized Spring Boot application

set -e

# Configuration variables - Update these with your actual values
RESOURCE_GROUP="your-resource-group"
AKS_CLUSTER_NAME="modulo-aks-cluster"
ACR_NAME="your-acr-name"
LOCATION="East US"
NODE_COUNT=2
NODE_SIZE="Standard_B2s"

# Application Insights
APP_INSIGHTS_NAME="modulo-app-insights"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure Kubernetes Service deployment...${NC}"

# Create resource group if it doesn't exist
echo -e "${YELLOW}📁 Creating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location "$LOCATION"

# Create Application Insights if it doesn't exist
echo -e "${YELLOW}📊 Creating Application Insights...${NC}"
az monitor app-insights component create \
    --app $APP_INSIGHTS_NAME \
    --location "$LOCATION" \
    --resource-group $RESOURCE_GROUP \
    --kind web \
    --query "instrumentationKey" -o tsv > /tmp/app_insights_key.txt

APPINSIGHTS_KEY=$(cat /tmp/app_insights_key.txt)
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv)

echo -e "${GREEN}✅ Application Insights created${NC}"

# Create AKS cluster
echo -e "${YELLOW}⚙️  Creating AKS cluster (this may take 10-15 minutes)...${NC}"
az aks create \
    --resource-group $RESOURCE_GROUP \
    --name $AKS_CLUSTER_NAME \
    --node-count $NODE_COUNT \
    --node-vm-size $NODE_SIZE \
    --enable-addons monitoring \
    --generate-ssh-keys \
    --attach-acr $ACR_NAME

# Get AKS credentials
echo -e "${YELLOW}🔐 Getting AKS credentials...${NC}"
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME

# Create namespace
echo -e "${YELLOW}📦 Creating Kubernetes namespace...${NC}"
kubectl create namespace modulo --dry-run=client -o yaml | kubectl apply -f -

# Create secret for Application Insights
echo -e "${YELLOW}🔐 Creating Application Insights secret...${NC}"
kubectl create secret generic app-insights-secret \
    --from-literal=connection-string="$APPINSIGHTS_CONNECTION_STRING" \
    --from-literal=instrumentation-key="$APPINSIGHTS_KEY" \
    --namespace modulo \
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✅ AKS cluster deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "1. Update the Kubernetes manifests in the k8s/ directory with your ACR image"
echo -e "2. Apply the Kubernetes manifests:"
echo -e "   kubectl apply -f k8s/ --namespace modulo"
echo -e "3. Check the deployment status:"
echo -e "   kubectl get pods --namespace modulo"
echo -e "4. Get the external IP of the service:"
echo -e "   kubectl get service --namespace modulo"
echo -e ""
echo -e "${YELLOW}🔧 Cluster Information:${NC}"
echo -e "Resource Group: ${RESOURCE_GROUP}"
echo -e "Cluster Name: ${AKS_CLUSTER_NAME}"
echo -e "Location: ${LOCATION}"
echo -e "Application Insights: ${APP_INSIGHTS_NAME}"
