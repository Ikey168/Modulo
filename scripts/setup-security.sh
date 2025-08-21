#!/bin/bash

# Setup script for pre-commit hooks and secret scanning
# This script installs and configures all necessary tools for secure development

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install pre-commit
install_precommit() {
    log_info "Installing pre-commit..."
    
    if command_exists pre-commit; then
        log_success "pre-commit is already installed"
        pre-commit --version
    else
        if command_exists pip; then
            pip install pre-commit
            log_success "pre-commit installed via pip"
        elif command_exists brew; then
            brew install pre-commit
            log_success "pre-commit installed via homebrew"
        else
            log_error "Could not install pre-commit. Please install pip or homebrew first."
            exit 1
        fi
    fi
}

# Install gitleaks
install_gitleaks() {
    log_info "Installing gitleaks..."
    
    if command_exists gitleaks; then
        log_success "gitleaks is already installed"
        gitleaks version
    else
        # Install gitleaks based on OS
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            GITLEAKS_VERSION="8.18.4"
            curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" | tar -xz -C /tmp
            sudo mv /tmp/gitleaks /usr/local/bin/
            log_success "gitleaks installed for Linux"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            if command_exists brew; then
                brew install gitleaks
                log_success "gitleaks installed via homebrew"
            else
                GITLEAKS_VERSION="8.18.4"
                curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_darwin_x64.tar.gz" | tar -xz -C /tmp
                sudo mv /tmp/gitleaks /usr/local/bin/
                log_success "gitleaks installed for macOS"
            fi
        else
            log_warning "Unsupported OS. Please install gitleaks manually from https://github.com/gitleaks/gitleaks"
        fi
    fi
}

# Install Node.js dependencies for frontend hooks
install_node_dependencies() {
    if [ -f "frontend/package.json" ]; then
        log_info "Installing Node.js dependencies for frontend..."
        cd frontend
        npm install
        cd ..
        log_success "Frontend dependencies installed"
    fi
    
    if [ -f "package.json" ]; then
        log_info "Installing root Node.js dependencies..."
        npm install
        log_success "Root dependencies installed"
    fi
}

# Setup pre-commit hooks
setup_precommit_hooks() {
    log_info "Setting up pre-commit hooks..."
    
    # Install the git hook scripts
    pre-commit install
    pre-commit install --hook-type commit-msg
    pre-commit install --hook-type pre-push
    
    log_success "Pre-commit hooks installed"
    
    # Run pre-commit on all files (initial setup)
    log_info "Running pre-commit on all files (this may take a while)..."
    pre-commit run --all-files || {
        log_warning "Some pre-commit hooks failed. This is normal for the first run."
        log_info "You can fix the issues and run 'pre-commit run --all-files' again."
    }
}

# Run initial secret scan
run_initial_secret_scan() {
    log_info "Running initial secret scan..."
    
    if command_exists gitleaks; then
        if gitleaks detect --config .gitleaks.toml --no-git; then
            log_success "No secrets detected in repository"
        else
            log_warning "Potential secrets detected. Please review and remove them."
            log_info "Run 'gitleaks detect --config .gitleaks.toml --no-git --verbose' for details"
        fi
    else
        log_warning "gitleaks not found. Skipping initial secret scan."
    fi
}

# Update gitignore for security
update_gitignore() {
    log_info "Updating .gitignore for security..."
    
    cat >> .gitignore << 'EOF'

# Security and secrets
.env
.env.local
.env.*.local
*.key
*.pem
*.p12
*.pfx
secrets/
.secrets/
.aws/
.ssh/id_*

# Pre-commit
.pre-commit-config.local.yaml

EOF
    
    log_success ".gitignore updated with security patterns"
}

# Create GitHub branch protection rules reminder
create_github_reminder() {
    log_info "Creating GitHub setup reminder..."
    
    cat > GITHUB_SECURITY_SETUP.md << 'EOF'
# GitHub Security Setup Checklist

After setting up local pre-commit hooks, complete these GitHub security configurations:

## 1. Enable Secret Scanning

### GitHub Advanced Security (if available):
1. Go to Settings → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection" 
4. Enable "Dependency graph"
5. Enable "Dependabot alerts"
6. Enable "Dependabot security updates"

### GitHub Free (Public repos):
1. Go to Settings → Code security and analysis  
2. Enable "Secret scanning" (automatically enabled for public repos)
3. Enable "Dependency graph"
4. Enable "Dependabot alerts"

## 2. Branch Protection Rules

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews before merging
   - Require status checks to pass before merging
   - Include administrators
   - Restrict pushes to matching branches

## 3. Required Status Checks

Add these required status checks:
- `Secret Scanning / Run Gitleaks Secret Scan`
- `test-build (backend)`
- `test-build (frontend)`
- Any other CI checks

## 4. Security Advisories

1. Go to Security → Advisories
2. Enable private vulnerability reporting

## 5. Actions Permissions

1. Go to Settings → Actions → General
2. Set to "Allow enterprise, and select non-enterprise, actions and reusable workflows"
3. Add required actions to allow list

## Commands to Run

```bash
# Enable secret scanning via CLI (requires GitHub CLI)
gh api repos/:owner/:repo -X PATCH -f security_and_analysis='{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}'

# Create branch protection rule
gh api repos/:owner/:repo/branches/main/protection -X PUT -f required_status_checks='{"strict":true,"contexts":["Secret Scanning / Run Gitleaks Secret Scan"]}'
```
EOF

    log_success "GitHub security setup checklist created"
}

# Main execution
main() {
    echo "🔒 Setting up Secret Scanning & Pre-commit Hooks"
    echo "================================================="
    echo ""
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository. Please run this script from the root of your git repository."
        exit 1
    fi
    
    # Install tools
    install_precommit
    install_gitleaks
    install_node_dependencies
    
    # Setup hooks
    setup_precommit_hooks
    
    # Security setup
    run_initial_secret_scan
    update_gitignore
    create_github_reminder
    
    echo ""
    echo "🎉 Setup Complete!"
    echo "=================="
    echo ""
    log_success "Pre-commit hooks are now active"
    log_success "Secret scanning is configured"
    log_info "Next steps:"
    echo "  1. Review GITHUB_SECURITY_SETUP.md for GitHub configuration"
    echo "  2. Commit your changes to trigger the hooks"
    echo "  3. Configure branch protection rules in GitHub"
    echo ""
    log_info "Commands to remember:"
    echo "  - pre-commit run --all-files  # Run all hooks manually"
    echo "  - gitleaks detect             # Scan for secrets"
    echo "  - pre-commit autoupdate       # Update hook versions"
}

# Run main function
main "$@"
