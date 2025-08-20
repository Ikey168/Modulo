# Container Image Signing Policies

This directory contains Kyverno policies for enforcing container image signature verification in Kubernetes clusters.

## Policies Overview

### 1. verify-image-signatures.yaml
**Purpose**: Core policy for verifying container image signatures using Cosign

**Features**:
- Verifies signatures using keyless Cosign with OIDC
- Validates against GitHub Actions OIDC issuer
- Supports certificate identity verification
- Generates policy violations for unsigned images

**Scope**: Applied to all namespaces except system namespaces

### 2. require-signed-images.yaml
**Purpose**: Enforces that all container images must be signed

**Features**:
- Blocks deployment of unsigned images
- Validates image signatures before pod creation
- Provides detailed error messages for violations
- Supports emergency bypass annotations

**Scope**: Applied to production namespaces

### 3. audit-unsigned-images.yaml
**Purpose**: Monitors and reports unsigned image usage

**Features**:
- Audits unsigned image deployments
- Generates detailed reports
- Tracks signature verification attempts
- Provides compliance reporting

**Scope**: Cluster-wide monitoring

## Policy Configuration

### Certificate Identity Patterns
The policies are configured to trust signatures from:
- GitHub Actions workflows in the Ikey168/Modulo repository
- Specific workflow paths: `.github/workflows/docker-build.yml`
- OIDC issuer: `https://token.actions.githubusercontent.com`

### Namespace Targeting
- **System namespaces**: Excluded (kube-system, kyverno, etc.)
- **Application namespaces**: Full enforcement
- **Development namespaces**: Audit mode only

## Installation

### Prerequisites
1. Kubernetes cluster (v1.24+)
2. Kyverno installed (v1.10.0+)
3. kubectl access to the cluster

### Quick Installation
```bash
# Install all policies
kubectl apply -f k8s/policies/

# Verify installation
kubectl get clusterpolicies
```

### Advanced Installation
```bash
# Install Kyverno first (if not already installed)
kubectl apply -f https://github.com/kyverno/kyverno/releases/download/v1.10.0/install.yaml

# Wait for Kyverno to be ready
kubectl wait --for=condition=available --timeout=300s deployment/kyverno-admission-controller -n kyverno

# Apply policies
kubectl apply -f k8s/policies/

# Check policy status
kubectl describe clusterpolicy verify-image-signatures
```

## Policy Modes

### 1. Audit Mode (Default)
- Policies generate reports but don't block deployments
- Useful for initial assessment and testing
- Recommended for development environments

```yaml
spec:
  validationFailureAction: audit
```

### 2. Enforce Mode
- Policies block non-compliant deployments
- Recommended for production environments
- Requires signed images for all deployments

```yaml
spec:
  validationFailureAction: enforce
```

## Testing Policies

### Test Unsigned Image (Should Generate Violation)
```bash
kubectl run test-unsigned --image=nginx:latest
kubectl get policyreports
```

### Test Signed Image (Should Pass)
```bash
kubectl run test-signed --image=ghcr.io/ikey168/modulo-frontend:latest
kubectl get policyreports
```

### View Policy Violations
```bash
# Get all policy reports
kubectl get policyreports -A

# View specific violations
kubectl describe policyreport <report-name> -n <namespace>

# Check Kyverno logs
kubectl logs -n kyverno -l app.kubernetes.io/name=kyverno
```

## Emergency Procedures

### Bypass Image Verification
For emergency deployments, add the bypass annotation:

```yaml
metadata:
  annotations:
    policies.kyverno.io/skip: "verify-image-signatures"
```

⚠️ **Warning**: This should only be used in emergency situations and requires proper approval process.

### Temporary Policy Disable
```bash
# Disable specific policy
kubectl patch clusterpolicy verify-image-signatures -p '{"spec":{"background":false}}'

# Re-enable policy
kubectl patch clusterpolicy verify-image-signatures -p '{"spec":{"background":true}}'
```

## Monitoring and Alerting

### Policy Reports
```bash
# Get summary of all violations
kubectl get policyreports -A -o custom-columns=NAMESPACE:.metadata.namespace,POLICY:.metadata.labels['app\.kubernetes\.io/managed-by'],PASS:.summary.pass,FAIL:.summary.fail

# Get detailed violation information
kubectl get policyreports -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.summary.fail}{"\n"}{end}'
```

### Prometheus Metrics
Kyverno exposes metrics that can be used for monitoring:
- `kyverno_policy_execution_duration_seconds`
- `kyverno_policy_results_total`
- `kyverno_admission_requests_total`

### Example AlertManager Rules
```yaml
groups:
- name: kyverno-image-signing
  rules:
  - alert: UnsignedImageDeployed
    expr: increase(kyverno_policy_results_total{policy_type="ClusterPolicy",policy_name="verify-image-signatures",rule_result="fail"}[5m]) > 0
    labels:
      severity: warning
    annotations:
      summary: "Unsigned container image deployed"
      description: "An unsigned container image was deployed in namespace {{ $labels.resource_namespace }}"
```

## Customization

### Adding New Registries
To add support for additional container registries:

```yaml
spec:
  rules:
  - name: verify-signatures
    match:
      any:
      - resources:
          kinds:
          - Pod
    verifyImages:
    - imageReferences:
      - "your-registry.com/*"
      - "ghcr.io/ikey168/modulo-*"
```

### Custom Certificate Authorities
For private PKI or custom CAs:

```yaml
verifyImages:
- imageReferences:
  - "private-registry.com/*"
  attestors:
  - entries:
    - certificates:
        cert: |-
          -----BEGIN CERTIFICATE-----
          ... your CA certificate ...
          -----END CERTIFICATE-----
```

### Organization-Specific Policies
Create organization-specific variations:

```yaml
metadata:
  name: verify-company-images
spec:
  rules:
  - match:
      any:
      - resources:
          kinds:
          - Pod
          namespaces:
          - production
    verifyImages:
    - imageReferences:
      - "company-registry.com/*"
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/company/repo/.github/workflows/build.yml@*"
            issuer: "https://token.actions.githubusercontent.com"
```

## Troubleshooting

### Common Issues

#### 1. Policy Not Working
```bash
# Check Kyverno is running
kubectl get pods -n kyverno

# Check policy status
kubectl describe clusterpolicy verify-image-signatures

# Check Kyverno logs
kubectl logs -n kyverno -l app.kubernetes.io/name=kyverno
```

#### 2. Image Verification Failures
```bash
# Test image signature manually
cosign verify --certificate-identity-regexp=".*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/ikey168/modulo-frontend:latest

# Check if image has signatures
cosign triangulate ghcr.io/ikey168/modulo-frontend:latest
```

#### 3. Policy Reports Not Generated
```bash
# Check if policy reports CRD exists
kubectl get crd policyreports.wgpolicyk8s.io

# Check Kyverno reports controller
kubectl logs -n kyverno -l app.kubernetes.io/component=reports-controller
```

## Migration Guide

### From No Verification to Audit Mode
1. Apply policies in audit mode
2. Monitor for violations
3. Fix unsigned images
4. Switch to enforce mode

### From Basic to Advanced Verification
1. Update policies with additional attestors
2. Add certificate chain validation
3. Implement custom key management
4. Add compliance reporting

## References

- [Kyverno Documentation](https://kyverno.io/docs/)
- [Cosign Documentation](https://docs.sigstore.dev/cosign/)
- [Policy as Code Best Practices](https://kyverno.io/docs/writing-policies/)
- [Container Image Security](https://cloud.google.com/docs/security/binary-authorization)

---

**Last Updated**: August 20, 2025
**Policy Version**: 1.0
**Kyverno Version**: 1.10.0+
