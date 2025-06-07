#!/bin/bash

# Azure Environment Setup Script
# This script helps configure the Azure environment variables and secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Azure Environment Configuration${NC}"

# Check if required tools are installed
command -v az >/dev/null 2>&1 || { echo -e "${RED}❌ Azure CLI is required but not installed.${NC}" >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}❌ kubectl is required but not installed.${NC}" >&2; exit 1; }

# Read configuration from user
echo -e "${YELLOW}Please provide the following information:${NC}"
read -p "Resource Group Name: " RESOURCE_GROUP
read -p "ACR Name (without .azurecr.io): " ACR_NAME
read -p "Application Insights Name: " APP_INSIGHTS_NAME

# Validate Azure login
if ! az account show &> /dev/null; then
    echo -e "${RED}❌ Please login to Azure first: az login${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 Retrieving Application Insights information...${NC}"

# Get Application Insights connection string and instrumentation key
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv 2>/dev/null) || {
    echo -e "${RED}❌ Could not find Application Insights: $APP_INSIGHTS_NAME${NC}"
    echo -e "${YELLOW}Creating Application Insights...${NC}"
    az monitor app-insights component create \
        --app $APP_INSIGHTS_NAME \
        --location "East US" \
        --resource-group $RESOURCE_GROUP \
        --kind web
    
    APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
        --app $APP_INSIGHTS_NAME \
        --resource-group $RESOURCE_GROUP \
        --query connectionString -o tsv)
}

APPINSIGHTS_KEY=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey -o tsv)

echo -e "${GREEN}✅ Application Insights configured${NC}"

# Get ACR credentials
echo -e "${YELLOW}🔍 Retrieving ACR credentials...${NC}"
az acr update --name $ACR_NAME --admin-enabled true

ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

echo -e "${GREEN}✅ ACR credentials retrieved${NC}"

# Create Docker config for Kubernetes
DOCKER_CONFIG=$(echo -n "{\"auths\":{\"$ACR_NAME.azurecr.io\":{\"username\":\"$ACR_USERNAME\",\"password\":\"$ACR_PASSWORD\",\"auth\":\"$(echo -n $ACR_USERNAME:$ACR_PASSWORD | base64 -w 0)\"}}}" | base64 -w 0)

# Update Kubernetes secrets file
echo -e "${YELLOW}🔧 Updating Kubernetes secrets...${NC}"
cat > ../k8s/03-azure-secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: app-insights-secret
  namespace: modulo
type: Opaque
stringData:
  connection-string: "${APPINSIGHTS_CONNECTION_STRING}"
  instrumentation-key: "${APPINSIGHTS_KEY}"
---
apiVersion: v1
kind: Secret
metadata:
  name: acr-secret
  namespace: modulo
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: ${DOCKER_CONFIG}
EOF

# Update deployment with correct ACR image
echo -e "${YELLOW}🔧 Updating Kubernetes deployment...${NC}"
sed -i "s|your-acr-name.azurecr.io/modulo-backend:latest|$ACR_NAME.azurecr.io/modulo-backend:latest|g" ../k8s/04-api-deployment.yaml

echo -e "${GREEN}✅ Kubernetes manifests updated successfully!${NC}"
echo -e ""
echo -e "${YELLOW}📝 Configuration Summary:${NC}"
echo -e "Resource Group: ${RESOURCE_GROUP}"
echo -e "ACR: ${ACR_NAME}.azurecr.io"
echo -e "Application Insights: ${APP_INSIGHTS_NAME}"
echo -e "Container Image: ${ACR_NAME}.azurecr.io/modulo-backend:latest"
echo -e ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo -e "1. Build and push your image: ./acr-build-push.sh"
echo -e "2. Deploy to AKS: ./deploy-aks.sh"
echo -e "3. Apply Kubernetes manifests: kubectl apply -f ../k8s/ --namespace modulo"
echo -e ""
echo -e "${YELLOW}🔍 Useful commands:${NC}"
echo -e "Check pods: kubectl get pods --namespace modulo"
echo -e "Check services: kubectl get services --namespace modulo"
echo -e "View logs: kubectl logs -f deployment/spring-boot-api --namespace modulo"
