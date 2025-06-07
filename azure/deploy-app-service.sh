#!/bin/bash

# Azure App Service for Containers Deployment Script
# This script creates and configures an Azure App Service for running the containerized Spring Boot application

set -e

# Configuration variables - Update these with your actual values
RESOURCE_GROUP="your-resource-group"
APP_SERVICE_PLAN="modulo-app-plan"
WEB_APP_NAME="modulo-backend-app"
ACR_NAME="your-acr-name"
IMAGE_NAME="modulo-backend"
TAG="latest"
LOCATION="East US"  # Change to your preferred location

# Application Insights
APP_INSIGHTS_NAME="modulo-app-insights"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure App Service deployment...${NC}"

# Create resource group if it doesn't exist
echo -e "${YELLOW}📁 Creating resource group...${NC}"
az group create --name $RESOURCE_GROUP --location "$LOCATION"

# Create Application Insights
echo -e "${YELLOW}📊 Creating Application Insights...${NC}"
az monitor app-insights component create \
    --app $APP_INSIGHTS_NAME \
    --location "$LOCATION" \
    --resource-group $RESOURCE_GROUP \
    --kind web

# Get Application Insights connection string
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query connectionString -o tsv)

echo -e "${GREEN}✅ Application Insights created with connection string${NC}"

# Create App Service Plan (Linux, containerized)
echo -e "${YELLOW}⚙️  Creating App Service Plan...${NC}"
az appservice plan create \
    --name $APP_SERVICE_PLAN \
    --resource-group $RESOURCE_GROUP \
    --is-linux \
    --sku B1

# Create the Web App for Containers
echo -e "${YELLOW}🌐 Creating Web App for Containers...${NC}"
az webapp create \
    --resource-group $RESOURCE_GROUP \
    --plan $APP_SERVICE_PLAN \
    --name $WEB_APP_NAME \
    --deployment-container-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG

# Configure the Web App to use ACR
echo -e "${YELLOW}🔧 Configuring container settings...${NC}"
az webapp config container set \
    --name $WEB_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG \
    --docker-registry-server-url https://$ACR_NAME.azurecr.io

# Enable ACR admin credentials and configure authentication
echo -e "${YELLOW}🔐 Configuring ACR authentication...${NC}"
az acr update --name $ACR_NAME --admin-enabled true

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Set ACR credentials in App Service
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $WEB_APP_NAME \
    --settings \
        DOCKER_REGISTRY_SERVER_URL=https://$ACR_NAME.azurecr.io \
        DOCKER_REGISTRY_SERVER_USERNAME=$ACR_USERNAME \
        DOCKER_REGISTRY_SERVER_PASSWORD=$ACR_PASSWORD

# Configure Application Insights
echo -e "${YELLOW}📊 Configuring Application Insights...${NC}"
az webapp config appsettings set \
    --resource-group $RESOURCE_GROUP \
    --name $WEB_APP_NAME \
    --settings \
        APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CONNECTION_STRING" \
        WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
        WEBSITES_PORT=8080

# Configure health check
echo -e "${YELLOW}🏥 Configuring health check...${NC}"
az webapp config set \
    --resource-group $RESOURCE_GROUP \
    --name $WEB_APP_NAME \
    --health-check-path "/actuator/health"

# Configure autoscaling
echo -e "${YELLOW}📈 Configuring autoscaling...${NC}"
az monitor autoscale create \
    --resource-group $RESOURCE_GROUP \
    --resource $WEB_APP_NAME \
    --resource-type Microsoft.Web/serverfarms \
    --name "${WEB_APP_NAME}-autoscale" \
    --min-count 1 \
    --max-count 5 \
    --count 1

# Add CPU-based scaling rule
az monitor autoscale rule create \
    --resource-group $RESOURCE_GROUP \
    --autoscale-name "${WEB_APP_NAME}-autoscale" \
    --condition "Percentage CPU > 70 avg 5m" \
    --scale out 1

az monitor autoscale rule create \
    --resource-group $RESOURCE_GROUP \
    --autoscale-name "${WEB_APP_NAME}-autoscale" \
    --condition "Percentage CPU < 30 avg 5m" \
    --scale in 1

echo -e "${GREEN}✅ App Service deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your application will be available at:${NC}"
echo -e "https://${WEB_APP_NAME}.azurewebsites.net"
echo -e ""
echo -e "${YELLOW}📊 Application Insights:${NC}"
echo -e "Resource: ${APP_INSIGHTS_NAME}"
echo -e "Connection String: ${APPINSIGHTS_CONNECTION_STRING}"
echo -e ""
echo -e "${YELLOW}⚙️  Next steps:${NC}"
echo -e "1. Wait for the container to be pulled and started (5-10 minutes)"
echo -e "2. Check the health endpoint: https://${WEB_APP_NAME}.azurewebsites.net/actuator/health"
echo -e "3. Monitor logs: az webapp log tail --name ${WEB_APP_NAME} --resource-group ${RESOURCE_GROUP}"
echo -e "4. View metrics in Application Insights in the Azure Portal"
