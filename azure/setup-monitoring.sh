#!/bin/bash

# Azure Monitoring and Alerts Setup Script
# This script creates Application Insights dashboards and configures monitoring alerts

set -e

# Configuration variables
RESOURCE_GROUP="your-resource-group"
APP_INSIGHTS_NAME="modulo-app-insights"
WEB_APP_NAME="modulo-backend-app"
AKS_CLUSTER_NAME="modulo-aks-cluster"
ACTION_GROUP_NAME="modulo-alerts"
EMAIL_RECEIVER="your-email@example.com"  # Update with your email

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Setting up Azure monitoring and alerts...${NC}"

# Create action group for notifications
echo -e "${YELLOW}📧 Creating action group for notifications...${NC}"
az monitor action-group create \
    --resource-group $RESOURCE_GROUP \
    --name $ACTION_GROUP_NAME \
    --short-name "ModuloAlert" \
    --email $EMAIL_RECEIVER "ModuloAdmin"

ACTION_GROUP_ID=$(az monitor action-group show \
    --resource-group $RESOURCE_GROUP \
    --name $ACTION_GROUP_NAME \
    --query id -o tsv)

# Get Application Insights ID
APP_INSIGHTS_ID=$(az monitor app-insights component show \
    --app $APP_INSIGHTS_NAME \
    --resource-group $RESOURCE_GROUP \
    --query id -o tsv)

echo -e "${YELLOW}⚠️  Creating monitoring alerts...${NC}"

# High Response Time Alert
az monitor metrics alert create \
    --name "High Response Time - Modulo API" \
    --resource-group $RESOURCE_GROUP \
    --scopes $APP_INSIGHTS_ID \
    --condition "avg requests/duration > 5000" \
    --description "Alert when average response time exceeds 5 seconds" \
    --evaluation-frequency PT1M \
    --window-size PT5M \
    --severity 2 \
    --action $ACTION_GROUP_ID

# High Error Rate Alert
az monitor metrics alert create \
    --name "High Error Rate - Modulo API" \
    --resource-group $RESOURCE_GROUP \
    --scopes $APP_INSIGHTS_ID \
    --condition "avg requests/failed > 10" \
    --description "Alert when error rate exceeds 10 failed requests per minute" \
    --evaluation-frequency PT1M \
    --window-size PT5M \
    --severity 1 \
    --action $ACTION_GROUP_ID

# Low Availability Alert
az monitor metrics alert create \
    --name "Low Availability - Modulo API" \
    --resource-group $RESOURCE_GROUP \
    --scopes $APP_INSIGHTS_ID \
    --condition "avg availabilityResults/availabilityPercentage < 95" \
    --description "Alert when availability drops below 95%" \
    --evaluation-frequency PT5M \
    --window-size PT15M \
    --severity 1 \
    --action $ACTION_GROUP_ID

# Check if App Service exists for CPU alerts
if az webapp show --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}📊 Creating App Service alerts...${NC}"
    
    WEB_APP_ID=$(az webapp show \
        --name $WEB_APP_NAME \
        --resource-group $RESOURCE_GROUP \
        --query id -o tsv)
    
    # High CPU Alert for App Service
    az monitor metrics alert create \
        --name "High CPU - App Service" \
        --resource-group $RESOURCE_GROUP \
        --scopes $WEB_APP_ID \
        --condition "avg CpuPercentage > 80" \
        --description "Alert when CPU usage exceeds 80%" \
        --evaluation-frequency PT1M \
        --window-size PT5M \
        --severity 2 \
        --action $ACTION_GROUP_ID

    # High Memory Alert for App Service
    az monitor metrics alert create \
        --name "High Memory - App Service" \
        --resource-group $RESOURCE_GROUP \
        --scopes $WEB_APP_ID \
        --condition "avg MemoryPercentage > 85" \
        --description "Alert when memory usage exceeds 85%" \
        --evaluation-frequency PT1M \
        --window-size PT5M \
        --severity 2 \
        --action $ACTION_GROUP_ID
fi

# Check if AKS exists for container alerts
if az aks show --name $AKS_CLUSTER_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    echo -e "${YELLOW}☸️  Creating AKS alerts...${NC}"
    
    AKS_ID=$(az aks show \
        --name $AKS_CLUSTER_NAME \
        --resource-group $RESOURCE_GROUP \
        --query id -o tsv)
    
    # Pod Restart Alert
    az monitor metrics alert create \
        --name "High Pod Restarts - AKS" \
        --resource-group $RESOURCE_GROUP \
        --scopes $AKS_ID \
        --condition "avg kube_pod_container_status_restarts_total > 5" \
        --description "Alert when pod restarts exceed 5 in 10 minutes" \
        --evaluation-frequency PT1M \
        --window-size PT10M \
        --severity 2 \
        --action $ACTION_GROUP_ID

    # Node CPU Alert
    az monitor metrics alert create \
        --name "High Node CPU - AKS" \
        --resource-group $RESOURCE_GROUP \
        --scopes $AKS_ID \
        --condition "avg node_cpu_usage_percentage > 80" \
        --description "Alert when node CPU usage exceeds 80%" \
        --evaluation-frequency PT1M \
        --window-size PT5M \
        --severity 2 \
        --action $ACTION_GROUP_ID
fi

echo -e "${GREEN}✅ Monitoring and alerts setup completed!${NC}"
echo -e ""
echo -e "${YELLOW}📊 Created Alerts:${NC}"
echo -e "1. High Response Time (>5 seconds)"
echo -e "2. High Error Rate (>10 errors/min)"
echo -e "3. Low Availability (<95%)"
echo -e "4. High CPU Usage (>80% for 5 minutes)"
echo -e "5. High Memory Usage (>85% for 5 minutes)"
echo -e ""
echo -e "${YELLOW}📧 Notifications will be sent to: ${EMAIL_RECEIVER}${NC}"
echo -e ""
echo -e "${YELLOW}🔗 Next Steps:${NC}"
echo -e "1. Check Azure Portal for Application Insights dashboard"
echo -e "2. Customize alert thresholds as needed"
echo -e "3. Add additional email recipients to action group"
echo -e "4. Create custom dashboards for business metrics"
