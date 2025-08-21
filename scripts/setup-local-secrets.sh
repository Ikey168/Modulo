#!/bin/bash

# SOPS + direnv Local Development Secrets Setup
# Sets up encrypted environment files for secure local development

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for required tools
    if ! command -v sops >/dev/null 2>&1; then
        missing_tools+=("sops")
    fi
    
    if ! command -v direnv >/dev/null 2>&1; then
        missing_tools+=("direnv")
    fi
    
    if ! command -v age >/dev/null 2>&1; then
        missing_tools+=("age")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        echo ""
        echo "Install with:"
        echo "  macOS:   brew install sops direnv age"
        echo "  Ubuntu:  apt install direnv && go install go.mozilla.org/sops/v3/cmd/sops@latest"
        echo "  Arch:    yay -S sops direnv age"
        exit 1
    fi
    
    log_success "All required tools are installed"
}

# Generate AGE key if not exists
setup_age_key() {
    local age_key_file="$HOME/.config/sops/age/keys.txt"
    
    if [ ! -f "$age_key_file" ]; then
        log_info "Generating new AGE key for SOPS encryption..."
        
        mkdir -p "$(dirname "$age_key_file")"
        age-keygen -o "$age_key_file"
        
        log_success "AGE key generated at $age_key_file"
        log_warning "🔒 Keep this key secure and backed up!"
    else
        log_info "Using existing AGE key at $age_key_file"
    fi
    
    # Get the public key
    local public_key
    public_key=$(grep "public key:" "$age_key_file" | cut -d' ' -f4)
    
    echo "$public_key"
}

# Update SOPS config with actual AGE key
update_sops_config() {
    local public_key="$1"
    
    log_info "Updating SOPS configuration with AGE key..."
    
    # Update .sops.yaml with the actual public key
    sed -i.bak "s/age1zdv8jxy3yzqfxgx78p4q8k2k9dmx3jz2z8v8k2k9dmx3jz2z8v8k2k9dmx3jz2z8v8k2/$public_key/g" .sops.yaml
    
    # Remove backup file
    rm -f .sops.yaml.bak
    
    log_success "SOPS configuration updated"
}

# Create encrypted environment files
create_encrypted_env_files() {
    log_info "Creating encrypted environment files..."
    
    # Main application .env
    cat > .env.clear <<EOF
# Modulo Development Environment - Encrypted with SOPS
# This file contains sensitive development secrets

# Database Configuration
DATABASE_URL=postgresql://postgres:dev_postgres_password_$(openssl rand -hex 8)@localhost:5432/modulodb
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=dev_postgres_password_$(openssl rand -hex 8)
POSTGRES_PASSWORD=dev_postgres_password_$(openssl rand -hex 8)

# Application Secrets
JWT_SECRET=$(openssl rand -base64 32)
API_KEY=mod_dev_$(openssl rand -hex 16)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# OAuth Secrets (Development placeholders)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
AZURE_CLIENT_ID=your_azure_client_id_here
AZURE_CLIENT_SECRET=your_azure_client_secret_here

# GitHub Integration
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 16)

# External Services
OPENAI_API_KEY=sk-your_openai_api_key_here
ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here

# Monitoring & Analytics
SENTRY_DSN=https://your_sentry_dsn_here
AMPLITUDE_API_KEY=your_amplitude_api_key_here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here

# Redis Configuration (if used)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=redis_dev_password_$(openssl rand -hex 8)

# Session Configuration
SESSION_SECRET=$(openssl rand -base64 32)
COOKIE_SECRET=$(openssl rand -base64 32)

# Development Environment
NODE_ENV=development
SPRING_PROFILES_ACTIVE=dev
DEBUG=true
LOG_LEVEL=DEBUG
EOF

    # Encrypt the main .env file
    sops -e .env.clear > .env.encrypted
    rm .env.clear
    
    log_success "Created encrypted .env.encrypted"
    
    # Smart contracts .env
    cat > smart-contracts/.env.clear <<EOF
# Smart Contract Development Environment - Encrypted with SOPS
# This file contains sensitive blockchain development secrets

# Network Configuration
SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/$(openssl rand -hex 16)
MAINNET_URL=https://eth-mainnet.g.alchemy.com/v2/$(openssl rand -hex 16)
POLYGON_URL=https://polygon-mainnet.g.alchemy.com/v2/$(openssl rand -hex 16)
MUMBAI_URL=https://polygon-mumbai.g.alchemy.com/v2/$(openssl rand -hex 16)

# Private Key for Development (DO NOT USE IN PRODUCTION)
PRIVATE_KEY=0x$(openssl rand -hex 32)

# API Keys for Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key_$(openssl rand -hex 8)
POLYGONSCAN_API_KEY=your_polygonscan_api_key_$(openssl rand -hex 8)

# Coinmarketcap API Key for Gas Reporting
COINMARKETCAP_API_KEY=your_cmc_api_key_$(openssl rand -hex 8)

# Wallet Mnemonic for Development
MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

# Development Contract Addresses (will be updated after deployment)
CONTRACT_ADDRESS_LOCALHOST=0x0000000000000000000000000000000000000000
CONTRACT_ADDRESS_SEPOLIA=0x0000000000000000000000000000000000000000
CONTRACT_ADDRESS_MUMBAI=0x0000000000000000000000000000000000000000
CONTRACT_ADDRESS_POLYGON=0x0000000000000000000000000000000000000000
CONTRACT_ADDRESS_MAINNET=0x0000000000000000000000000000000000000000

# Gas Configuration
GAS_PRICE=20000000000
GAS_LIMIT=8000000
REPORT_GAS=true

# Development Settings
NETWORK=localhost
HARDHAT_NETWORK=localhost
FORK_MAINNET=false
EOF

    # Encrypt the smart contracts .env file
    sops -e smart-contracts/.env.clear > smart-contracts/.env.encrypted
    rm smart-contracts/.env.clear
    
    log_success "Created encrypted smart-contracts/.env.encrypted"
}

# Setup direnv integration
setup_direnv() {
    log_info "Setting up direnv integration..."
    
    # Check if direnv is hooked into shell
    if ! direnv status | grep -q "Found RC"; then
        log_warning "direnv is not hooked into your shell"
        echo ""
        echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo "  eval \"\$(direnv hook bash)\"   # for bash"
        echo "  eval \"\$(direnv hook zsh)\"    # for zsh"
        echo ""
        echo "Then restart your shell or run: source ~/.bashrc"
    fi
    
    # Allow the .envrc file
    if [ -f .envrc ]; then
        direnv allow .
        log_success "Direnv configuration allowed"
    fi
}

# Update gitignore
update_gitignore() {
    log_info "Updating .gitignore to exclude sensitive files..."
    
    # Patterns to add to gitignore
    local patterns=(
        "# Environment files"
        ".env"
        ".env.local"
        ".env.*.local"
        ".env.clear"
        ""
        "# SOPS keys (keep encrypted files only)"
        "*.key"
        "*.pem"
        ""
        "# Direnv"
        ".direnv"
    )
    
    # Check if patterns already exist
    local needs_update=false
    for pattern in "${patterns[@]}"; do
        if [ -n "$pattern" ] && ! grep -Fxq "$pattern" .gitignore 2>/dev/null; then
            needs_update=true
            break
        fi
    done
    
    if [ "$needs_update" = true ]; then
        echo "" >> .gitignore
        printf '%s\n' "${patterns[@]}" >> .gitignore
        log_success "Updated .gitignore with security patterns"
    else
        log_info ".gitignore already contains security patterns"
    fi
}

# Create documentation
create_documentation() {
    log_info "Creating development setup documentation..."
    
    cat > docs/LOCAL_DEVELOPMENT_SECRETS.md <<'EOF'
# Local Development Secrets with SOPS + direnv

This guide explains how to securely manage secrets in local development using SOPS (Secrets OPerationS) and direnv.

## 🔐 Overview

- **SOPS**: Encrypts environment files with age/PGP keys
- **direnv**: Automatically loads encrypted secrets when entering project directory
- **AGE**: Modern encryption tool for SOPS (alternative to PGP)

## 🚀 Quick Setup

```bash
# Install required tools
brew install sops direnv age  # macOS
# or
apt install direnv && go install go.mozilla.org/sops/v3/cmd/sops@latest  # Ubuntu

# Setup local development secrets
./scripts/setup-local-secrets.sh

# Hook direnv into your shell
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # or ~/.zshrc
source ~/.bashrc
```

## 📁 File Structure

```
├── .sops.yaml              # SOPS configuration (encryption keys)
├── .envrc                  # direnv configuration (auto-loading)
├── .env.encrypted          # Encrypted main environment variables
└── smart-contracts/
    └── .env.encrypted      # Encrypted smart contract secrets
```

## 🔑 Key Management

### AGE Keys (Recommended)

AGE keys are stored in `~/.config/sops/age/keys.txt`:

```bash
# Generate new key
age-keygen -o ~/.config/sops/age/keys.txt

# View public key
grep "public key:" ~/.config/sops/age/keys.txt
```

### Adding Team Members

1. Get team member's AGE public key
2. Add to `.sops.yaml` under `age:` section
3. Re-encrypt files: `sops updatekeys .env.encrypted`

## 🛠️ Usage

### Viewing Secrets

```bash
# View encrypted file content
sops .env.encrypted

# Edit encrypted file
sops .env.encrypted

# Decrypt to stdout (temporary)
sops -d .env.encrypted
```

### Adding New Secrets

```bash
# Edit encrypted file directly
sops .env.encrypted

# Add new variable and save
# Variables are automatically loaded by direnv
```

### Rotating Secrets

```bash
# Edit and update secrets
sops .env.encrypted

# Commit the encrypted file
git add .env.encrypted
git commit -m "rotate: update development secrets"
```

## 🔄 Environment Loading

When you `cd` into the project directory, direnv automatically:

1. Detects `.envrc` file
2. Decrypts `.env.encrypted` with SOPS
3. Exports all variables to environment
4. Provides status messages

```bash
cd /path/to/modulo
# direnv: loading ~/Projects/modulo/.envrc
# ℹ️  Loaded encrypted secrets from .env.encrypted
# ℹ️  Environment: development
# ℹ️  Database: localhost:5432/modulodb
```

## 🔐 Security Features

- **No Plaintext Secrets**: All secrets encrypted at rest
- **Key-based Access**: Only team members with keys can decrypt
- **Automatic Loading**: Seamless development experience
- **Git Safe**: Encrypted files safe to commit
- **Audit Trail**: SOPS tracks who encrypted/modified files

## 🚨 Security Best Practices

1. **Never commit unencrypted files**
2. **Backup your AGE private key securely**
3. **Use different secrets for dev/staging/production**
4. **Rotate secrets regularly**
5. **Review team access periodically**

## 🛠️ Troubleshooting

### direnv not loading

```bash
# Check direnv status
direnv status

# Allow the directory
direnv allow .

# Hook into shell
eval "$(direnv hook bash)"
```

### SOPS decryption errors

```bash
# Check AGE key location
ls -la ~/.config/sops/age/keys.txt

# Verify key in .sops.yaml matches
grep "age:" .sops.yaml
```

### Missing variables

```bash
# Check if variables are loaded
env | grep DATABASE_PASSWORD

# Reload direnv
direnv reload
```

## 📋 Environment Variables

### Main Application (`.env.encrypted`)

- `DATABASE_PASSWORD`: PostgreSQL password
- `JWT_SECRET`: JWT signing secret
- `API_KEY`: Internal API key
- `GOOGLE_CLIENT_SECRET`: OAuth secret
- `GITHUB_TOKEN`: GitHub API token

### Smart Contracts (`smart-contracts/.env.encrypted`)

- `PRIVATE_KEY`: Deployment wallet private key
- `SEPOLIA_URL`: Sepolia testnet RPC URL
- `ETHERSCAN_API_KEY`: Contract verification key
- `POLYGONSCAN_API_KEY`: Polygon verification key

## 🔄 Team Workflow

1. **Initial Setup**: Run `./scripts/setup-local-secrets.sh`
2. **Share Keys**: Add team member AGE public keys to `.sops.yaml`
3. **Update Secrets**: Use `sops .env.encrypted` to edit
4. **Commit Changes**: Encrypted files are safe to commit
5. **Team Sync**: Team members get updates via git pull

This setup provides secure, convenient secret management for local development while maintaining security best practices.
EOF

    log_success "Created documentation at docs/LOCAL_DEVELOPMENT_SECRETS.md"
}

# Show next steps
show_next_steps() {
    echo ""
    log_info "🔧 Next Steps:"
    echo ""
    echo "1. Hook direnv into your shell:"
    echo "   echo 'eval \"\$(direnv hook bash)\"' >> ~/.bashrc"
    echo "   source ~/.bashrc"
    echo ""
    echo "2. Navigate to project directory to test:"
    echo "   cd ."
    echo "   # Should show: direnv: loading .envrc"
    echo ""
    echo "3. Verify secrets are loaded:"
    echo "   echo \$DATABASE_PASSWORD"
    echo "   echo \$JWT_SECRET"
    echo ""
    echo "4. Edit secrets when needed:"
    echo "   sops .env.encrypted"
    echo ""
    echo "5. Add team members:"
    echo "   # Get their AGE public key"
    echo "   # Add to .sops.yaml under age: section"
    echo "   sops updatekeys .env.encrypted"
    echo ""
    log_warning "🔒 Keep your AGE private key (~/.config/sops/age/keys.txt) secure!"
}

# Main execution
main() {
    echo "🔐 SOPS + direnv Local Development Secrets Setup"
    echo "================================================"
    
    check_prerequisites
    
    # Generate AGE key and get public key
    public_key=$(setup_age_key)
    
    # Update SOPS config with the actual key
    update_sops_config "$public_key"
    
    # Create encrypted environment files
    create_encrypted_env_files
    
    # Setup direnv integration
    setup_direnv
    
    # Update gitignore
    update_gitignore
    
    # Create documentation
    create_documentation
    
    # Show next steps
    show_next_steps
    
    echo ""
    log_success "SOPS + direnv setup completed successfully!"
    echo ""
    log_info "AGE Public Key: $public_key"
}

# Run main function
main "$@"
