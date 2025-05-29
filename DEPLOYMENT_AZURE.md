# Deploying to Azure

This document outlines the steps to deploy a containerized application to Azure using two common services: Azure App Service for Containers and Azure Kubernetes Service (AKS).

**Prerequisites:**

*   A containerized application (Docker image).
*   Azure CLI installed and configured: [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
*   Docker installed locally: [Install Docker](https://docs.docker.com/get-docker/)
*   `kubectl` installed (for AKS): [Install kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/)
*   An active Azure subscription.

Replace placeholder values (e.g., `your-resource-group`, `youruniqueacrname`, `your-image-name:tag`) with your actual values.

---

## Option 1: Azure App Service for Containers

Azure App Service for Containers is a PaaS offering that simplifies running containerized web applications.

### 1. Build and Tag Your Docker Image

If your Docker image isn't already built and tagged:
```bash
# Navigate to your application's Dockerfile directory
# cd /path/to/your/app/with/Dockerfile

# Build the image
docker build -t your-image-name:latest .

# Example:
# docker build -t myapp:v1.0.0 .
```

### 2. Push Docker Image to a Container Registry

Azure Container Registry (ACR) is recommended.

**A. Create Azure Container Registry (ACR) (if you don't have one):**
```bash
# Define variables
RESOURCE_GROUP="your-resource-group"
ACR_NAME="youruniqueacrname" # Must be globally unique
LOCATION="eastus"            # Choose your Azure region

# Create a resource group (if it doesn't exist)
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create ACR
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true
```

**B. Log in to ACR:**
```bash
az acr login --name $ACR_NAME
```

**C. Tag your local image for ACR:**
```bash
docker tag your-image-name:latest ${ACR_NAME}.azurecr.io/your-image-name:latest

# Example:
# docker tag myapp:v1.0.0 myuniqueacrname.azurecr.io/myapp:v1.0.0
```

**D. Push the image to ACR:**
```bash
docker push ${ACR_NAME}.azurecr.io/your-image-name:latest

# Example:
# docker push myuniqueacrname.azurecr.io/myapp:v1.0.0
```
*(For Docker Hub, you would tag and push to `yourdockerhubusername/your-image-name:latest`)*

### 3. Create an App Service Plan

This defines the compute resources for your web app.
```bash
# Define variables
APP_SERVICE_PLAN_NAME="your-app-service-plan"
# RESOURCE_GROUP and LOCATION should be the same as defined for ACR

# Create App Service Plan
az appservice plan create --name $APP_SERVICE_PLAN_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku B1 \
  --is-linux # Important for Linux containers
```
*(Choose a SKU like B1, S1, P1V2, etc., based on your needs.)*

### 4. Create the Web App for Containers

```bash
# Define variables
APP_NAME="youruniqueappname" # Must be globally unique
# RESOURCE_GROUP, APP_SERVICE_PLAN_NAME, ACR_NAME as defined above
DOCKER_IMAGE_FULL_PATH="${ACR_NAME}.azurecr.io/your-image-name:latest"

# Get ACR credentials (if admin user is enabled and you're not using managed identity)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Create Web App
az webapp create --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN_NAME \
  --name $APP_NAME \
  --deployment-container-image-name $DOCKER_IMAGE_FULL_PATH \
  --docker-registry-server-url "https://${ACR_NAME}.azurecr.io" \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD
```
*Note: For production, consider using Managed Identities or Service Principals for ACR authentication instead of admin credentials.*

### 5. Configure Application Settings (Environment Variables)

Your application likely needs environment variables (e.g., database connection strings, API keys).
```bash
# Example: Setting a PORT and other custom environment variables
# The WEBSITES_PORT setting tells App Service which port your container is listening on.
az webapp config appsettings set --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings WEBSITES_PORT=8000 PORT=8000 DB_CONNECTION_STRING="your_db_connection_details" API_KEY="your_api_key"

# Example for your project (assuming backend runs on 8080, frontend on 80):
# For backend service:
# az webapp config appsettings set -g $RESOURCE_GROUP -n your-backend-app-name --settings WEBSITES_PORT=8080 SPRING_PROFILES_ACTIVE=prod ...
# For frontend service (if served via Nginx in container):
# az webapp config appsettings set -g $RESOURCE_GROUP -n your-frontend-app-name --settings WEBSITES_PORT=80 ...
```
Your application should then be accessible at `http://youruniqueappname.azurewebsites.net`.

---

## Option 2: Azure Kubernetes Service (AKS)

AKS provides a managed Kubernetes environment for orchestrating containerized applications.

### 1. Build and Tag Your Docker Image
(Same as Step 1 for App Service)

### 2. Push Docker Image to a Container Registry
(Same as Step 2 for App Service - ACR is highly recommended)

### 3. Create an AKS Cluster (if you don't have one)

```bash
# Define variables
# RESOURCE_GROUP, LOCATION, ACR_NAME as defined previously
AKS_CLUSTER_NAME="your-aks-cluster"
NODE_COUNT=1             # Start with 1 node for testing, adjust as needed
NODE_VM_SIZE="Standard_DS2_v2" # Choose an appropriate VM size

# Create AKS cluster
az aks create --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --node-count $NODE_COUNT \
  --node-vm-size $NODE_VM_SIZE \
  --enable-addons monitoring \
  --generate-ssh-keys

# Attach ACR to AKS for seamless image pulling (recommended)
# This grants the AKS cluster's service principal pull access to your ACR.
az aks update --name $AKS_CLUSTER_NAME \
  --resource-group $RESOURCE_GROUP \
  --attach-acr $ACR_NAME
```

### 4. Configure `kubectl` to Connect to Your AKS Cluster

```bash
az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER_NAME --overwrite-existing

# Test connection
kubectl get nodes
```

### 5. Prepare Kubernetes Manifest Files

You will need Kubernetes manifest files (YAML) to define your application's Deployments, Services, ConfigMaps, Secrets, Ingress, etc. Your project already has a `k8s/` directory with examples. You'll need to:
    *   Update image paths in Deployment files (e.g., [`k8s/04-api-deployment.yaml`](k8s/04-api-deployment.yaml:1), [`k8s/07-frontend-deployment.yaml`](k8s/07-frontend-deployment.yaml:1)) to point to your ACR image: `youruniqueacrname.azurecr.io/your-image-name:tag`.
    *   Review and adjust replica counts, resource requests/limits, environment variables (possibly using ConfigMaps/Secrets), and service definitions.
    *   Ensure your Ingress controller (if using [`k8s/09-ingress.yaml`](k8s/09-ingress.yaml:1)) is set up in the cluster or install one (e.g., NGINX Ingress Controller).

**Example snippet for a Deployment YAML (`your-app-deployment.yaml`):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-sample-app-deployment # Change to your app's name e.g., backend-api-deployment
  # namespace: your-namespace # As defined in k8s/00-namespace.yaml
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-sample-app # Change to your app's label e.g., backend-api
  template:
    metadata:
      labels:
        app: my-sample-app # Change to your app's label
    spec:
      containers:
      - name: my-sample-app-container # Change to your container name
        image: youruniqueacrname.azurecr.io/your-image-name:latest # IMPORTANT: Update this
        ports:
        - containerPort: 8080 # The port your application listens on INSIDE the container
        env:
        # Define environment variables directly, or use ConfigMaps/Secrets
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        # - name: DATABASE_URL
        #   valueFrom:
        #     secretKeyRef:
        #       name: my-app-secrets
        #       key: database-url
      # If not using --attach-acr, you might need imagePullSecrets:
      # imagePullSecrets:
      # - name: acr-secret
```

**Example snippet for a Service YAML (`your-app-service.yaml`):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-sample-app-service # Change to your app's service name e.g., backend-api-service
  # namespace: your-namespace
spec:
  type: LoadBalancer # Or ClusterIP if exposed via Ingress
  selector:
    app: my-sample-app # Must match the labels in your Deployment
  ports:
  - protocol: TCP
    port: 80 # External port for LoadBalancer, or internal port for ClusterIP
    targetPort: 8080 # Port on the Pod (must match containerPort)
```

### 6. Apply the Manifests to Your AKS Cluster

Navigate to the directory containing your Kubernetes manifest files (e.g., your `k8s/` directory).
```bash
# Apply all YAML files in the k8s directory
kubectl apply -f ./k8s/

# Or apply specific files
# kubectl apply -f ./k8s/00-namespace.yaml
# kubectl apply -f ./k8s/02-api-configmap.yaml
# ... and so on for all relevant files in order.
```

### 7. Check Deployment Status and Access

```bash
# Check rollout status of a specific deployment
kubectl rollout status deployment/your-api-deployment-name --namespace your-namespace
kubectl rollout status deployment/your-frontend-deployment-name --namespace your-namespace

# Get pods
kubectl get pods --namespace your-namespace -l app=your-app-label

# Get services
kubectl get services --namespace your-namespace

# If using a LoadBalancer service type, wait for the EXTERNAL-IP:
kubectl get service your-service-name --namespace your-namespace -w

# If using Ingress, check Ingress status and ensure DNS is configured:
kubectl get ingress --namespace your-namespace
```
Once the `EXTERNAL-IP` is assigned (for LoadBalancer services) or Ingress is configured, your application will be accessible.

---

## General Considerations for Both Options

*   **Configuration & Secrets Management:**
    *   **App Service:** Use Application Settings for environment variables and Azure Key Vault for secrets.
    *   **AKS:** Use Kubernetes ConfigMaps for non-sensitive configuration and Secrets for sensitive data. Integrate with Azure Key Vault using the AKS provider for Key Vault.
*   **Logging and Monitoring:**
    *   **App Service:** Integrates with Azure Monitor (Application Insights).
    *   **AKS:** Use Azure Monitor for containers, or deploy solutions like Prometheus/Grafana.
*   **CI/CD:** Automate your build and deployment processes using GitHub Actions (like your existing [`.github/workflows/ci.yml`](.github/workflows/ci.yml:1)), Azure DevOps Pipelines, or Jenkins.
*   **Cost Management:** Be mindful of the SKUs, VM sizes, and number of instances you provision.
*   **Security:**
    *   Scan container images for vulnerabilities.
    *   Use network policies in AKS.
    *   Secure access to your container registry.
    *   Regularly update dependencies and base images.
*   **Database:** If your application requires a database, provision Azure Database for PostgreSQL, MySQL, SQL Database, or Cosmos DB and configure your application to connect to it.

This guide provides a starting point. Adapt the commands and configurations to your specific application architecture and requirements.