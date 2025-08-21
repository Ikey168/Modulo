#!/bin/bash

# SOPS Secret Management Utility
# Provides convenient commands for managing encrypted secrets

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

# Check if SOPS is available
check_sops() {
    if ! command -v sops >/dev/null 2>&1; then
        log_error "SOPS not found. Install with: brew install sops"
        exit 1
    fi
}

# List available encrypted files
list_encrypted_files() {
    log_info "Available encrypted files:"
    echo ""
    
    local files=(
        ".env.encrypted:Main application secrets"
        "smart-contracts/.env.encrypted:Smart contract secrets"
    )
    
    for file_desc in "${files[@]}"; do
        local file="${file_desc%%:*}"
        local desc="${file_desc##*:}"
        
        if [ -f "$file" ]; then
            echo "  ✅ $file - $desc"
        else
            echo "  ❌ $file - $desc (not found)"
        fi
    done
    echo ""
}

# Edit encrypted file
edit_secret() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    log_info "Opening $file for editing..."
    sops "$file"
    log_success "File saved and encrypted"
}

# View encrypted file (read-only)
view_secret() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    log_info "Viewing $file (read-only):"
    echo ""
    sops -d "$file"
}

# Extract specific secret value
get_secret() {
    local file="$1"
    local key="$2"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    local value
    value=$(sops -d "$file" | grep "^$key=" | cut -d'=' -f2- | tr -d '"'"'"'')
    
    if [ -z "$value" ]; then
        log_error "Key '$key' not found in $file"
        exit 1
    fi
    
    echo "$value"
}

# Add team member AGE key
add_team_member() {
    local public_key="$1"
    local name="${2:-Unknown}"
    
    log_info "Adding team member: $name"
    log_info "Public key: $public_key"
    
    # Validate AGE key format
    if [[ ! "$public_key" =~ ^age1[a-z0-9]{58}$ ]]; then
        log_error "Invalid AGE public key format"
        log_info "Expected format: age1..."
        exit 1
    fi
    
    # Add key to .sops.yaml
    if grep -q "$public_key" .sops.yaml; then
        log_warning "Public key already exists in .sops.yaml"
    else
        # Insert the key after the first age key
        sed -i "/- age:/a\\      - $public_key  # $name" .sops.yaml
        log_success "Added public key to .sops.yaml"
    fi
    
    # Update keys for all encrypted files
    log_info "Updating encryption keys for all files..."
    
    if [ -f .env.encrypted ]; then
        sops updatekeys .env.encrypted
        log_success "Updated keys for .env.encrypted"
    fi
    
    if [ -f smart-contracts/.env.encrypted ]; then
        sops updatekeys smart-contracts/.env.encrypted
        log_success "Updated keys for smart-contracts/.env.encrypted"
    fi
    
    log_success "Team member added successfully"
}

# Remove team member AGE key
remove_team_member() {
    local public_key="$1"
    
    log_warning "Removing team member access"
    log_info "Public key: $public_key"
    
    # Remove key from .sops.yaml
    if grep -q "$public_key" .sops.yaml; then
        sed -i "/$public_key/d" .sops.yaml
        log_success "Removed public key from .sops.yaml"
        
        # Update keys for all encrypted files
        log_info "Updating encryption keys for all files..."
        
        if [ -f .env.encrypted ]; then
            sops updatekeys .env.encrypted
            log_success "Updated keys for .env.encrypted"
        fi
        
        if [ -f smart-contracts/.env.encrypted ]; then
            sops updatekeys smart-contracts/.env.encrypted
            log_success "Updated keys for smart-contracts/.env.encrypted"
        fi
        
        log_success "Team member access revoked"
    else
        log_error "Public key not found in .sops.yaml"
    fi
}

# Rotate specific secret
rotate_secret() {
    local file="$1"
    local key="$2"
    local type="${3:-random}"
    
    if [ ! -f "$file" ]; then
        log_error "File not found: $file"
        exit 1
    fi
    
    log_info "Rotating secret: $key in $file"
    
    # Generate new secret value
    local new_value
    case "$type" in
        "password")
            new_value=$(openssl rand -base64 24 | tr -d "=+/")
            ;;
        "jwt")
            new_value=$(openssl rand -base64 32)
            ;;
        "hex")
            new_value=$(openssl rand -hex 32)
            ;;
        "api-key")
            new_value="mod_$(openssl rand -hex 16)"
            ;;
        *)
            new_value=$(openssl rand -base64 32)
            ;;
    esac
    
    # Create temporary decrypted file
    local temp_file=$(mktemp)
    trap "rm -f $temp_file" EXIT
    
    # Decrypt, update, and re-encrypt
    sops -d "$file" > "$temp_file"
    
    # Update the specific key
    sed -i "s/^$key=.*$/$key=$new_value/" "$temp_file"
    
    # Re-encrypt
    sops -e "$temp_file" > "$file"
    
    log_success "Secret '$key' rotated successfully"
    log_info "New value: ${new_value:0:10}..."
}

# Backup encrypted files
backup_secrets() {
    local backup_dir="backups/secrets/$(date +%Y-%m-%d_%H-%M-%S)"
    
    log_info "Creating backup at: $backup_dir"
    
    mkdir -p "$backup_dir"
    
    # Backup encrypted files
    if [ -f .env.encrypted ]; then
        cp .env.encrypted "$backup_dir/"
        log_success "Backed up .env.encrypted"
    fi
    
    if [ -f smart-contracts/.env.encrypted ]; then
        mkdir -p "$backup_dir/smart-contracts"
        cp smart-contracts/.env.encrypted "$backup_dir/smart-contracts/"
        log_success "Backed up smart-contracts/.env.encrypted"
    fi
    
    # Backup SOPS config
    if [ -f .sops.yaml ]; then
        cp .sops.yaml "$backup_dir/"
        log_success "Backed up .sops.yaml"
    fi
    
    log_success "Backup completed: $backup_dir"
}

# Validate encrypted files
validate_secrets() {
    log_info "Validating encrypted files..."
    
    local errors=0
    
    # Check .env.encrypted
    if [ -f .env.encrypted ]; then
        if sops -d .env.encrypted >/dev/null 2>&1; then
            log_success ".env.encrypted is valid"
            
            # Check for required variables
            local required_vars=("DATABASE_PASSWORD" "JWT_SECRET" "API_KEY")
            for var in "${required_vars[@]}"; do
                if sops -d .env.encrypted | grep -q "^$var="; then
                    log_success "Required variable found: $var"
                else
                    log_error "Missing required variable: $var"
                    ((errors++))
                fi
            done
        else
            log_error ".env.encrypted is invalid or cannot be decrypted"
            ((errors++))
        fi
    else
        log_error ".env.encrypted not found"
        ((errors++))
    fi
    
    # Check smart-contracts/.env.encrypted
    if [ -f smart-contracts/.env.encrypted ]; then
        if sops -d smart-contracts/.env.encrypted >/dev/null 2>&1; then
            log_success "smart-contracts/.env.encrypted is valid"
            
            # Check for required variables
            local required_vars=("PRIVATE_KEY" "SEPOLIA_URL" "ETHERSCAN_API_KEY")
            for var in "${required_vars[@]}"; do
                if sops -d smart-contracts/.env.encrypted | grep -q "^$var="; then
                    log_success "Required variable found: $var"
                else
                    log_warning "Missing variable: $var"
                fi
            done
        else
            log_error "smart-contracts/.env.encrypted is invalid or cannot be decrypted"
            ((errors++))
        fi
    else
        log_warning "smart-contracts/.env.encrypted not found"
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "All encrypted files are valid"
    else
        log_error "Found $errors validation errors"
        exit 1
    fi
}

# Show help
show_help() {
    echo "SOPS Secret Management Utility"
    echo "============================="
    echo ""
    echo "Usage: $0 <command> [arguments]"
    echo ""
    echo "Commands:"
    echo "  list                     List available encrypted files"
    echo "  edit <file>              Edit encrypted file"
    echo "  view <file>              View encrypted file (read-only)"
    echo "  get <file> <key>         Get specific secret value"
    echo "  rotate <file> <key> [type]  Rotate specific secret"
    echo "  add-member <pubkey> [name]  Add team member AGE key"
    echo "  remove-member <pubkey>   Remove team member AGE key"
    echo "  backup                   Backup all encrypted files"
    echo "  validate                 Validate encrypted files"
    echo "  help                     Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 edit .env.encrypted"
    echo "  $0 view smart-contracts/.env.encrypted"
    echo "  $0 get .env.encrypted DATABASE_PASSWORD"
    echo "  $0 rotate .env.encrypted JWT_SECRET jwt"
    echo "  $0 add-member age1abc123... 'John Doe'"
    echo "  $0 backup"
    echo ""
    echo "Secret types for rotation:"
    echo "  password  - 24-character password"
    echo "  jwt       - Base64 JWT secret"
    echo "  hex       - 32-byte hex string"
    echo "  api-key   - API key with mod_ prefix"
    echo "  random    - Random base64 string (default)"
}

# Main execution
main() {
    check_sops
    
    case "${1:-help}" in
        "list")
            list_encrypted_files
            ;;
        "edit")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 edit <file>"
                exit 1
            fi
            edit_secret "$2"
            ;;
        "view")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 view <file>"
                exit 1
            fi
            view_secret "$2"
            ;;
        "get")
            if [ $# -lt 3 ]; then
                log_error "Usage: $0 get <file> <key>"
                exit 1
            fi
            get_secret "$2" "$3"
            ;;
        "rotate")
            if [ $# -lt 3 ]; then
                log_error "Usage: $0 rotate <file> <key> [type]"
                exit 1
            fi
            rotate_secret "$2" "$3" "${4:-random}"
            ;;
        "add-member")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 add-member <pubkey> [name]"
                exit 1
            fi
            add_team_member "$2" "${3:-Unknown}"
            ;;
        "remove-member")
            if [ $# -lt 2 ]; then
                log_error "Usage: $0 remove-member <pubkey>"
                exit 1
            fi
            remove_team_member "$2"
            ;;
        "backup")
            backup_secrets
            ;;
        "validate")
            validate_secrets
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function
main "$@"
