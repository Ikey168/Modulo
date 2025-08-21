# External Secrets Operator Implementation

This document provides a comprehensive guide to implementing External Secrets Operator with Azure Key Vault for the Modulo application, enabling zero-downtime secret rotation and eliminating plaintext secrets from Git.

## 🎯 Overview

External Secrets Operator (ESO) is a Kubernetes operator that integrates external secret management systems like Azure Key Vault, AWS Secrets Manager, or HashiCorp Vault with Kubernetes. It automatically fetches secrets from external sources and creates Kubernetes secrets, enabling:

- **Zero-downtime secret rotation** without application redeployment
- **No plaintext secrets in Git** repositories
- **Centralized secret management** across environments
- **Automatic secret synchronization** and refresh

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Azure Key     │    │   External      │    │   Kubernetes    │
│     Vault       │◄───┤   Secrets       ├───►│    Secrets      │
│                 │    │   Operator      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │               ┌─────────────────┐
                                │               │   Application   │
                                │               │      Pods       │
                                │               │                 │
                                │               └─────────────────┘
                                ▼
                       ┌─────────────────┐
                       │   SecretStore   │
                       │ Configuration   │
                       └─────────────────┘
```

## 📁 File Structure

```
k8s/external-secrets/
├── 00-namespace.yaml              # External Secrets namespace
├── 01-external-secrets-operator.yaml  # Helm deployment (Flux)
├── 02-secret-stores.yaml         # SecretStore configurations
├── 03-rbac.yaml                  # RBAC and service accounts
└── 04-external-secrets.yaml      # ExternalSecret resources

scripts/
├── deploy-external-secrets.sh    # Deployment automation
├── setup-azure-keyvault.sh      # Azure Key Vault setup
└── rotate-secrets.sh             # Secret rotation playbooks
```

## 🚀 Quick Start

### 1. Azure Key Vault Setup

```bash
# Set up Azure Key Vault and populate with secrets
./scripts/setup-azure-keyvault.sh

# This will:
# - Create Azure Key Vault
# - Create service principal for access
# - Populate all required secrets
# - Configure Kubernetes authentication
```

### 2. Deploy External Secrets Operator

```bash
# Deploy the operator and all configurations
./scripts/deploy-external-secrets.sh

# This will:
# - Install External Secrets Operator via Helm
# - Configure RBAC
# - Deploy SecretStores
# - Create ExternalSecret resources
```

### 3. Verify Deployment

```bash
# Check operator status
kubectl get pods -n external-secrets-system

# Check ExternalSecrets
kubectl get externalsecrets -n modulo

# Check generated secrets
kubectl get secrets -n modulo -l app.kubernetes.io/managed-by=external-secrets
```

## 🔧 Configuration Details

### SecretStore Configuration

The `SecretStore` defines how to connect to Azure Key Vault:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-keyvault-store
  namespace: modulo
spec:
  provider:
    azurekv:
      vaultUrl: "https://modulo-keyvault.vault.azure.net/"
      authSecretRef:
        clientId:
          name: azure-keyvault-creds
          key: client-id
        clientSecret:
          name: azure-keyvault-creds
          key: client-secret
      tenantId: "YOUR_TENANT_ID"
```

### ExternalSecret Configuration

ExternalSecret resources define how to map Key Vault secrets to Kubernetes secrets:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-database-secret
  namespace: modulo
spec:
  refreshInterval: 5m  # Refresh every 5 minutes
  secretStoreRef:
    name: azure-keyvault-store
    kind: SecretStore
  target:
    name: api-secret
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_PASSWORD
    remoteRef:
      key: modulo-database-password
```

## 🔄 Secret Rotation

### Automatic Rotation

External Secrets Operator automatically refreshes secrets based on the `refreshInterval` configuration:

- **Database secrets**: 5 minutes
- **Application secrets**: 10 minutes
- **Monitoring secrets**: 15 minutes
- **Registry secrets**: 30 minutes

### Manual Rotation

Use the rotation playbook for immediate rotation:

```bash
# Interactive rotation menu
./scripts/rotate-secrets.sh

# Or specific secret types
./scripts/rotate-secrets.sh jwt
./scripts/rotate-secrets.sh api-key
./scripts/rotate-secrets.sh database
```

### Rotation Process

1. **Update Key Vault**: New secret value is stored in Azure Key Vault
2. **ESO Sync**: External Secrets Operator detects the change
3. **Kubernetes Secret Update**: The Kubernetes secret is updated automatically
4. **Application Refresh**: Applications pick up new values (no restart required)

## 🔒 Secret Mapping

| Purpose | Key Vault Secret | Kubernetes Secret | Environment Variable |
|---------|------------------|-------------------|---------------------|
| Database Host | `modulo-database-host` | `api-secret` | `DATABASE_URL` |
| Database Password | `modulo-database-password` | `api-secret` | `SPRING_DATASOURCE_PASSWORD` |
| JWT Secret | `modulo-jwt-secret` | `api-application-secret` | `JWT_SECRET` |
| API Key | `modulo-api-key` | `api-application-secret` | `API_KEY` |
| App Insights | `modulo-app-insights-connection-string` | `app-insights-secret` | `CONNECTION_STRING` |
| ACR Password | `modulo-acr-password` | `acr-secret` | `.dockerconfigjson` |

## 🛠️ Maintenance

### Monitoring

Monitor External Secrets health:

```bash
# Check ExternalSecret status
kubectl get externalsecrets -n modulo -o wide

# Check last sync time
kubectl describe externalsecret api-database-secret -n modulo

# Check operator logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets
```

### Troubleshooting

Common issues and solutions:

1. **ExternalSecret not syncing**
   ```bash
   # Check SecretStore connectivity
   kubectl describe secretstore azure-keyvault-store -n modulo
   
   # Check service principal permissions
   az keyvault secret show --vault-name modulo-keyvault --name modulo-jwt-secret
   ```

2. **Authentication errors**
   ```bash
   # Verify Azure credentials
   kubectl get secret azure-keyvault-creds -n modulo -o yaml
   
   # Test Key Vault access
   az keyvault secret list --vault-name modulo-keyvault
   ```

3. **Secret not updating in pods**
   ```bash
   # Check refresh interval
   kubectl get externalsecret api-database-secret -n modulo -o yaml
   
   # Force refresh
   kubectl annotate externalsecret api-database-secret -n modulo force-sync="$(date)"
   ```

### Backup and Recovery

1. **Key Vault Backup**
   ```bash
   # Backup all secrets
   az keyvault secret list --vault-name modulo-keyvault --query '[].name' -o tsv | \
   while read secret; do
       az keyvault secret backup --vault-name modulo-keyvault --name "$secret" \
           --file "${secret}.backup"
   done
   ```

2. **Configuration Backup**
   ```bash
   # Export all External Secrets configurations
   kubectl get externalsecrets,secretstores -n modulo -o yaml > external-secrets-backup.yaml
   ```

## 🔐 Security Best Practices

### Azure Key Vault

1. **Access Policies**: Use least-privilege access for service principals
2. **Network Security**: Configure Key Vault firewall rules
3. **Audit Logging**: Enable Key Vault audit logs
4. **Backup**: Regular backup of Key Vault contents

### Kubernetes

1. **RBAC**: Restrict External Secrets service account permissions
2. **Network Policies**: Limit pod-to-pod communication
3. **Pod Security**: Use security contexts and read-only root filesystems
4. **Secret Encryption**: Enable encryption at rest for etcd

### Operational

1. **Secret Rotation**: Regular rotation schedule (30-90 days)
2. **Access Review**: Regular review of Key Vault access
3. **Monitoring**: Alert on secret sync failures
4. **Testing**: Regular testing of rotation procedures

## 📊 Performance Considerations

### Refresh Intervals

Balance between security and performance:

- **Critical secrets** (database, JWT): 5-10 minutes
- **Application secrets**: 10-15 minutes
- **Infrastructure secrets**: 15-30 minutes
- **Monitoring secrets**: 30-60 minutes

### Resource Limits

External Secrets Operator resource requirements:

```yaml
resources:
  requests:
    cpu: 10m
    memory: 32Mi
  limits:
    cpu: 100m
    memory: 128Mi
```

### Scaling

For high-volume environments:

- Increase operator replicas
- Use ClusterSecretStore for shared secrets
- Implement caching strategies
- Monitor Key Vault throttling limits

## 🧪 Testing

### Unit Testing

```bash
# Test Key Vault connectivity
az keyvault secret show --vault-name modulo-keyvault --name modulo-jwt-secret

# Test External Secrets sync
kubectl get externalsecrets -n modulo --watch
```

### Integration Testing

```bash
# Test full rotation workflow
./scripts/rotate-secrets.sh jwt

# Verify application functionality
kubectl exec -n modulo deployment/spring-boot-api -- curl -f http://localhost:8080/api/actuator/health
```

### Load Testing

```bash
# Test multiple secret rotations
for secret in jwt api-key encryption-key; do
    ./scripts/rotate-secrets.sh "$secret"
    sleep 60
done
```

## 📋 Checklist

### Initial Setup
- [ ] Azure Key Vault created and configured
- [ ] Service principal created with appropriate permissions
- [ ] External Secrets Operator deployed
- [ ] SecretStores configured and tested
- [ ] ExternalSecrets created and syncing
- [ ] Application deployments updated to use new secrets

### Security Review
- [ ] All plaintext secrets removed from Git
- [ ] Service principal permissions minimized
- [ ] Key Vault access policies reviewed
- [ ] Network security configured
- [ ] Audit logging enabled

### Operational Readiness
- [ ] Monitoring and alerting configured
- [ ] Backup procedures established
- [ ] Rotation playbooks tested
- [ ] Documentation updated
- [ ] Team training completed

## 🔗 References

- [External Secrets Operator Documentation](https://external-secrets.io/)
- [Azure Key Vault Provider](https://external-secrets.io/v0.9.11/provider/azure-key-vault/)
- [Kubernetes Secrets Best Practices](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Azure Key Vault Security](https://docs.microsoft.com/en-us/azure/key-vault/general/security-overview)

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review External Secrets Operator logs
3. Consult Azure Key Vault audit logs
4. Create an issue in the project repository
