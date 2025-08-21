# Modulo Kubernetes Deployment

This directory contains Kubernetes manifests to deploy the Modulo application (Spring Boot API + React Frontend + PostgreSQL) to a Kubernetes cluster with HTTPS support.

## 📋 Prerequisites

- Kubernetes cluster (v1.20+)
- kubectl configured to access your cluster
- Docker registry access
- Ingress controller (nginx-ingress recommended)
- cert-manager (for automatic HTTPS certificates)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Internet      │    │   Kubernetes     │    │   PostgreSQL    │
│                 │    │                  │    │                 │
│ HTTPS Traffic   │───▶│  Ingress + TLS   │───▶│   Database      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Load Balancer  │
                       │                  │
                       └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Spring Boot  │    │   React      │
            │ API (2 pods) │    │ Frontend     │
            │              │    │              │
            └──────────────┘    └──────────────┘
```

## 📁 Files Overview

| File | Description |
|------|-------------|
| `00-namespace.yaml` | Creates the modulo namespace |
| `01-resourcequota.yaml` | Sets resource limits for the namespace |
| `01.5-postgres-deployment.yaml` | PostgreSQL database deployment with persistent storage |
| `02-api-configmap.yaml` | Configuration for Spring Boot API |
| `03-api-secret.yaml` | Database credentials and secrets |
| `04-api-deployment.yaml` | Spring Boot API deployment (2 replicas) |
| `05-api-service.yaml` | Service to expose the API |
| `06-frontend-configmap.yaml` | Frontend configuration |
| `07-frontend-deployment.yaml` | React frontend deployment |
| `08-frontend-service.yaml` | Service to expose the frontend |
| `09-ingress.yaml` | Ingress with HTTPS termination |
| `10-api-hpa.yaml` | Horizontal Pod Autoscaler for API |
| `external-secrets/` | External Secrets Operator configuration |
| `deploy.sh` | Automated deployment script |

## 🚀 Quick Start

### 1. Install Prerequisites

```bash
# Install nginx-ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager for automatic HTTPS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

### 2. Configure the Deployment

1. **Update the container registry** in `04-api-deployment.yaml`:
   ```yaml
   image: your-registry.com/modulo-backend:latest
   ```

2. **Update the domain name** in `09-ingress.yaml`:
   ```yaml
   host: your-domain.com
   ```

3. **Build and push your images**:
   ```bash
   # Build backend image
   docker build -t your-registry.com/modulo-backend:latest ./backend
   docker push your-registry.com/modulo-backend:latest
   
   # Build frontend image
   docker build -t your-registry.com/modulo-frontend:latest ./frontend
   docker push your-registry.com/modulo-frontend:latest
   ```

### 3. Deploy

```bash
# Run the automated deployment script
./k8s/deploy.sh

# Or deploy manually step by step:
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-resourcequota.yaml
kubectl apply -f k8s/01.5-postgres-deployment.yaml
# Wait for postgres to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n modulo --timeout=300s
kubectl apply -f k8s/02-api-configmap.yaml
kubectl apply -f k8s/03-api-secret.yaml
kubectl apply -f k8s/04-api-deployment.yaml
kubectl apply -f k8s/05-api-service.yaml
kubectl apply -f k8s/06-frontend-configmap.yaml
kubectl apply -f k8s/07-frontend-deployment.yaml
kubectl apply -f k8s/08-frontend-service.yaml
kubectl apply -f k8s/09-ingress.yaml
kubectl apply -f k8s/10-api-hpa.yaml
```

## 🔧 Configuration

### Environment Variables

The API is configured through ConfigMaps and Secrets:

**ConfigMap (02-api-configmap.yaml):**
- `SPRING_PROFILES_ACTIVE`: kubernetes
- `LOGGING_LEVEL_ROOT`: INFO
- Database platform and JPA settings
- Health check endpoints

**Secret (03-api-secret.yaml):**
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_USERNAME`: Database username
- `DATABASE_PASSWORD`: Database password

### Resource Limits

**API Pods:**
- Requests: 512Mi RAM, 250m CPU
- Limits: 2Gi RAM, 1000m CPU

**PostgreSQL:**
- Requests: 256Mi RAM, 250m CPU
- Limits: 1Gi RAM, 500m CPU
- Storage: 10Gi persistent volume

## 🔍 Monitoring & Health Checks

### Health Endpoints
- **Liveness**: `/actuator/health/liveness`
- **Readiness**: `/actuator/health/readiness`
- **Full Health**: `/actuator/health`

### Scaling
- **Horizontal Pod Autoscaler**: Scales API pods 2-10 based on CPU usage (70% threshold)
- **Manual scaling**: `kubectl scale deployment spring-boot-api --replicas=3 -n modulo`

## 🔐 Security Features

1. **HTTPS/TLS**: Automatic certificate management with cert-manager
2. **Network Policies**: Traffic isolation within namespace
3. **Resource Quotas**: Prevent resource exhaustion
4. **Security Contexts**: Non-root containers
5. **Secrets Management**: Encrypted storage of sensitive data

## 🛠️ Troubleshooting

### Check Deployment Status
```bash
kubectl get all -n modulo
kubectl describe deployment spring-boot-api -n modulo
```

### View Logs
```bash
# API logs
kubectl logs -f deployment/spring-boot-api -n modulo

# Database logs
kubectl logs -f deployment/postgres -n modulo

# Frontend logs
kubectl logs -f deployment/frontend -n modulo
```

### Common Issues

1. **ImagePullBackOff**: Update container registry in deployment files
2. **Database Connection Issues**: Check postgres service and secrets
3. **Ingress Not Working**: Ensure ingress controller is installed
4. **Certificate Issues**: Check cert-manager installation and configuration

### Port Forwarding for Local Testing
```bash
# Access API directly
kubectl port-forward service/api-service 8080:8080 -n modulo

# Access database directly
kubectl port-forward service/postgres-service 5432:5432 -n modulo
```

## 🚀 Production Considerations

1. **Use external managed database** (e.g., Amazon RDS, Google Cloud SQL)
2. **Set up monitoring** with Prometheus and Grafana
3. **Configure log aggregation** with ELK or similar
4. **Implement backup strategies** for persistent data
5. **Use secrets management** (e.g., Vault, AWS Secrets Manager)
6. **Set up CI/CD pipelines** for automated deployments
7. **Configure network policies** for enhanced security

## 📊 Accessing the Application

After successful deployment:

- **API**: `https://your-domain.com/api`
- **Frontend**: `https://your-domain.com`
- **Health Check**: `https://your-domain.com/api/actuator/health`
- **API Documentation**: `https://your-domain.com/api/swagger-ui.html`

## 🔄 Updates and Rollbacks

### Rolling Updates
```bash
# Update API image
kubectl set image deployment/spring-boot-api api-container=your-registry.com/modulo-backend:v2.0 -n modulo

# Check rollout status
kubectl rollout status deployment/spring-boot-api -n modulo
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/spring-boot-api -n modulo

# Rollback to specific revision
kubectl rollout undo deployment/spring-boot-api --to-revision=2 -n modulo
```
