# External Secrets Operator Configuration

This directory contains all Kubernetes manifests and configurations for External Secrets Operator (ESO) integration with Azure Key Vault.

## 📁 File Structure

```
external-secrets/
├── 00-namespace.yaml                 # External Secrets namespace
├── 01-external-secrets-operator.yaml # Helm deployment (Flux-based)
├── 02-secret-stores.yaml            # SecretStore configurations
├── 03-rbac.yaml                     # RBAC and service accounts
└── 04-external-secrets.yaml         # ExternalSecret resources
```

## 🚀 Quick Deployment

### Prerequisites

- Kubernetes cluster with Helm installed
- Azure Key Vault with appropriate secrets
- Service principal with Key Vault access

### Deployment Steps

1. **Deploy the operator:**
   ```bash
   kubectl apply -f 00-namespace.yaml
   kubectl apply -f 01-external-secrets-operator.yaml
   ```

2. **Configure RBAC:**
   ```bash
   kubectl apply -f 03-rbac.yaml
   ```

3. **Set up Azure credentials:**
   ```bash
   kubectl create secret generic azure-keyvault-creds \
     --namespace=modulo \
     --from-literal=client-id="YOUR_CLIENT_ID" \
     --from-literal=client-secret="YOUR_CLIENT_SECRET"
   ```

4. **Deploy SecretStores:**
   ```bash
   kubectl apply -f 02-secret-stores.yaml
   ```

5. **Deploy ExternalSecrets:**
   ```bash
   kubectl apply -f 04-external-secrets.yaml
   ```

## 📋 Configuration Details

### 00-namespace.yaml

Creates the dedicated namespace for External Secrets Operator:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: external-secrets-system
```

### 01-external-secrets-operator.yaml

Flux-based Helm deployment with security-focused configuration:

- **Security Context**: Non-root user, read-only filesystem
- **Resource Limits**: CPU (100m) and memory (128Mi) limits
- **Monitoring**: Service monitor enabled for Prometheus
- **Webhook**: Admission controller for validation

### 02-secret-stores.yaml

Defines how to connect to Azure Key Vault:

- **Azure Key Vault Store**: Primary production secret source
- **Kubernetes Store**: Backup/development option
- **Cluster Store**: Organization-wide shared secrets

Key configuration parameters:
- `vaultUrl`: Azure Key Vault endpoint
- `tenantId`: Azure AD tenant identifier
- `authSecretRef`: Service principal credentials

### 03-rbac.yaml

RBAC configuration for secure access:

- **Service Account**: `external-secrets-sa` for ESO operations
- **ClusterRole**: Minimal permissions for secret operations
- **Azure Credentials**: Service principal authentication secret

### 04-external-secrets.yaml

Maps Azure Key Vault secrets to Kubernetes secrets:

| ExternalSecret | Target Secret | Purpose |
|----------------|---------------|---------|
| `api-database-secret` | `api-secret` | Database credentials |
| `app-insights-external-secret` | `app-insights-secret` | Monitoring configuration |
| `acr-external-secret` | `acr-secret` | Container registry auth |
| `api-application-secret` | `api-application-secret` | JWT/API keys |

## 🔄 Secret Refresh Configuration

| Secret Category | Refresh Interval | Justification |
|-----------------|------------------|---------------|
| Database | 5 minutes | Critical for application availability |
| Application | 10 minutes | Balance between security and performance |
| Monitoring | 15 minutes | Less critical, can tolerate longer delays |
| Registry | 30 minutes | Infrequent updates, stable credentials |

## 🛠️ Maintenance

### Monitoring ESO Health

```bash
# Check operator status
kubectl get pods -n external-secrets-system

# Verify secret synchronization
kubectl get externalsecrets -n modulo

# Check secret status
kubectl describe externalsecret api-database-secret -n modulo
```

### Troubleshooting

1. **ExternalSecret not syncing:**
   ```bash
   kubectl describe externalsecret <name> -n modulo
   kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets
   ```

2. **Azure authentication issues:**
   ```bash
   kubectl get secret azure-keyvault-creds -n modulo -o yaml
   az keyvault secret list --vault-name modulo-keyvault
   ```

3. **Secret not updating in pods:**
   ```bash
   kubectl get secret <secret-name> -n modulo -o yaml
   kubectl rollout restart deployment/<deployment-name> -n modulo
   ```

### Updating Configurations

1. **Change refresh intervals:**
   ```bash
   kubectl patch externalsecret api-database-secret -n modulo \
     --type='merge' -p='{"spec":{"refreshInterval":"2m"}}'
   ```

2. **Update Key Vault URL:**
   ```bash
   kubectl patch secretstore azure-keyvault-store -n modulo \
     --type='merge' -p='{"spec":{"provider":{"azurekv":{"vaultUrl":"https://new-vault.vault.azure.net/"}}}}'
   ```

## 🔐 Security Considerations

### Azure Key Vault

- Use **dedicated service principal** with minimal permissions
- Enable **audit logging** for all Key Vault operations
- Configure **network access restrictions** if possible
- Implement **secret versioning** and rotation policies

### Kubernetes

- **Namespace isolation**: ESO runs in dedicated namespace
- **RBAC least privilege**: Minimal required permissions
- **Secret encryption**: Enable encryption at rest for etcd
- **Network policies**: Restrict pod-to-pod communication

### Operational

- **Regular rotation**: Automate secret rotation schedules
- **Access reviews**: Periodic review of Key Vault access
- **Monitoring**: Alert on sync failures and authentication errors
- **Backup**: Regular backup of Key Vault contents

## 📊 Performance Tuning

### High-Volume Environments

For environments with many secrets or frequent updates:

1. **Increase operator replicas:**
   ```yaml
   spec:
     values:
       replicaCount: 2
   ```

2. **Optimize refresh intervals:**
   - Critical secrets: 1-5 minutes
   - Standard secrets: 5-15 minutes
   - Static secrets: 30-60 minutes

3. **Use ClusterSecretStore:**
   ```yaml
   apiVersion: external-secrets.io/v1beta1
   kind: ClusterSecretStore
   # Shared across namespaces
   ```

### Resource Scaling

Monitor and adjust based on usage:

```yaml
resources:
  requests:
    cpu: 10m      # Start small
    memory: 32Mi
  limits:
    cpu: 200m     # Scale up if needed
    memory: 256Mi
```

## 🧪 Testing

### Validation Scripts

```bash
# Test Key Vault connectivity
az keyvault secret show --vault-name modulo-keyvault --name modulo-jwt-secret

# Verify ESO sync
kubectl get externalsecrets -n modulo --watch

# Test secret rotation
./scripts/rotate-secrets.sh jwt
```

### Health Checks

```bash
# ESO operator health
kubectl get deployment external-secrets -n external-secrets-system

# Secret synchronization health
kubectl get externalsecrets -n modulo -o custom-columns=NAME:.metadata.name,READY:.status.conditions[?(@.type=='Ready')].status

# Application secret consumption
kubectl exec -n modulo deployment/spring-boot-api -- printenv | grep -E "(DATABASE|JWT|API)"
```

## 📚 References

- [External Secrets Operator Documentation](https://external-secrets.io/)
- [Azure Key Vault Provider](https://external-secrets.io/v0.9.11/provider/azure-key-vault/)
- [Kubernetes Secret Management Best Practices](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Azure Key Vault Security Guide](https://docs.microsoft.com/en-us/azure/key-vault/general/security-overview)
