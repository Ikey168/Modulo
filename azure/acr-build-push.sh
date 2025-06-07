#!/bin/bash

# Azure Container Registry Build and Push Script
# This script builds the Spring Boot Docker image and pushes it to Azure Container Registry

set -e

# Configuration variables - Update these with your actual values
ACR_NAME="your-acr-name"  # Replace with your ACR name (without .azurecr.io)
IMAGE_NAME="modulo-backend"
TAG="latest"
RESOURCE_GROUP="your-resource-group"  # Replace with your resource group name

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Azure Container Registry deployment...${NC}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Login to Azure (if not already logged in)
echo -e "${YELLOW}🔐 Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Please login to Azure...${NC}"
    az login
fi

# Login to ACR
echo -e "${YELLOW}🔐 Logging into Azure Container Registry...${NC}"
az acr login --name $ACR_NAME

# Build the Docker image in the backend directory
echo -e "${YELLOW}🏗️  Building Docker image...${NC}"
cd ../backend
docker build -t $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG .

# Push the image to ACR
echo -e "${YELLOW}📤 Pushing image to Azure Container Registry...${NC}"
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG

echo -e "${GREEN}✅ Successfully pushed image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG${NC}"

# Optional: Clean up local images to save space
read -p "Do you want to remove the local Docker image to save space? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker rmi $ACR_NAME.azurecr.io/$IMAGE_NAME:$TAG
    echo -e "${GREEN}✅ Local image removed${NC}"
fi

echo -e "${GREEN}🎉 Deployment to ACR completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Deploy to Azure App Service or AKS using the image:"
echo -e "   ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${TAG}"
echo -e "2. Configure environment variables for Application Insights"
echo -e "3. Set up autoscaling and health probes"
