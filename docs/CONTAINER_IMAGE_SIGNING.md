# Container Image Signing with Cosign

This document describes the implementation of container image signing using Cosign and policy enforcement using Kyverno in the Modulo project.

## Overview

Container image signing provides cryptographic verification that images haven't been tampered with and come from trusted sources. This implementation uses:

- **Cosign**: For signing container images with keyless signing
- **Kyverno**: For enforcing signature verification policies in Kubernetes
- **Sigstore**: For transparency log and certificate authority

## Implementation Details

### 1. Image Signing in CI/CD

#### Docker Build Workflow Updates

The `.github/workflows/docker-build.yml` workflow has been enhanced to:

1. **Build and push container images** to `ghcr.io/ikey168/modulo/`
2. **Sign images with Cosign** using keyless signing (OIDC)
3. **Generate and attach SBOMs** (Software Bill of Materials)
4. **Verify signatures** before completing the workflow

#### Key Components

```yaml
permissions:
  id-token: write  # Required for keyless signing
  contents: read
  packages: write
```

**Cosign Installation:**
```yaml
- name: Install Cosign
  uses: sigstore/cosign-installer@v3
  with:
    cosign-release: 'v2.4.0'
```

**Keyless Signing:**
```yaml
- name: Sign container images with Cosign (keyless)
  run: |
    cosign sign --yes "${tag}@${digest}"
  env:
    COSIGN_EXPERIMENTAL: 1
```

### 2. Policy Enforcement with Kyverno

#### Cluster-Wide Policies

**File:** `k8s/policies/verify-image-signatures.yaml`

- Verifies Cosign signatures for all `ghcr.io/ikey168/modulo/*` images
- Uses keyless verification with GitHub Actions OIDC identity
- Blocks unsigned images from our registry
- Allows system images in system namespaces

#### Namespace-Specific Policies

**File:** `k8s/policies/modulo-namespace-policy.yaml`

- Enforces signed images only in the `modulo` namespace
- Blocks images from other registries
- Automatically sets `imagePullPolicy: Always`

#### Policy Configuration

```yaml
verifyImages:
- imageReferences:
  - "ghcr.io/ikey168/modulo/*"
  attestors:
  - count: 1
    entries:
    - keyless:
        subject: "https://github.com/Ikey168/Modulo/.github/workflows/docker-build.yml@refs/heads/main"
        issuer: "https://token.actions.githubusercontent.com"
        rekor:
          url: https://rekor.sigstore.dev
```

### 3. Deployment Updates

#### Image References

All Kubernetes deployments now use:
- **Backend:** `ghcr.io/ikey168/modulo/backend:latest`
- **Frontend:** `ghcr.io/ikey168/modulo/frontend:latest`
- **Pull Policy:** `Always` (enforced by policy)

## Setup Instructions

### 1. Install Kyverno and Policies

Run the automated setup script:

```bash
./scripts/setup-image-signing.sh
```

This script will:
- Install Kyverno using Helm
- Create the `modulo` namespace
- Apply image verification policies
- Verify the installation

### 2. Manual Installation

If you prefer manual installation:

```bash
# Install Kyverno
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm install kyverno kyverno/kyverno --namespace kyverno --create-namespace

# Apply policies
kubectl apply -f k8s/policies/verify-image-signatures.yaml
kubectl apply -f k8s/policies/modulo-namespace-policy.yaml
```

### 3. Deploy Applications

With policies in place, deploy the application:

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/04-api-deployment.yaml
kubectl apply -f k8s/07-frontend-deployment.yaml
```

## Verification

### 1. Test Signed Images

Deploy a signed image (should succeed):

```bash
kubectl run test-signed --image=ghcr.io/ikey168/modulo/frontend:latest -n modulo
```

### 2. Test Unsigned Images

Try to deploy an unsigned image (should be blocked):

```bash
kubectl run test-unsigned --image=nginx -n modulo
```

Expected error:
```
Error from server: admission webhook "mutate.kyverno.svc-fail" denied the request: 
policy Deployment/modulo/test-unsigned for resource violations: 
modulo-require-signed-images: Failed to verify image nginx: .attestors[0].entries[0].keyless: 
no matching signatures found
```

### 3. Verify Existing Signatures

You can manually verify image signatures:

```bash
# Install Cosign locally
curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
sudo chmod +x /usr/local/bin/cosign

# Verify signature
export COSIGN_EXPERIMENTAL=1
cosign verify ghcr.io/ikey168/modulo/backend:latest \
  --certificate-identity-regexp=".*" \
  --certificate-oidc-issuer-regexp=".*"
```

### 4. Check Policy Status

Monitor policy violations and compliance:

```bash
# Check cluster policies
kubectl get clusterpolicy

# Check namespace policies
kubectl get policy -n modulo

# View policy violations
kubectl get events -n modulo --field-selector reason=PolicyViolation
```

## Security Benefits

### 1. Supply Chain Security
- **Provenance Verification**: Ensures images come from expected CI/CD pipelines
- **Integrity Checking**: Cryptographic verification prevents tampering
- **Transparency**: All signatures logged in public Rekor transparency log

### 2. Runtime Protection
- **Admission Control**: Prevents deployment of unsigned/untrusted images
- **Policy Enforcement**: Automated blocking without manual intervention
- **Audit Trail**: Complete record of all signature verifications

### 3. Compliance
- **SLSA Level 2**: Meets supply chain security framework requirements
- **NIST Guidelines**: Aligns with container security best practices
- **Zero Trust**: Verify everything, trust nothing approach

## Troubleshooting

### Common Issues

1. **Signature Verification Fails**
   ```bash
   # Check if image was signed
   cosign verify ghcr.io/ikey168/modulo/backend:latest
   
   # Check Rekor transparency log
   rekor-cli search --artifact ghcr.io/ikey168/modulo/backend:latest
   ```

2. **Policy Not Working**
   ```bash
   # Check Kyverno status
   kubectl get pods -n kyverno
   
   # Check policy status
   kubectl describe clusterpolicy verify-container-signatures
   ```

3. **OIDC Issues**
   ```bash
   # Verify GitHub Actions OIDC configuration
   # Check workflow permissions include id-token: write
   ```

### Debug Commands

```bash
# View Kyverno logs
kubectl logs -n kyverno -l app.kubernetes.io/name=kyverno

# Check admission webhook configuration
kubectl get validatingadmissionwebhooks

# Test policy with dry-run
kubectl apply --dry-run=server -f test-deployment.yaml
```

## Maintenance

### 1. Key Rotation

With keyless signing, no manual key rotation is required. The system uses:
- Short-lived certificates from Sigstore CA
- GitHub Actions OIDC tokens for identity
- Automatic certificate renewal

### 2. Policy Updates

Update policies to:
- Add new image repositories
- Modify verification requirements
- Update certificate authorities

### 3. Monitoring

Monitor the system using:
- Kyverno policy violation metrics
- Rekor transparency log monitoring
- GitHub Actions workflow status

## References

- [Cosign Documentation](https://docs.sigstore.dev/cosign)
- [Kyverno Documentation](https://kyverno.io/docs/)
- [Sigstore Project](https://www.sigstore.dev/)
- [SLSA Framework](https://slsa.dev/)
- [NIST Container Security](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)
