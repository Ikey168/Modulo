# Modulo GitOps with Helm & Argo CD

This directory contains Helm charts and Argo CD configurations for GitOps deployment of the Modulo application.

## Structure

```
helm/
├── api/                    # API service Helm chart
├── web/                    # Web frontend Helm chart  
├── worker/                 # Background worker Helm chart
└── environments/           # Environment-specific values
    ├── api-dev.yaml
    ├── api-prod.yaml
    ├── web-dev.yaml
    └── web-prod.yaml

argocd/
├── app-of-apps.yaml       # Root app-of-apps application
└── apps/                  # Individual application manifests
    ├── api.yaml
    ├── web.yaml
    ├── worker.yaml
    ├── dev.yaml           # Development environment apps
    └── prod.yaml          # Production environment apps
```

## Helm Charts

### API Service (`helm/api/`)
- Spring Boot REST API
- PostgreSQL database connection
- Health checks and metrics
- Auto-scaling configuration
- Ingress with TLS

### Web Frontend (`helm/web/`)
- React/Vite static frontend
- Nginx serving
- Environment-specific API URLs
- CDN-ready configuration

### Worker Service (`helm/worker/`)
- Background job processing
- Message queue integration
- Health monitoring

## Environment Configuration

### Development
- Reduced resource requests
- Debug logging enabled
- Single replica (cost optimization)
- Auto-scaling disabled
- Dev hostnames (`*-dev.modulo.local`)

### Production
- High availability (3+ replicas)
- Auto-scaling enabled
- Production hostnames
- Resource limits enforced
- Manual sync for safety

## Argo CD GitOps

### App-of-Apps Pattern
The root `app-of-apps.yaml` manages all child applications, providing:
- Centralized application lifecycle
- Consistent sync policies
- Drift detection
- Auto-remediation

### Sync Policies
- **Development**: Automated sync with prune and self-heal
- **Production**: Automated self-heal, manual prune approval
- **Drift Detection**: Continuous monitoring of cluster vs Git state

### Branch Strategy
- `develop` branch → Development environment
- `main` branch → Production environment
- Feature branches → Manual deployment

## Deployment Workflow

### 1. Local Development
```bash
# Test Helm charts locally
helm template helm/api/ -f helm/environments/api-dev.yaml
helm lint helm/api/
```

### 2. Development Deployment
```bash
# Push to develop branch
git checkout develop
git merge feature/your-feature
git push origin develop
# Argo CD automatically syncs to dev environment
```

### 3. Production Deployment
```bash
# Create PR to main
gh pr create --base main --title "Release v1.x.x"
# After PR approval and merge, Argo CD syncs to production
```

### 4. Monitoring & Rollback
```bash
# Check Argo CD application status
argocd app get modulo-api-prod
argocd app sync modulo-api-prod
argocd app rollback modulo-api-prod
```

## Installation

### 1. Install Argo CD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 2. Deploy App-of-Apps
```bash
kubectl apply -f argocd/app-of-apps.yaml
```

### 3. Access Argo CD UI
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Login with admin/password from secret
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Security

### Image Security
- Non-root containers
- Read-only root filesystem
- Security contexts enforced
- Minimal base images

### Network Security
- Network policies (implement in k8s/)
- TLS termination at ingress
- Service mesh ready

### RBAC
- Dedicated service accounts
- Minimal required permissions
- Namespace isolation

## Monitoring

### Application Metrics
- Prometheus metrics exposed
- Health check endpoints
- Custom application metrics

### GitOps Metrics
- Argo CD metrics
- Sync success/failure rates
- Drift detection alerts

## Troubleshooting

### Common Issues
1. **Sync Failures**: Check application logs in Argo CD UI
2. **Image Pull Errors**: Verify image tags and registry access
3. **Resource Limits**: Check pod resource requests vs cluster capacity

### Debug Commands
```bash
# Check application status
kubectl get applications -n argocd

# View application details
argocd app get modulo-api-prod

# Manual sync
argocd app sync modulo-api-prod --prune

# Rollback
argocd app rollback modulo-api-prod 12345
```

## Contributing

### Adding New Services
1. Create new Helm chart in `helm/`
2. Add environment-specific values
3. Create Argo CD application manifest
4. Update app-of-apps if needed

### Modifying Existing Services
1. Update Helm templates or values
2. Test locally with `helm template`
3. Commit changes to appropriate branch
4. Monitor Argo CD sync status

### Environment Changes
1. Update environment-specific values files
2. Argo CD will detect changes and sync automatically
3. Verify deployment in target environment
