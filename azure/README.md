# Azure Deployment Guide

This guide covers deploying the Modulo Spring Boot application to Azure using containers, with monitoring and autoscaling capabilities.

## Overview

The deployment includes:
- **Multi-stage Docker container** for Spring Boot API
- **Azure Container Registry (ACR)** for image storage
- **Azure App Service for Containers** OR **Azure Kubernetes Service (AKS)** for hosting
- **Application Insights** for monitoring and logging
- **Azure Monitor** for metrics and alerts
- **Autoscaling** configuration
- **Health probes** for container management

## Prerequisites

1. **Azure CLI** installed and configured
   ```bash
   # Install Azure CLI (if not already installed)
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   
   # Login to Azure
   az login
   ```

2. **Docker** installed for building images
3. **kubectl** installed (for AKS deployment)

## Quick Start

### 1. Configure Your Settings

Update the configuration variables in the deployment scripts:

**For ACR (`azure/acr-build-push.sh`):**
```bash
ACR_NAME="your-acr-name"           # Your ACR name (without .azurecr.io)
RESOURCE_GROUP="your-resource-group"
```

**For App Service (`azure/deploy-app-service.sh`):**
```bash
RESOURCE_GROUP="your-resource-group"
APP_SERVICE_PLAN="modulo-app-plan"
WEB_APP_NAME="modulo-backend-app"
ACR_NAME="your-acr-name"
LOCATION="East US"
```

**For AKS (`azure/deploy-aks.sh`):**
```bash
RESOURCE_GROUP="your-resource-group"
AKS_CLUSTER_NAME="modulo-aks-cluster"
ACR_NAME="your-acr-name"
LOCATION="East US"
```

### 2. Build and Push to ACR

```bash
cd azure
./acr-build-push.sh
```

This script will:
- Create Azure Container Registry (if needed)
- Build the Docker image
- Push to ACR
- Display the image URL for deployment

### 3. Deploy to Azure

#### Option A: Azure App Service for Containers (Recommended for simple deployments)

```bash
./deploy-app-service.sh
```

#### Option B: Azure Kubernetes Service (Recommended for complex deployments)

```bash
# Deploy AKS cluster and setup
./deploy-aks.sh

# Apply Kubernetes manifests
kubectl apply -f ../k8s/ --namespace modulo

# Check deployment status
kubectl get pods --namespace modulo
kubectl get services --namespace modulo
```

## Architecture

### Container Configuration

The Spring Boot application is packaged using a multi-stage Docker build:

- **Build Stage**: Uses OpenJDK 21 with Maven to compile the application
- **Runtime Stage**: Uses OpenJDK 21 JRE with security optimizations:
  - Non-root user (`springuser`)
  - Optimized JVM settings for containers
  - Health check endpoint
  - Proper port exposure (8080)

### Azure App Service Features

- **Container-based deployment** with ACR integration
- **Auto-scaling** based on CPU utilization (1-5 instances)
- **Health checks** on `/actuator/health`
- **Application Insights** integration
- **Continuous deployment** from ACR

### AKS Features

- **Horizontal Pod Autoscaler (HPA)** for automatic scaling
- **Liveness and readiness probes** for health monitoring
- **Resource limits and requests** for optimal performance
- **ConfigMaps and Secrets** for configuration management
- **Ingress controller** for external access

## Monitoring and Observability

### Application Insights

The application is configured with Azure Application Insights for:

- **Application Performance Monitoring (APM)**
- **Request tracking and dependency mapping**
- **Exception and error logging**
- **Custom metrics and events**
- **Live metrics streaming**

### Configuration

The following environment variables are automatically set:

```properties
# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=<auto-configured>
APPLICATIONINSIGHTS_INSTRUMENTATION_KEY=<auto-configured>

# Health checks
management.endpoint.health.probes.enabled=true
management.health.livenessstate.enabled=true
management.health.readinessstate.enabled=true
```

### Monitoring Endpoints

- **Health Check**: `/actuator/health`
- **Liveness Probe**: `/actuator/health/liveness`
- **Readiness Probe**: `/actuator/health/readiness`
- **Metrics**: `/actuator/metrics`
- **Info**: `/actuator/info`

## Scaling Configuration

### App Service Autoscaling

- **Minimum instances**: 1
- **Maximum instances**: 5
- **Scale out trigger**: CPU > 70% for 5 minutes
- **Scale in trigger**: CPU < 30% for 5 minutes

### AKS Autoscaling (HPA)

```yaml
# Configured in k8s/10-api-hpa.yaml
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70
```

## Security

### Container Security

- **Non-root user**: Application runs as `springuser`
- **Minimal attack surface**: JRE-only runtime image
- **Resource limits**: CPU and memory constraints
- **Health checks**: Automatic restart on failure

### Azure Security

- **Managed Identity**: For ACR authentication
- **Private networking**: VNet integration available
- **SSL/TLS**: Automatic HTTPS certificates
- **Secrets management**: Azure Key Vault integration

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check App Service logs
   az webapp log tail --name <app-name> --resource-group <rg>
   
   # Check AKS pod logs
   kubectl logs -f deployment/spring-boot-api --namespace modulo
   ```

2. **Health check failures**
   - Ensure `/actuator/health` endpoint is accessible
   - Check Application Insights dependency is properly configured
   - Verify container port 8080 is exposed

3. **Application Insights not working**
   - Verify connection string is set correctly
   - Check firewall rules and network connectivity
   - Ensure Maven dependencies are included

### Useful Commands

```bash
# App Service
az webapp show --name <app-name> --resource-group <rg>
az webapp log tail --name <app-name> --resource-group <rg>
az webapp restart --name <app-name> --resource-group <rg>

# AKS
kubectl get pods --namespace modulo
kubectl describe pod <pod-name> --namespace modulo
kubectl logs -f <pod-name> --namespace modulo
kubectl exec -it <pod-name> --namespace modulo -- /bin/bash

# ACR
az acr repository list --name <acr-name>
az acr repository show-tags --name <acr-name> --repository modulo-backend
```

## Cost Optimization

### App Service
- Use **B1** (Basic) tier for development
- Use **S1** (Standard) or higher for production
- Enable autoscaling to optimize costs

### AKS
- Use **Standard_B2s** nodes for cost-effective compute
- Enable **cluster autoscaler** for node optimization
- Use **Azure Spot instances** for non-production workloads

### Monitoring
- Set up **Azure Monitor alerts** for cost tracking
- Use **Application Insights sampling** to reduce data ingestion costs

## Next Steps

1. **Set up CI/CD pipeline** with Azure DevOps or GitHub Actions
2. **Configure custom domain** and SSL certificates
3. **Implement Azure Key Vault** for secrets management
4. **Set up staging environments** for testing
5. **Configure backup and disaster recovery**

## Support

For issues with this deployment setup:
1. Check the troubleshooting section above
2. Review Azure documentation for specific services
3. Check Application Insights for application-level issues
4. Review Kubernetes events for AKS deployments
