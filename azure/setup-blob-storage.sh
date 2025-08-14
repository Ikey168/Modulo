#!/bin/bash

# Azure Blob Storage Setup Script for Modulo
# This script sets up Azure Blob Storage for file attachments with CDN

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-modulo-rg}"
STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-modulostorage}"
LOCATION="${AZURE_LOCATION:-eastus}"
CONTAINER_NAME="${AZURE_CONTAINER_NAME:-attachments}"
CDN_PROFILE="${AZURE_CDN_PROFILE:-modulo-cdn}"
CDN_ENDPOINT="${AZURE_CDN_ENDPOINT:-modulo-attachments}"
MANAGED_IDENTITY="${AZURE_MANAGED_IDENTITY:-modulo-storage-identity}"

echo -e "${BLUE}🚀 Setting up Azure Blob Storage for Modulo${NC}"
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Resource Group: ${RESOURCE_GROUP}"
echo -e "  Storage Account: ${STORAGE_ACCOUNT}"
echo -e "  Location: ${LOCATION}"
echo -e "  Container: ${CONTAINER_NAME}"
echo -e "  CDN Profile: ${CDN_PROFILE}"
echo -e "  CDN Endpoint: ${CDN_ENDPOINT}"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Azure. Please login first.${NC}"
    az login
fi

# Get subscription info
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${BLUE}📋 Using subscription: ${SUBSCRIPTION_ID}${NC}"

# 1. Create Resource Group
echo -e "${YELLOW}📦 Creating resource group...${NC}"
az group create \
    --name "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --output table

# 2. Create Storage Account
echo -e "${YELLOW}🗄️  Creating storage account...${NC}"
az storage account create \
    --name "${STORAGE_ACCOUNT}" \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --access-tier Hot \
    --https-only true \
    --allow-blob-public-access true \
    --output table

# 3. Create Container
echo -e "${YELLOW}📁 Creating blob container...${NC}"
az storage container create \
    --name "${CONTAINER_NAME}" \
    --account-name "${STORAGE_ACCOUNT}" \
    --public-access blob \
    --output table

# 4. Create Managed Identity
echo -e "${YELLOW}🔐 Creating managed identity...${NC}"
IDENTITY_ID=$(az identity create \
    --name "${MANAGED_IDENTITY}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query id -o tsv)

IDENTITY_PRINCIPAL_ID=$(az identity show \
    --name "${MANAGED_IDENTITY}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query principalId -o tsv)

echo -e "${GREEN}✅ Managed Identity created: ${IDENTITY_ID}${NC}"

# 5. Assign Storage Blob Data Contributor role
echo -e "${YELLOW}👤 Assigning storage permissions...${NC}"
STORAGE_SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Storage/storageAccounts/${STORAGE_ACCOUNT}"

az role assignment create \
    --assignee "${IDENTITY_PRINCIPAL_ID}" \
    --role "Storage Blob Data Contributor" \
    --scope "${STORAGE_SCOPE}" \
    --output table

# 6. Create CDN Profile (optional)
read -p "Do you want to create Azure CDN for faster file access? (y/n): " create_cdn
if [[ $create_cdn =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🌐 Creating CDN profile...${NC}"
    az cdn profile create \
        --name "${CDN_PROFILE}" \
        --resource-group "${RESOURCE_GROUP}" \
        --sku Standard_Microsoft \
        --output table

    echo -e "${YELLOW}🔗 Creating CDN endpoint...${NC}"
    az cdn endpoint create \
        --name "${CDN_ENDPOINT}" \
        --profile-name "${CDN_PROFILE}" \
        --resource-group "${RESOURCE_GROUP}" \
        --origin "${STORAGE_ACCOUNT}.blob.core.windows.net" \
        --origin-host-header "${STORAGE_ACCOUNT}.blob.core.windows.net" \
        --output table

    CDN_URL="https://${CDN_ENDPOINT}.azureedge.net"
    echo -e "${GREEN}✅ CDN Endpoint created: ${CDN_URL}${NC}"
fi

# 7. Get configuration values
echo -e "${YELLOW}📋 Getting configuration values...${NC}"
STORAGE_KEY=$(az storage account keys list \
    --account-name "${STORAGE_ACCOUNT}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query '[0].value' -o tsv)

CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=${STORAGE_ACCOUNT};AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"

# 8. Display configuration
echo -e "${GREEN}🎉 Azure Blob Storage setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo -e "${YELLOW}Environment Variables:${NC}"
echo "AZURE_STORAGE_ACCOUNT_NAME=${STORAGE_ACCOUNT}"
echo "AZURE_STORAGE_CONNECTION_STRING=${CONNECTION_STRING}"
echo "AZURE_STORAGE_CONTAINER_NAME=${CONTAINER_NAME}"
echo "AZURE_STORAGE_USE_MANAGED_IDENTITY=true"
if [[ $create_cdn =~ ^[Yy]$ ]]; then
    echo "AZURE_CDN_ENDPOINT=${CDN_URL}"
fi
echo ""

echo -e "${YELLOW}Kubernetes Secrets (base64 encoded):${NC}"
echo "connection-string: $(echo -n "${CONNECTION_STRING}" | base64 -w 0)"
echo "account-key: $(echo -n "${STORAGE_KEY}" | base64 -w 0)"
echo ""

echo -e "${YELLOW}Managed Identity:${NC}"
echo "Identity ID: ${IDENTITY_ID}"
echo "Principal ID: ${IDENTITY_PRINCIPAL_ID}"
echo ""

# 9. Create Kubernetes secret template
echo -e "${YELLOW}📝 Creating Kubernetes configuration...${NC}"
cat > azure-storage-secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: azure-storage-secret
  namespace: modulo
type: Opaque
data:
  connection-string: $(echo -n "${CONNECTION_STRING}" | base64 -w 0)
  account-key: $(echo -n "${STORAGE_KEY}" | base64 -w 0)
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: azure-storage-config
  namespace: modulo
data:
  account-name: "${STORAGE_ACCOUNT}"
  container-name: "${CONTAINER_NAME}"
  use-managed-identity: "true"
  max-file-size: "10485760"
  cdn-endpoint: "${CDN_URL:-}"
  allowed-content-types: "image/jpeg,image/png,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
EOF

echo -e "${GREEN}✅ Kubernetes configuration saved to azure-storage-secret.yaml${NC}"
echo ""

echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Apply Kubernetes configuration:"
echo "   kubectl apply -f azure-storage-secret.yaml"
echo ""
echo "2. Update your application configuration with the environment variables above"
echo ""
echo "3. If using AKS, configure the managed identity:"
echo "   az aks pod-identity add \\"
echo "     --resource-group ${RESOURCE_GROUP} \\"
echo "     --cluster-name <your-aks-cluster> \\"
echo "     --namespace modulo \\"
echo "     --name storage-identity \\"
echo "     --identity-resource-id ${IDENTITY_ID}"
echo ""
echo "4. Deploy the updated application with Azure Blob Storage support"
echo ""

if [[ $create_cdn =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}💡 CDN Note:${NC}"
    echo "CDN propagation may take 15-90 minutes. Test with blob URLs first."
    echo ""
fi

echo -e "${GREEN}🎉 Setup complete! Your Azure Blob Storage is ready for file attachments.${NC}"
