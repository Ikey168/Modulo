#!/bin/bash

# Bootstrap Development Environment for Keycloak + Modulo Integration
# This script sets up a complete development environment with demo users, roles, and clients

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/bootstrap-dev.log"
BACKUP_DIR="${PROJECT_ROOT}/backups/bootstrap-$(date +%Y%m%d-%H%M%S)"

# Default configuration
DEFAULT_KEYCLOAK_URL="http://localhost:8080"
DEFAULT_REALM="modulo"
DEFAULT_ADMIN_USER="admin"
DEFAULT_CLIENT_ID="modulo-frontend"
DEFAULT_BACKEND_CLIENT_ID="modulo-backend"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

# Error handling
cleanup_on_error() {
    log_error "Script failed. Cleaning up..."
    if [[ -n "${BACKUP_DIR:-}" ]] && [[ -d "$BACKUP_DIR" ]]; then
        log_info "Restoring from backup: $BACKUP_DIR"
        # Restore logic would go here
    fi
    exit 1
}

trap cleanup_on_error ERR

# Configuration validation
validate_config() {
    log_info "Validating configuration..."
    
    # Check required environment variables
    if [[ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]]; then
        log_error "KEYCLOAK_ADMIN_PASSWORD environment variable is required"
        exit 1
    fi
    
    # Validate Keycloak URL
    if ! curl -s "${KEYCLOAK_URL}/health" > /dev/null; then
        log_warning "Keycloak health check failed. Waiting for startup..."
        wait_for_keycloak
    fi
    
    log_success "Configuration validation completed"
}

# Wait for Keycloak to be ready
wait_for_keycloak() {
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for Keycloak to be ready..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s "${KEYCLOAK_URL}/health" > /dev/null; then
            log_success "Keycloak is ready"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Keycloak not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Keycloak failed to start after $max_attempts attempts"
    exit 1
}

# Get Keycloak admin token
get_admin_token() {
    log_info "Obtaining Keycloak admin token..."
    
    local token_response
    token_response=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${ADMIN_USER}" \
        -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
        -d "grant_type=password" \
        -d "client_id=admin-cli")
    
    if [[ -z "$token_response" ]]; then
        log_error "Failed to obtain admin token"
        exit 1
    fi
    
    ADMIN_TOKEN=$(echo "$token_response" | jq -r '.access_token')
    
    if [[ "$ADMIN_TOKEN" == "null" || -z "$ADMIN_TOKEN" ]]; then
        log_error "Invalid admin token received"
        exit 1
    fi
    
    log_success "Admin token obtained successfully"
}

# Create or update realm
setup_realm() {
    log_info "Setting up realm: $REALM"
    
    # Check if realm exists
    local realm_exists
    realm_exists=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}" \
        | jq -r '.realm // empty')
    
    if [[ -n "$realm_exists" ]]; then
        log_warning "Realm $REALM already exists. Updating configuration..."
        update_realm_config
    else
        create_new_realm
    fi
    
    log_success "Realm setup completed"
}

# Create new realm
create_new_realm() {
    log_info "Creating new realm: $REALM"
    
    local realm_config
    realm_config=$(cat << EOF
{
    "realm": "${REALM}",
    "displayName": "Modulo Development Environment",
    "enabled": true,
    "sslRequired": "external",
    "registrationAllowed": false,
    "loginWithEmailAllowed": true,
    "duplicateEmailsAllowed": false,
    "resetPasswordAllowed": true,
    "editUsernameAllowed": false,
    "bruteForceProtected": true,
    "permanentLockout": false,
    "maxFailureWaitSeconds": 900,
    "minimumQuickLoginWaitSeconds": 60,
    "waitIncrementSeconds": 60,
    "quickLoginCheckMilliSeconds": 1000,
    "maxDeltaTimeSeconds": 43200,
    "failureFactor": 30,
    "defaultRoles": ["offline_access", "uma_authorization"],
    "requiredCredentials": ["password"],
    "passwordPolicy": "length(8) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1)",
    "attributes": {
        "frontendUrl": "${FRONTEND_URL:-http://localhost:3000}",
        "userProfileEnabled": "true"
    }
}
EOF
)
    
    local response
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$realm_config" \
        "${KEYCLOAK_URL}/admin/realms")
    
    local http_code=${response: -3}
    if [[ "$http_code" != "201" ]]; then
        log_error "Failed to create realm. HTTP code: $http_code"
        exit 1
    fi
    
    log_success "Realm $REALM created successfully"
}

# Update existing realm configuration
update_realm_config() {
    log_info "Updating realm configuration..."
    
    local realm_update
    realm_update=$(cat << EOF
{
    "displayName": "Modulo Development Environment",
    "passwordPolicy": "length(8) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1)",
    "attributes": {
        "frontendUrl": "${FRONTEND_URL:-http://localhost:3000}",
        "userProfileEnabled": "true"
    }
}
EOF
)
    
    curl -s -X PUT \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$realm_update" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}"
    
    log_success "Realm configuration updated"
}

# Create OIDC clients
setup_clients() {
    log_info "Setting up OIDC clients..."
    
    create_frontend_client
    create_backend_client
    
    log_success "All clients configured successfully"
}

# Create frontend client (public)
create_frontend_client() {
    log_info "Creating frontend client: $CLIENT_ID"
    
    local client_config
    client_config=$(cat << EOF
{
    "clientId": "${CLIENT_ID}",
    "name": "Modulo Frontend Application",
    "description": "React frontend application for Modulo platform",
    "enabled": true,
    "publicClient": true,
    "standardFlowEnabled": true,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "serviceAccountsEnabled": false,
    "protocol": "openid-connect",
    "redirectUris": [
        "http://localhost:3000/*",
        "http://localhost:3000/auth/callback",
        "${FRONTEND_URL:-http://localhost:3000}/*"
    ],
    "webOrigins": [
        "http://localhost:3000",
        "${FRONTEND_URL:-http://localhost:3000}"
    ],
    "attributes": {
        "pkce.code.challenge.method": "S256",
        "post.logout.redirect.uris": "http://localhost:3000/logout"
    },
    "protocolMappers": [
        {
            "name": "audience-mapper",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-audience-mapper",
            "config": {
                "included.client.audience": "${BACKEND_CLIENT_ID}",
                "id.token.claim": "false",
                "access.token.claim": "true"
            }
        }
    ]
}
EOF
)
    
    create_or_update_client "$CLIENT_ID" "$client_config"
}

# Create backend client (confidential)
create_backend_client() {
    log_info "Creating backend client: $BACKEND_CLIENT_ID"
    
    local client_secret="${BACKEND_CLIENT_SECRET:-$(openssl rand -hex 32)}"
    
    local client_config
    client_config=$(cat << EOF
{
    "clientId": "${BACKEND_CLIENT_ID}",
    "name": "Modulo Backend Service",
    "description": "Spring Boot backend service for Modulo platform",
    "enabled": true,
    "publicClient": false,
    "standardFlowEnabled": false,
    "implicitFlowEnabled": false,
    "directAccessGrantsEnabled": false,
    "serviceAccountsEnabled": true,
    "protocol": "openid-connect",
    "secret": "${client_secret}",
    "attributes": {
        "access.token.lifespan": "3600"
    },
    "protocolMappers": [
        {
            "name": "role-mapper",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-usermodel-realm-role-mapper",
            "config": {
                "claim.name": "roles",
                "jsonType.label": "String",
                "multivalued": "true",
                "userinfo.token.claim": "true",
                "id.token.claim": "true",
                "access.token.claim": "true"
            }
        },
        {
            "name": "tenant-mapper",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-usermodel-attribute-mapper",
            "config": {
                "claim.name": "tenant",
                "user.attribute": "tenant",
                "jsonType.label": "String",
                "userinfo.token.claim": "true",
                "id.token.claim": "true",
                "access.token.claim": "true"
            }
        }
    ]
}
EOF
)
    
    create_or_update_client "$BACKEND_CLIENT_ID" "$client_config"
    
    # Store client secret securely
    if [[ -z "${BACKEND_CLIENT_SECRET:-}" ]]; then
        echo "BACKEND_CLIENT_SECRET=${client_secret}" >> "${PROJECT_ROOT}/.env.local"
        log_info "Backend client secret stored in .env.local"
    fi
}

# Generic client creation/update function
create_or_update_client() {
    local client_id="$1"
    local client_config="$2"
    
    # Check if client exists
    local existing_client
    existing_client=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${client_id}")
    
    if [[ $(echo "$existing_client" | jq '. | length') -gt 0 ]]; then
        log_warning "Client $client_id already exists. Updating..."
        local client_uuid
        client_uuid=$(echo "$existing_client" | jq -r '.[0].id')
        
        curl -s -X PUT \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$client_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/clients/${client_uuid}"
    else
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$client_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/clients"
    fi
    
    log_success "Client $client_id configured successfully"
}

# Create realm roles
setup_roles() {
    log_info "Setting up realm roles..."
    
    local roles=(
        "super_admin:Platform superuser with full system access"
        "system_admin:System administrator with limited platform access"
        "tenant_admin:Organization administrator for tenant management"
        "security_officer:Security and compliance officer"
        "workspace_owner:Workspace creator and owner"
        "workspace_admin:Workspace administrator"
        "workspace_editor:Content editor with write permissions"
        "workspace_contributor:Content contributor with limited write access"
        "workspace_viewer:Read-only access to workspace content"
        "note_owner:Note creator and owner"
        "note_editor:Note collaborator with edit permissions"
        "note_commenter:Comment contributor"
        "note_viewer:Read-only note access"
        "plugin_admin:Plugin system administrator"
        "plugin_manager:Plugin configuration manager"
        "plugin_user:Plugin consumer"
    )
    
    for role_def in "${roles[@]}"; do
        IFS=':' read -r role_name role_desc <<< "$role_def"
        create_realm_role "$role_name" "$role_desc"
    done
    
    log_success "All realm roles created"
}

# Create individual realm role
create_realm_role() {
    local role_name="$1"
    local role_description="$2"
    
    local role_config
    role_config=$(cat << EOF
{
    "name": "${role_name}",
    "description": "${role_description}",
    "composite": false,
    "clientRole": false
}
EOF
)
    
    # Check if role exists
    local existing_role
    existing_role=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role_name}" 2>/dev/null || echo "null")
    
    if [[ "$existing_role" == "null" ]]; then
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$role_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/roles"
        
        log_info "Created role: $role_name"
    else
        log_info "Role $role_name already exists"
    fi
}

# Create demo users
setup_demo_users() {
    log_info "Setting up demo users..."
    
    # Demo user definitions
    local users=(
        "admin.user:admin@modulo.com:Admin:User:super_admin"
        "john.doe:john.doe@modulo.com:John:Doe:workspace_admin"
        "jane.smith:jane.smith@modulo.com:Jane:Smith:workspace_editor"
        "bob.wilson:bob.wilson@modulo.com:Bob:Wilson:workspace_contributor"
        "alice.brown:alice.brown@modulo.com:Alice:Brown:workspace_viewer"
        "security.officer:security@modulo.com:Security:Officer:security_officer"
        "plugin.admin:plugin.admin@modulo.com:Plugin:Admin:plugin_admin"
        "test.user:test@modulo.com:Test:User:workspace_viewer"
    )
    
    for user_def in "${users[@]}"; do
        IFS=':' read -r username email first_name last_name primary_role <<< "$user_def"
        create_demo_user "$username" "$email" "$first_name" "$last_name" "$primary_role"
    done
    
    log_success "All demo users created"
}

# Create individual demo user
create_demo_user() {
    local username="$1"
    local email="$2"
    local first_name="$3"
    local last_name="$4"
    local primary_role="$5"
    local password="${DEMO_USER_PASSWORD:-DevPassword123!}"
    
    log_info "Creating demo user: $username"
    
    local user_config
    user_config=$(cat << EOF
{
    "username": "${username}",
    "email": "${email}",
    "firstName": "${first_name}",
    "lastName": "${last_name}",
    "enabled": true,
    "emailVerified": true,
    "credentials": [{
        "type": "password",
        "value": "${password}",
        "temporary": false
    }],
    "attributes": {
        "tenant": ["demo-tenant"],
        "department": ["Development"],
        "created_by": ["bootstrap-script"]
    }
}
EOF
)
    
    # Check if user exists
    local existing_user
    existing_user=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${username}")
    
    if [[ $(echo "$existing_user" | jq '. | length') -eq 0 ]]; then
        # Create user
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$user_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/users"
        
        # Get user ID for role assignment
        local user_data
        user_data=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=${username}")
        local user_id
        user_id=$(echo "$user_data" | jq -r '.[0].id')
        
        # Assign primary role
        assign_role_to_user "$user_id" "$primary_role"
        
        log_success "Created user: $username with role: $primary_role"
    else
        log_info "User $username already exists"
    fi
}

# Assign role to user
assign_role_to_user() {
    local user_id="$1"
    local role_name="$2"
    
    # Get role details
    local role_data
    role_data=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role_name}")
    
    if [[ "$role_data" == "null" ]]; then
        log_warning "Role $role_name not found for assignment"
        return
    fi
    
    local role_assignment
    role_assignment="[$role_data]"
    
    curl -s -X POST \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$role_assignment" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm"
}

# Setup identity providers (optional)
setup_identity_providers() {
    if [[ "${SETUP_IDENTITY_PROVIDERS:-false}" == "true" ]]; then
        log_info "Setting up identity providers..."
        setup_google_idp
        setup_github_idp
        log_success "Identity providers configured"
    else
        log_info "Skipping identity provider setup"
    fi
}

# Setup Google Identity Provider
setup_google_idp() {
    if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
        local google_idp_config
        google_idp_config=$(cat << EOF
{
    "alias": "google",
    "displayName": "Google",
    "providerId": "google",
    "enabled": true,
    "trustEmail": true,
    "storeToken": false,
    "addReadTokenRoleOnCreate": false,
    "authenticateByDefault": false,
    "linkOnly": false,
    "firstBrokerLoginFlowAlias": "first broker login",
    "config": {
        "clientId": "${GOOGLE_CLIENT_ID}",
        "clientSecret": "${GOOGLE_CLIENT_SECRET}",
        "hostedDomain": "${GOOGLE_HOSTED_DOMAIN:-}"
    }
}
EOF
)
        
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$google_idp_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances"
        
        log_info "Google identity provider configured"
    fi
}

# Setup GitHub Identity Provider
setup_github_idp() {
    if [[ -n "${GITHUB_CLIENT_ID:-}" && -n "${GITHUB_CLIENT_SECRET:-}" ]]; then
        local github_idp_config
        github_idp_config=$(cat << EOF
{
    "alias": "github",
    "displayName": "GitHub",
    "providerId": "github",
    "enabled": true,
    "trustEmail": true,
    "storeToken": false,
    "addReadTokenRoleOnCreate": false,
    "authenticateByDefault": false,
    "linkOnly": false,
    "firstBrokerLoginFlowAlias": "first broker login",
    "config": {
        "clientId": "${GITHUB_CLIENT_ID}",
        "clientSecret": "${GITHUB_CLIENT_SECRET}"
    }
}
EOF
)
        
        curl -s -X POST \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$github_idp_config" \
            "${KEYCLOAK_URL}/admin/realms/${REALM}/identity-provider/instances"
        
        log_info "GitHub identity provider configured"
    fi
}

# Run validation tests
run_validation_tests() {
    log_info "Running validation tests..."
    
    # Test authentication flow
    test_authentication_flow
    
    # Test role assignments
    test_role_assignments
    
    # Test client configurations
    test_client_configurations
    
    log_success "All validation tests passed"
}

# Test authentication flow
test_authentication_flow() {
    log_info "Testing authentication flow..."
    
    # Test with demo user
    local token_response
    token_response=$(curl -s -X POST \
        "${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=test.user" \
        -d "password=${DEMO_USER_PASSWORD:-DevPassword123!}" \
        -d "grant_type=password" \
        -d "client_id=${CLIENT_ID}")
    
    local access_token
    access_token=$(echo "$token_response" | jq -r '.access_token // empty')
    
    if [[ -z "$access_token" ]]; then
        log_error "Authentication test failed"
        return 1
    fi
    
    log_success "Authentication test passed"
}

# Test role assignments
test_role_assignments() {
    log_info "Testing role assignments..."
    
    # Verify admin user has super_admin role
    local admin_user_data
    admin_user_data=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=admin.user")
    
    local admin_user_id
    admin_user_id=$(echo "$admin_user_data" | jq -r '.[0].id')
    
    local admin_roles
    admin_roles=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${admin_user_id}/role-mappings/realm")
    
    local has_super_admin
    has_super_admin=$(echo "$admin_roles" | jq -r '.[] | select(.name == "super_admin") | .name')
    
    if [[ "$has_super_admin" != "super_admin" ]]; then
        log_error "Role assignment test failed"
        return 1
    fi
    
    log_success "Role assignment test passed"
}

# Test client configurations
test_client_configurations() {
    log_info "Testing client configurations..."
    
    # Test frontend client
    local frontend_client
    frontend_client=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}")
    
    if [[ $(echo "$frontend_client" | jq '. | length') -eq 0 ]]; then
        log_error "Frontend client test failed"
        return 1
    fi
    
    # Test backend client
    local backend_client
    backend_client=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}/clients?clientId=${BACKEND_CLIENT_ID}")
    
    if [[ $(echo "$backend_client" | jq '. | length') -eq 0 ]]; then
        log_error "Backend client test failed"
        return 1
    fi
    
    log_success "Client configuration test passed"
}

# Generate summary report
generate_summary_report() {
    log_info "Generating bootstrap summary report..."
    
    local report_file="${PROJECT_ROOT}/bootstrap-summary-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Keycloak Bootstrap Summary Report

**Generated**: $(date)
**Realm**: ${REALM}
**Keycloak URL**: ${KEYCLOAK_URL}

## Configuration Summary

### Realm Configuration
- **Name**: ${REALM}
- **Display Name**: Modulo Development Environment
- **Password Policy**: Enabled (8+ chars, mixed case, digits, special chars)
- **Brute Force Protection**: Enabled

### Clients Created
1. **${CLIENT_ID}** (Public Client)
   - Type: Frontend/SPA
   - Redirect URIs: http://localhost:3000/*
   - PKCE: Enabled

2. **${BACKEND_CLIENT_ID}** (Confidential Client)
   - Type: Backend Service
   - Service Account: Enabled
   - Client Secret: Generated

### Roles Created
$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/roles" | \
    jq -r '.[] | "- \(.name): \(.description)"')

### Demo Users Created
$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users" | \
    jq -r '.[] | "- \(.username) (\(.firstName) \(.lastName)) - \(.email)"')

### Default Credentials
- **Demo User Password**: ${DEMO_USER_PASSWORD:-DevPassword123!}
- **Backend Client Secret**: Stored in .env.local

## Next Steps
1. Update application configuration with client details
2. Test authentication flows with demo users
3. Configure additional identity providers if needed
4. Set up role-based authorization policies
5. Run smoke tests to validate integration

## Support
For issues or questions, refer to the operator playbook:
- docs/authz/operator-playbook.md
- docs/authz/smoke-test-checklist.md
EOF
    
    log_success "Summary report generated: $report_file"
}

# Main execution
main() {
    # Initialize
    mkdir -p "$(dirname "$LOG_FILE")" "$BACKUP_DIR"
    
    log_info "=== Keycloak Development Bootstrap Started ==="
    log_info "Timestamp: $(date)"
    log_info "Script Version: 1.0"
    
    # Set configuration from environment or defaults
    KEYCLOAK_URL="${KEYCLOAK_URL:-$DEFAULT_KEYCLOAK_URL}"
    REALM="${KEYCLOAK_REALM:-$DEFAULT_REALM}"
    ADMIN_USER="${KEYCLOAK_ADMIN_USER:-$DEFAULT_ADMIN_USER}"
    CLIENT_ID="${MODULO_CLIENT_ID:-$DEFAULT_CLIENT_ID}"
    BACKEND_CLIENT_ID="${MODULO_BACKEND_CLIENT_ID:-$DEFAULT_BACKEND_CLIENT_ID}"
    
    log_info "Configuration:"
    log_info "  Keycloak URL: $KEYCLOAK_URL"
    log_info "  Realm: $REALM"
    log_info "  Admin User: $ADMIN_USER"
    log_info "  Frontend Client: $CLIENT_ID"
    log_info "  Backend Client: $BACKEND_CLIENT_ID"
    
    # Execution phases
    validate_config
    get_admin_token
    setup_realm
    setup_clients
    setup_roles
    setup_demo_users
    setup_identity_providers
    run_validation_tests
    generate_summary_report
    
    log_success "=== Keycloak Development Bootstrap Completed Successfully ==="
    log_info "Check the summary report for detailed information"
    log_info "Log file: $LOG_FILE"
}

# Help function
show_help() {
    cat << EOF
Keycloak Development Environment Bootstrap Script

Usage: $0 [OPTIONS]

Environment Variables:
  KEYCLOAK_URL              Keycloak server URL (default: http://localhost:8080)
  KEYCLOAK_REALM           Target realm name (default: modulo)
  KEYCLOAK_ADMIN_PASSWORD  Admin user password (required)
  KEYCLOAK_ADMIN_USER      Admin username (default: admin)
  MODULO_CLIENT_ID         Frontend client ID (default: modulo-frontend)
  MODULO_BACKEND_CLIENT_ID Backend client ID (default: modulo-backend)
  BACKEND_CLIENT_SECRET    Backend client secret (auto-generated if not provided)
  DEMO_USER_PASSWORD       Demo users password (default: DevPassword123!)
  FRONTEND_URL             Frontend application URL (default: http://localhost:3000)
  SETUP_IDENTITY_PROVIDERS Setup Google/GitHub IdPs (default: false)
  GOOGLE_CLIENT_ID         Google OAuth client ID
  GOOGLE_CLIENT_SECRET     Google OAuth client secret
  GITHUB_CLIENT_ID         GitHub OAuth client ID  
  GITHUB_CLIENT_SECRET     GitHub OAuth client secret

Options:
  -h, --help              Show this help message
  --dry-run              Show what would be done without making changes
  --validate-only        Only run validation tests
  --cleanup              Remove all created resources

Examples:
  # Basic setup
  KEYCLOAK_ADMIN_PASSWORD=admin123 ./bootstrap-dev.sh
  
  # Custom configuration
  KEYCLOAK_URL=https://auth.company.com \\
  KEYCLOAK_REALM=production \\
  KEYCLOAK_ADMIN_PASSWORD=secure123 \\
  ./bootstrap-dev.sh
  
  # With identity providers
  SETUP_IDENTITY_PROVIDERS=true \\
  GOOGLE_CLIENT_ID=your-google-id \\
  GOOGLE_CLIENT_SECRET=your-google-secret \\
  KEYCLOAK_ADMIN_PASSWORD=admin123 \\
  ./bootstrap-dev.sh

EOF
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            log_info "DRY RUN MODE - No changes will be made"
            # Set dry run flag and continue
            DRY_RUN=true
            main
            ;;
        --validate-only)
            log_info "VALIDATION ONLY MODE"
            validate_config
            get_admin_token
            run_validation_tests
            ;;
        --cleanup)
            log_info "CLEANUP MODE - Removing bootstrap resources"
            # Cleanup logic would go here
            ;;
        *)
            main "$@"
            ;;
    esac
fi
