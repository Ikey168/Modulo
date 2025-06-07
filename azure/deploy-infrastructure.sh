#!/bin/bash

# Azure Infrastructure Deployment Script using ARM Templates
# This script deploys the complete Azure infrastructure using Infrastructure as Code

set -e

# Configuration variables
RESOURCE_GROUP="modulo-rg"
LOCATION="East US"
DEPLOYMENT_NAME="modulo-deployment-$(date +%Y%m%d%H%M%S)"
TEMPLATE_FILE="infrastructure-template.json"
PARAMETERS_FILE="infrastructure-parameters.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure Infrastructure Deployment with ARM Templates...${NC}"

# Validate prerequisites
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo -e "${YELLOW}🔐 Please login to Azure...${NC}"
    az login
fi

# Create resource group
echo -e "${YELLOW}📁 Creating resource group: ${RESOURCE_GROUP}...${NC}"
az group create --name $RESOURCE_GROUP --location "$LOCATION"

# Validate ARM template
echo -e "${YELLOW}✅ Validating ARM template...${NC}"
az deployment group validate \
    --resource-group $RESOURCE_GROUP \
    --template-file $TEMPLATE_FILE \
    --parameters @$PARAMETERS_FILE

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Template validation failed. Please check the template and parameters.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Template validation successful!${NC}"

# Deploy infrastructure
echo -e "${YELLOW}🏗️  Deploying Azure infrastructure (this may take 10-15 minutes)...${NC}"
az deployment group create \
    --resource-group $RESOURCE_GROUP \
    --name $DEPLOYMENT_NAME \
    --template-file $TEMPLATE_FILE \
    --parameters @$PARAMETERS_FILE \
    --verbose

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed. Check the Azure Portal for details.${NC}"
    exit 1
fi

# Get deployment outputs
echo -e "${YELLOW}📋 Retrieving deployment outputs...${NC}"
ACR_LOGIN_SERVER=$(az deployment group show \
    --resource-group $RESOURCE_GROUP \
    --name $DEPLOYMENT_NAME \
    --query properties.outputs.acrLoginServer.value -o tsv)

WEB_APP_URL=$(az deployment group show \
    --resource-group $RESOURCE_GROUP \
    --name $DEPLOYMENT_NAME \
    --query properties.outputs.webAppUrl.value -o tsv)

APP_INSIGHTS_KEY=$(az deployment group show \
    --resource-group $RESOURCE_GROUP \
    --name $DEPLOYMENT_NAME \
    --query properties.outputs.appInsightsInstrumentationKey.value -o tsv)

APP_INSIGHTS_CONNECTION=$(az deployment group show \
    --resource-group $RESOURCE_GROUP \
    --name $DEPLOYMENT_NAME \
    --query properties.outputs.appInsightsConnectionString.value -o tsv)

# Create environment file for easy reference
echo -e "${YELLOW}📝 Creating environment configuration file...${NC}"
cat > deployment-config.env << EOF
# Azure Deployment Configuration
# Generated on $(date)

RESOURCE_GROUP=${RESOURCE_GROUP}
ACR_LOGIN_SERVER=${ACR_LOGIN_SERVER}
WEB_APP_URL=${WEB_APP_URL}
APPLICATIONINSIGHTS_INSTRUMENTATION_KEY=${APP_INSIGHTS_KEY}
APPLICATIONINSIGHTS_CONNECTION_STRING=${APP_INSIGHTS_CONNECTION}

# Usage Instructions:
# 1. Build and push Docker image:
#    docker build -t ${ACR_LOGIN_SERVER}/modulo-backend:latest ../backend/
#    docker push ${ACR_LOGIN_SERVER}/modulo-backend:latest
#
# 2. Access your application:
#    ${WEB_APP_URL}
#
# 3. Monitor with Application Insights:
#    Instrumentation Key: ${APP_INSIGHTS_KEY}
EOF

echo -e "${GREEN}✅ Infrastructure deployment completed successfully!${NC}"
echo -e ""
echo -e "${YELLOW}📊 Deployment Summary:${NC}"
echo -e "Resource Group: ${RESOURCE_GROUP}"
echo -e "Container Registry: ${ACR_LOGIN_SERVER}"
echo -e "Web App URL: ${WEB_APP_URL}"
echo -e "Application Insights Key: ${APP_INSIGHTS_KEY}"
echo -e ""
echo -e "${YELLOW}📝 Configuration saved to: deployment-config.env${NC}"
echo -e ""
echo -e "${YELLOW}🚀 Next Steps:${NC}"
echo -e "1. Update your deployment scripts with the ACR login server:"
echo -e "   ${ACR_LOGIN_SERVER}"
echo -e "2. Build and push your Docker image:"
echo -e "   ./acr-build-push.sh"
echo -e "3. Your application will be available at:"
echo -e "   ${WEB_APP_URL}"
echo -e "4. Monitor your application in the Azure Portal"
echo -e ""
echo -e "${GREEN}🎉 Azure infrastructure is ready for your application!${NC}"
