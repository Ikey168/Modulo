# Secret Scanning & Pre-commit Hooks Implementation

This document outlines the comprehensive security implementation for the Modulo project, including automated secret detection, pre-commit hooks, and CI/CD security workflows.

## 🔍 Overview

This implementation provides multi-layered protection against secrets and sensitive data exposure:

1. **Local Development Protection** - Pre-commit hooks prevent secrets from being committed
2. **CI/CD Pipeline Scanning** - Automated scanning on every push and pull request  
3. **Repository-wide Protection** - GitHub secret scanning and push protection
4. **Historical Scanning** - Detection of existing secrets in repository history

## 🛠️ Components

### 1. Gitleaks Configuration (`.gitleaks.toml`)

**Purpose**: Configures secret detection patterns and rules
**Features**:
- Custom rules for Modulo-specific secrets (API keys, JWT secrets, blockchain keys)
- Comprehensive allowlist to reduce false positives
- Entropy-based detection for high-entropy strings
- File type exclusions for build artifacts and dependencies

**Key Rules**:
```toml
# Custom Modulo patterns
- modulo-api-key: Detects Modulo API keys
- modulo-secret-key: Detects Modulo secret keys  
- blockchain-private-key: Detects blockchain private keys
- jwt-secret: Detects JWT signing secrets
```

### 2. GitHub Actions Secret Scanning (`.github/workflows/secret-scanning.yml`)

**Purpose**: Automated secret scanning in CI/CD pipeline
**Features**:
- Runs on push, pull request, and scheduled daily scans
- SARIF report generation for GitHub Security tab
- Automatic PR comments when secrets are detected
- Integration with GitHub's security features

**Triggers**:
- Push to main/develop branches
- Pull requests to main/develop
- Daily scheduled scan at 02:00 UTC
- Manual workflow dispatch

### 3. Pre-commit Hooks (`.pre-commit-config.yaml`)

**Purpose**: Local development security and code quality
**Features**:
- Secret detection with gitleaks
- Code formatting and linting
- YAML/JSON syntax validation
- Large file detection
- Private key detection
- Branch protection (prevents direct commits to main)

**Hook Categories**:
- **Security**: gitleaks, detect-secrets, private key detection
- **Code Quality**: prettier, eslint, black, flake8
- **File Validation**: yaml-check, json-check, merge-conflict detection
- **Docker**: hadolint for Dockerfile linting
- **Documentation**: markdownlint for documentation

### 4. Setup Automation (`scripts/setup-security.sh`)

**Purpose**: One-command setup for the entire security stack
**Features**:
- Installs pre-commit and gitleaks
- Configures git hooks
- Runs initial security scan
- Updates .gitignore with security patterns
- Generates GitHub configuration checklist

## 🚀 Quick Start

### 1. Automated Setup
```bash
# Run the setup script
./scripts/setup-security.sh
```

### 2. Manual Setup
```bash
# Install pre-commit
pip install pre-commit

# Install gitleaks (Linux)
curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.18.4/gitleaks_8.18.4_linux_x64.tar.gz | tar -xz -C /tmp
sudo mv /tmp/gitleaks /usr/local/bin/

# Setup hooks
pre-commit install
pre-commit install --hook-type commit-msg
pre-commit install --hook-type pre-push

# Run initial scan
pre-commit run --all-files
```

## 📋 GitHub Configuration

After setting up local tools, configure GitHub security features:

### 1. Enable Secret Scanning
1. Go to Settings → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection" (if available)
4. Enable "Dependabot alerts"

### 2. Branch Protection Rules
1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews
   - Require status checks: `Secret Scanning / Run Gitleaks Secret Scan`
   - Include administrators
   - Restrict pushes

### 3. Required Status Checks
Add these required checks:
- `Secret Scanning / Run Gitleaks Secret Scan`
- `test-build (backend)`
- `test-build (frontend)`

## 🔧 Usage

### Daily Development Workflow
```bash
# Normal git workflow - hooks run automatically
git add .
git commit -m "feature: add new functionality"  # Hooks run here
git push origin feature-branch
```

### Manual Security Checks
```bash
# Run all pre-commit hooks
pre-commit run --all-files

# Scan for secrets only
gitleaks detect --config .gitleaks.toml

# Update hook versions
pre-commit autoupdate

# Run specific hook
pre-commit run gitleaks --all-files
```

### Handle Secret Detection
If secrets are detected:
1. **Remove the secret** from code
2. **Update .gitleaks.toml** if it's a false positive
3. **Rotate compromised credentials** 
4. **Use environment variables** for sensitive data
5. **Re-run hooks**: `pre-commit run --all-files`

## 🛡️ Security Best Practices

### 1. Secret Management
- Use environment variables for sensitive data
- Store secrets in GitHub Secrets for CI/CD
- Use `.env` files (and add to `.gitignore`)
- Implement secret rotation policies
- Use secret management tools (AWS Secrets Manager, etc.)

### 2. Development Workflow
- Never commit secrets directly
- Use placeholder values in config files
- Review pre-commit hook failures carefully
- Run security scans before submitting PRs
- Keep dependencies updated

### 3. CI/CD Security
- Use `secrets` context in GitHub Actions
- Minimize secret exposure scope
- Regular security audits
- Monitor security alerts

## 📊 Monitoring & Alerts

### GitHub Security Tab
- View secret scanning alerts
- Track security advisory updates  
- Monitor dependency vulnerabilities
- Review SARIF reports

### CI/CD Notifications
- Failed security scans block PRs
- Daily scan results via email
- Security summary in workflow runs
- Automatic PR comments for violations

## 🔄 Maintenance

### Weekly Tasks
- Review security alerts
- Update pre-commit hooks: `pre-commit autoupdate`
- Check for new gitleaks rules
- Audit secret detection patterns

### Monthly Tasks  
- Review and rotate secrets
- Update security dependencies
- Audit allowlist patterns
- Security training for team

## 🆘 Troubleshooting

### Common Issues

**Pre-commit hooks fail**:
```bash
# Skip hooks temporarily (NOT recommended)
git commit --no-verify

# Fix issues and retry
pre-commit run --all-files
```

**False positive secrets**:
1. Add pattern to `.gitleaks.toml` allowlist
2. Update `.secrets.baseline` for detect-secrets
3. Use `# pragma: allowlist secret` comment

**Hook installation fails**:
```bash
# Reinstall hooks
pre-commit uninstall
pre-commit install --install-hooks
```

**Gitleaks not found**:
```bash
# Check installation
which gitleaks
gitleaks version

# Reinstall if needed
./scripts/setup-security.sh
```

## 📚 Resources

- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [Pre-commit Documentation](https://pre-commit.com/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [GitHub Advanced Security](https://docs.github.com/en/enterprise-cloud@latest/code-security/getting-started/github-security-features)
- [OWASP Secret Management](https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure)

## 📈 Implementation Status

- ✅ Gitleaks configuration with custom rules
- ✅ GitHub Actions secret scanning workflow
- ✅ Comprehensive pre-commit hooks
- ✅ Automated setup script
- ✅ Documentation and troubleshooting guides
- ✅ GitHub security configuration checklist
- ✅ Integration with existing CI/CD pipeline

This implementation provides enterprise-grade secret protection suitable for production environments while maintaining developer productivity.
