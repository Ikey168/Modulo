# Argo Rollouts - Canary & Blue-Green Deployments

This directory contains Argo Rollouts configurations for implementing advanced deployment strategies with automated canary analysis and rollback capabilities.

## Overview

Argo Rollouts provides Kubernetes-native progressive delivery capabilities including:
- **Canary Deployments**: Gradual traffic shifting with automatic analysis
- **Blue-Green Deployments**: Instant traffic switching with validation
- **Automated Rollbacks**: Metric-based abort conditions
- **Traffic Management**: Integration with ingress controllers

## Structure

```
rollouts/
├── api-rollout.yaml          # Main Rollout configuration for API
├── analysis-templates.yaml   # Prometheus-based analysis templates
├── services.yaml            # Services for traffic routing
├── ingress.yaml             # Canary ingress configuration
├── monitoring.yaml          # ServiceMonitor and alerts
├── experiment.yaml          # Error injection experiment
└── demo.sh                  # Interactive demo script
```

## Deployment Strategies

### Canary Deployment

Progressive traffic shifting with automated analysis:

1. **Traffic Steps**: 10% → 20% → 40% → 60% → 80% → 100%
2. **Analysis Points**: Success rate and latency monitoring
3. **Automatic Abort**: Triggered by high error rate or latency
4. **Manual Control**: Promote or abort at any step

### Blue-Green Deployment

Instant traffic switching with validation:

1. **Parallel Deployment**: New version deployed alongside current
2. **Preview Testing**: Validate new version before traffic switch
3. **Instant Switch**: 100% traffic moved instantly
4. **Quick Rollback**: Immediate return to previous version

## Analysis Templates

### Success Rate Analysis
- **Metric**: HTTP success rate (non-5xx responses)
- **Threshold**: ≥95% success rate required
- **Frequency**: Every 30 seconds
- **Failure Limit**: 3 consecutive failures trigger abort

### Latency Analysis
- **Metric**: 95th percentile response time
- **Threshold**: ≤500ms latency required
- **Frequency**: Every 30 seconds
- **Failure Limit**: 3 consecutive failures trigger abort

## Traffic Routing

### Nginx Ingress Integration
- **Stable Traffic**: Routes to current stable version
- **Canary Traffic**: Routes based on weight or headers
- **Header-Based Routing**: `X-Canary: true` for manual testing
- **Weighted Routing**: Automatic percentage-based distribution

### Service Configuration
- **Active Service**: Points to current stable pods
- **Canary Service**: Points to canary pods during rollout
- **Preview Service**: For blue-green preview testing

## Demo Script

The included `demo.sh` script provides an interactive demonstration:

```bash
./rollouts/demo.sh
```

### Demo Steps:
1. **Setup**: Apply rollout configurations
2. **Initial Deployment**: Show baseline metrics
3. **Canary Start**: Trigger new version deployment
4. **Progress Monitoring**: Watch traffic shifting
5. **Error Injection**: Test automatic abort
6. **Manual Controls**: Demonstrate promote/rollback
7. **Cleanup**: Remove demo resources

## Installation

### Prerequisites
```bash
# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install kubectl plugin
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x ./kubectl-argo-rollouts-linux-amd64
sudo mv ./kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

# Verify installation
kubectl argo rollouts version
```

### Deploy Rollouts
```bash
# Apply all rollout configurations
kubectl apply -f rollouts/

# Enable rollouts in Helm chart
helm upgrade modulo-api ./helm/api -f helm/environments/api-prod.yaml
```

## Usage

### Start Canary Deployment
```bash
# Update image to trigger rollout
kubectl argo rollouts set image modulo-api-rollout modulo-api=moduloapi:v2.0.0 -n modulo

# Watch progress
kubectl argo rollouts get rollout modulo-api-rollout -n modulo -w
```

### Manual Controls
```bash
# Promote canary to next step
kubectl argo rollouts promote modulo-api-rollout -n modulo

# Abort rollout
kubectl argo rollouts abort modulo-api-rollout -n modulo

# Rollback to previous version
kubectl argo rollouts undo modulo-api-rollout -n modulo
```

### Testing Canary Traffic
```bash
# Test stable traffic
curl -H "Host: api.modulo.local" http://localhost/actuator/health

# Test canary traffic
curl -H "Host: api.modulo.local" -H "X-Canary: true" http://localhost/actuator/health
```

## Monitoring

### Rollout Status
```bash
# Get rollout status
kubectl argo rollouts get rollout modulo-api-rollout -n modulo

# List all rollouts
kubectl argo rollouts list rollouts -n modulo

# Get analysis runs
kubectl get analysisruns -n modulo
```

### Metrics Dashboard
Access Grafana dashboard for rollout metrics:
- Success rate trends
- Latency percentiles
- Rollout progression
- Error rate analysis

### Alerts
Prometheus alerts configured for:
- High error rate during rollout
- High latency during rollout
- Stuck rollouts (no progression)

## Integration with GitOps

### Argo CD Integration
The rollouts are managed by Argo CD through:
- `argocd/apps/rollouts.yaml` - Deploys rollout configurations
- Helm chart integration with `rollouts.enabled: true`
- Environment-specific rollout policies

### Git Workflow
1. **Feature Development**: Regular deployment to dev environment
2. **Production Release**: Enable rollouts in prod values
3. **Image Update**: GitOps triggers canary deployment
4. **Automatic Analysis**: Metrics determine success/failure
5. **Manual Approval**: Optional promotion gates

## Security

### RBAC Configuration
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: rollouts-operator
rules:
- apiGroups: ["argoproj.io"]
  resources: ["rollouts", "analysisruns"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

### Network Policies
Ensure proper network isolation:
- Canary pods can reach stable services
- Analysis pods can access Prometheus
- Ingress controller can route traffic

## Troubleshooting

### Common Issues

1. **Analysis Failures**
   ```bash
   # Check analysis runs
   kubectl get analysisruns -n modulo
   kubectl describe analysisrun <name> -n modulo
   ```

2. **Traffic Routing Issues**
   ```bash
   # Check ingress annotations
   kubectl get ingress modulo-api-canary -n modulo -o yaml
   ```

3. **Prometheus Connectivity**
   ```bash
   # Test Prometheus access
   kubectl exec -n modulo deployment/modulo-api -- curl http://prometheus-server.monitoring.svc.cluster.local:80/api/v1/query?query=up
   ```

### Debug Commands
```bash
# Get rollout logs
kubectl logs -l app.kubernetes.io/name=argo-rollouts -n argo-rollouts

# Describe rollout for events
kubectl describe rollout modulo-api-rollout -n modulo

# Check pod status
kubectl get pods -l app=modulo-api -n modulo
```

## Best Practices

### Analysis Configuration
- Set appropriate thresholds based on SLAs
- Use multiple metrics for comprehensive analysis
- Configure reasonable failure limits
- Monitor analysis template effectiveness

### Traffic Management
- Start with small traffic percentages
- Use pause steps for observation
- Implement header-based testing
- Monitor ingress controller performance

### Rollback Strategy
- Always test rollback procedures
- Monitor rollback metrics
- Have manual abort procedures
- Document rollback playbooks

## Contributing

### Adding New Analysis Templates
1. Create template in `analysis-templates.yaml`
2. Reference in rollout configuration
3. Test with experiment before production
4. Update documentation

### Modifying Traffic Steps
1. Update steps in rollout configuration
2. Adjust analysis starting points
3. Test progression timing
4. Validate abort conditions
