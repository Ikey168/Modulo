# Local Development Secrets with SOPS + direnv

This document provides a comprehensive guide to implementing secure local development secret management using SOPS (Secrets OPerationS) and direnv for the Modulo application.

## 🎯 Overview

SOPS + direnv provides a secure, convenient solution for managing development secrets:

- **SOPS**: Encrypts sensitive files using AGE or PGP keys
- **direnv**: Automatically loads environment variables when entering project directory
- **AGE**: Modern, secure encryption tool (recommended over PGP)
- **Zero Plaintext**: No unencrypted secrets stored in repository

## 🏗️ Architecture

```
Developer Machine          │  Git Repository
                           │
~/.config/sops/age/        │  .sops.yaml (config)
└── keys.txt (private)     │  .envrc (direnv loader)
                           │  .env.encrypted (SOPS)
Local Environment          │  smart-contracts/
├── DATABASE_PASSWORD      │  └── .env.encrypted
├── JWT_SECRET             │
├── API_KEY                │  ✅ Safe to commit
└── ... (auto-loaded)      │  🔐 Encrypted at rest
```

## 📁 File Structure

```
├── .sops.yaml                     # SOPS encryption configuration
├── .envrc                         # direnv auto-loading script
├── .env.encrypted                 # Encrypted main application secrets
├── smart-contracts/
│   └── .env.encrypted             # Encrypted blockchain secrets
├── scripts/
│   ├── setup-local-secrets.sh     # Initial setup automation
│   └── manage-secrets.sh          # Secret management utility
└── docs/
    └── LOCAL_DEVELOPMENT_SECRETS.md # This documentation
```

## 🚀 Quick Setup

### Prerequisites

Install required tools:

```bash
# macOS
brew install sops direnv age

# Ubuntu/Debian
apt update && apt install direnv
# Install SOPS
curl -LO https://github.com/mozilla/sops/releases/latest/download/sops_3.8.1_amd64.deb
sudo dpkg -i sops_3.8.1_amd64.deb
# Install AGE
apt install age

# Arch Linux
yay -S sops direnv age
```

### Automated Setup

```bash
# Run the setup script
./scripts/setup-local-secrets.sh

# Hook direnv into your shell
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc

# Test the setup
cd .
# Should show: direnv: loading .envrc
echo $DATABASE_PASSWORD  # Should show encrypted password
```

## 🔧 Configuration Details

### SOPS Configuration (`.sops.yaml`)

```yaml
creation_rules:
  - path_regex: \.env\.encrypted$
    key_groups:
    - age:
      - age1qlx8lcv9vvzp2dz4r5l8r5l8r5l8r5l8r5l8r5l8r5l8r5l8r5l8r5
    - pgp:
      - FBC7B9E2A4F9289AC0C1D4843D16CEE4A27381B4

encrypted_regex: '^(PRIVATE_KEY|PASSWORD|SECRET|TOKEN|KEY|PASS).*'
```

### direnv Configuration (`.envrc`)

```bash
# Load encrypted secrets via SOPS
if [ -f .env.encrypted ]; then
    if command -v sops >/dev/null 2>&1; then
        eval "$(sops -d .env.encrypted | grep -v '^#' | grep -v '^$')"
        log_status "Loaded encrypted secrets from .env.encrypted"
    fi
fi

# Development environment defaults
export NODE_ENV=${NODE_ENV:-development}
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export VITE_API_URL=${VITE_API_URL:-http://localhost:8080}
```

## 🔑 Secret Management

### Viewing Secrets

```bash
# List available encrypted files
./scripts/manage-secrets.sh list

# View encrypted file content (read-only)
./scripts/manage-secrets.sh view .env.encrypted

# Get specific secret value
./scripts/manage-secrets.sh get .env.encrypted DATABASE_PASSWORD
```

### Editing Secrets

```bash
# Edit main application secrets
./scripts/manage-secrets.sh edit .env.encrypted

# Edit smart contract secrets
./scripts/manage-secrets.sh edit smart-contracts/.env.encrypted

# Direct SOPS editing
sops .env.encrypted
```

### Rotating Secrets

```bash
# Rotate specific secrets
./scripts/manage-secrets.sh rotate .env.encrypted JWT_SECRET jwt
./scripts/manage-secrets.sh rotate .env.encrypted DATABASE_PASSWORD password
./scripts/manage-secrets.sh rotate .env.encrypted API_KEY api-key

# Available rotation types:
# - password: 24-character secure password
# - jwt: Base64 JWT signing secret
# - hex: 32-byte hexadecimal string
# - api-key: API key with mod_ prefix
# - random: Random base64 string (default)
```

## 👥 Team Management

### Adding Team Members

```bash
# Get team member's AGE public key
# They run: grep "public key:" ~/.config/sops/age/keys.txt

# Add team member
./scripts/manage-secrets.sh add-member age1abc123... "John Doe"

# This automatically:
# 1. Adds key to .sops.yaml
# 2. Updates encryption for all files
# 3. Commits the changes
```

### Removing Team Members

```bash
# Remove team member access
./scripts/manage-secrets.sh remove-member age1abc123...

# This automatically:
# 1. Removes key from .sops.yaml  
# 2. Re-encrypts all files without their key
# 3. They can no longer decrypt secrets
```

## 🔒 Secret Categories

### Main Application (`.env.encrypted`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_PASSWORD` | PostgreSQL authentication | `dev_postgres_xyz123` |
| `JWT_SECRET` | Token signing | `base64-encoded-secret` |
| `API_KEY` | Internal API authentication | `mod_abc123def456` |
| `GOOGLE_CLIENT_SECRET` | OAuth integration | `GOCSPX-abc123...` |
| `GITHUB_TOKEN` | GitHub API access | `ghp_abc123...` |
| `ENCRYPTION_KEY` | Data encryption | `base64-encoded-key` |
| `SESSION_SECRET` | Session management | `random-session-key` |
| `SMTP_PASSWORD` | Email authentication | `app-specific-password` |

### Smart Contracts (`smart-contracts/.env.encrypted`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `PRIVATE_KEY` | Deployment wallet | `0xabc123...` |
| `SEPOLIA_URL` | Testnet RPC endpoint | `https://eth-sepolia.g.alchemy.com/v2/...` |
| `ETHERSCAN_API_KEY` | Contract verification | `ABC123DEF456...` |
| `POLYGONSCAN_API_KEY` | Polygon verification | `XYZ789UVW012...` |
| `COINMARKETCAP_API_KEY` | Gas price reporting | `abc-123-def-456` |

## 🔄 Development Workflow

### Daily Development

```bash
# 1. Navigate to project (auto-loads secrets)
cd /path/to/modulo
# direnv: loading .envrc
# ✅ Loaded encrypted secrets

# 2. Verify secrets are available
echo $DATABASE_PASSWORD
env | grep JWT_SECRET

# 3. Start development servers
npm run start:dev
```

### Adding New Secrets

```bash
# 1. Edit encrypted file
./scripts/manage-secrets.sh edit .env.encrypted

# 2. Add new variable
NEW_API_KEY=your_new_secret_value

# 3. Save and exit (automatically encrypted)

# 4. Reload environment
direnv reload

# 5. Commit encrypted file
git add .env.encrypted
git commit -m "feat: add new API key for service X"
```

### Syncing with Team

```bash
# 1. Pull latest changes
git pull origin main

# 2. Environment automatically reloads
# direnv: loading .envrc
# ✅ Loaded encrypted secrets

# 3. Verify new secrets (if any)
./scripts/manage-secrets.sh validate
```

## 🛠️ Troubleshooting

### direnv not loading

```bash
# Check direnv status
direnv status

# Allow directory
direnv allow .

# Verify shell hook
echo $SHELL
eval "$(direnv hook bash)"  # or zsh
```

### SOPS decryption failures

```bash
# Check AGE key exists
ls -la ~/.config/sops/age/keys.txt

# Verify key in config
grep "age:" .sops.yaml | head -1

# Test decryption manually
sops -d .env.encrypted
```

### Missing environment variables

```bash
# Check if direnv loaded
direnv status

# Reload manually
direnv reload

# Validate secrets
./scripts/manage-secrets.sh validate

# Check for errors
sops -d .env.encrypted | grep -E '^(DATABASE|JWT|API)'
```

### Key rotation issues

```bash
# Check current keys
./scripts/manage-secrets.sh list

# Backup before changes
./scripts/manage-secrets.sh backup

# Validate after rotation
./scripts/manage-secrets.sh validate
```

## 🔐 Security Best Practices

### Key Management

1. **Backup AGE Private Key**
   ```bash
   # Backup to secure location
   cp ~/.config/sops/age/keys.txt ~/secure-backup/
   ```

2. **Use Separate Keys per Environment**
   - Development: Personal AGE keys
   - Staging: Team shared keys
   - Production: Separate infrastructure keys

3. **Regular Key Rotation**
   ```bash
   # Rotate secrets monthly
   ./scripts/manage-secrets.sh rotate .env.encrypted JWT_SECRET jwt
   ./scripts/manage-secrets.sh rotate .env.encrypted DATABASE_PASSWORD password
   ```

### Access Control

1. **Principle of Least Privilege**
   - Only add necessary team members
   - Remove access for departed team members
   - Regular access reviews

2. **Audit Trail**
   ```bash
   # SOPS tracks encryption history
   sops -d .env.encrypted | head -5
   # Shows: encrypted_at, last_modified, etc.
   ```

### Development Security

1. **Never Commit Plaintext**
   ```bash
   # .gitignore includes
   .env
   .env.local
   .env.*.local
   .env.clear
   ```

2. **Validate Regularly**
   ```bash
   # Weekly validation
   ./scripts/manage-secrets.sh validate
   ```

3. **Use Different Values per Environment**
   - Development: Generated test values
   - Staging: Staging-specific credentials  
   - Production: Production secrets (separate system)

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Daily validation
./scripts/manage-secrets.sh validate

# Check direnv status
direnv status

# Verify encryption works
sops -d .env.encrypted >/dev/null && echo "✅ Decryption works"
```

### Regular Maintenance

```bash
# Weekly secret backup
./scripts/manage-secrets.sh backup

# Monthly secret rotation
./scripts/manage-secrets.sh rotate .env.encrypted JWT_SECRET jwt
./scripts/manage-secrets.sh rotate .env.encrypted API_KEY api-key

# Quarterly team access review
grep "age:" .sops.yaml
```

### Performance Optimization

- **direnv caching**: Automatic caching reduces SOPS calls
- **Shell integration**: Hook reduces manual source commands
- **Selective loading**: Only decrypt when directory changes

## 🔗 Integration with CI/CD

### Development Secrets vs Production

```bash
# Development (SOPS + direnv)
.env.encrypted          # Local development secrets

# Production (External Secrets Operator)
Azure Key Vault        # Production secret storage
Kubernetes Secrets     # Runtime secret injection
```

### Testing Integration

```bash
# Test environment with SOPS
export NODE_ENV=test
sops -d .env.encrypted | grep TEST_ | source /dev/stdin

# Validate test secrets
./scripts/manage-secrets.sh get .env.encrypted TEST_DATABASE_URL
```

## 📋 Checklist

### Initial Setup
- [ ] Install SOPS, direnv, and AGE
- [ ] Run `./scripts/setup-local-secrets.sh`
- [ ] Hook direnv into shell
- [ ] Test secret loading with `cd .`
- [ ] Verify secrets with `echo $DATABASE_PASSWORD`

### Team Onboarding
- [ ] New team member generates AGE key
- [ ] Add their public key to `.sops.yaml`
- [ ] Update encrypted files with `sops updatekeys`
- [ ] Test their access to secrets
- [ ] Document their key in team records

### Security Review
- [ ] All plaintext secrets removed from repository
- [ ] .gitignore excludes sensitive patterns
- [ ] AGE private keys backed up securely
- [ ] Team access list is current
- [ ] Secret rotation schedule established

### Operational Readiness
- [ ] Documentation updated and accessible
- [ ] Team trained on secret management
- [ ] Backup and recovery procedures tested
- [ ] Integration with other tools verified

This implementation provides secure, convenient secret management for local development while maintaining enterprise security standards.
