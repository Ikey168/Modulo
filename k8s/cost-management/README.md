# Cost Management and Budget Monitoring

This directory contains cost management configurations for the Modulo application, including resource tagging, budget alerts, and cost monitoring dashboards.

## Overview

The cost management solution provides:
- **Resource Tagging**: Automated tagging for cost allocation by environment and service
- **Budget Monitoring**: Monthly budget alerts and anomaly detection
- **Cost Dashboards**: Grafana dashboards for cost visualization by environment/service
- **Automated Reporting**: Monthly cost reports with top cost drivers identification

## Components

### 1. Resource Tagging (`00-resource-tagging.yaml`)
- Kubernetes resource labels for cost allocation
- Environment-based tagging (dev, staging, production)
- Service-based tagging (backend, frontend, database)
- Cost center and project tagging

### 2. Azure Cost Management Integration (`01-cost-management-api.yaml`)
- Azure Cost Management API service account
- Billing API access configuration
- Cost data collection and export

### 3. Budget Configuration (`02-budget-alerts.yaml`)
- Monthly budget thresholds by environment
- Anomaly detection alerts
- Cost spike notifications
- Multi-level alerting (warning, critical)

### 4. Cost Monitoring (`03-cost-monitoring.yaml`)
- FinOps monitoring service
- Cost metrics collection
- Data processing and aggregation
- Export to Prometheus metrics

### 5. Reporting (`04-cost-reporting.yaml`)
- Automated monthly reports
- Top cost drivers analysis
- Cost optimization recommendations
- Email and Slack notifications

## Installation

1. **Apply Resource Tagging**:
   ```bash
   kubectl apply -f k8s/cost-management/00-resource-tagging.yaml
   ```

2. **Setup Azure Cost Management**:
   ```bash
   kubectl apply -f k8s/cost-management/01-cost-management-api.yaml
   ```

3. **Configure Budget Alerts**:
   ```bash
   kubectl apply -f k8s/cost-management/02-budget-alerts.yaml
   ```

4. **Deploy Cost Monitoring**:
   ```bash
   kubectl apply -f k8s/cost-management/03-cost-monitoring.yaml
   ```

5. **Setup Reporting**:
   ```bash
   kubectl apply -f k8s/cost-management/04-cost-reporting.yaml
   ```

## Budget Thresholds

### Development Environment
- **Monthly Budget**: $500
- **Warning Alert**: 80% ($400)
- **Critical Alert**: 95% ($475)

### Staging Environment  
- **Monthly Budget**: $1,000
- **Warning Alert**: 80% ($800)
- **Critical Alert**: 95% ($950)

### Production Environment
- **Monthly Budget**: $5,000
- **Warning Alert**: 80% ($4,000)
- **Critical Alert**: 95% ($4,750)

## Dashboard Access

Access cost dashboards through Grafana:
```bash
kubectl port-forward service/grafana 3000:3000 -n observability
# Open http://localhost:3000/dashboards
```

Available dashboards:
- **Cost Overview**: High-level cost metrics across all environments
- **Environment Costs**: Detailed breakdown by dev/staging/production
- **Service Costs**: Cost analysis by backend/frontend/database services
- **Resource Utilization**: Cost efficiency and optimization opportunities

## Monitoring Alerts

### Budget Alerts
- **80% Budget**: Warning notification to team leads
- **95% Budget**: Critical alert to management and finance
- **100% Budget**: Emergency alert with automatic scaling restrictions

### Anomaly Alerts
- **Daily Cost Spike**: > 150% of weekly average
- **Weekly Trend**: > 120% of monthly average
- **Resource Anomaly**: New resource types or unexpected scaling

## Cost Optimization

### Automated Actions
- **Scaling Recommendations**: Based on usage patterns
- **Resource Right-sizing**: CPU/memory optimization suggestions
- **Idle Resource Detection**: Unused resources identification
- **Reserved Instance Recommendations**: Long-term cost savings

### Manual Reviews
- **Monthly Cost Review**: Top cost drivers analysis
- **Quarterly Optimization**: Architecture and scaling review
- **Annual Planning**: Budget forecasting and capacity planning

## Troubleshooting

### Common Issues

#### Missing Cost Data
```bash
# Check API connectivity
kubectl logs -l app=cost-management -n cost-management

# Verify Azure permissions
kubectl describe secret azure-cost-api-secret -n cost-management

# Test API connection
kubectl exec -it deployment/cost-management -n cost-management -- curl -H "Authorization: Bearer $AZURE_TOKEN" "https://management.azure.com/subscriptions/$SUBSCRIPTION_ID/providers/Microsoft.CostManagement/query"
```

#### Budget Alert Not Triggering
```bash
# Check budget configuration
kubectl get budgets -n cost-management -o yaml

# Verify alertmanager rules
kubectl get prometheusrules -n cost-management

# Test alert rules
kubectl exec -it deployment/prometheus -n observability -- promtool query instant "cost_budget_usage_percent > 80"
```

#### Dashboard Data Issues
```bash
# Check Prometheus metrics
kubectl exec -it deployment/prometheus -n observability -- promtool query instant "azure_cost_total"

# Verify Grafana datasource
kubectl logs -l app=grafana -n observability

# Restart cost collection
kubectl rollout restart deployment/cost-management -n cost-management
```

## Security

### Azure Permissions
- Read-only access to Cost Management API
- Subscription-level billing reader role
- Resource group cost data access

### Kubernetes RBAC
- Namespace-isolated service accounts
- Minimal required permissions
- Secret management for API keys

### Data Privacy
- Cost data encryption at rest
- Secure API key storage
- Audit logging for cost data access

## Integration

### Existing Systems
- **Prometheus**: Cost metrics collection
- **Grafana**: Cost visualization dashboards
- **AlertManager**: Budget and anomaly alerts
- **Azure Monitor**: Native Azure cost integration

### External Services
- **Slack**: Alert notifications
- **Email**: Monthly reports and alerts
- **Jira**: Cost optimization tickets
- **Excel**: Financial reporting integration

## References

- [Azure Cost Management API](https://docs.microsoft.com/en-us/rest/api/cost-management/)
- [Kubernetes Resource Quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [FinOps Foundation](https://www.finops.org/)
- [Cloud Cost Optimization](https://azure.microsoft.com/en-us/solutions/cost-optimization/)
