#!/bin/bash

# Admin Utilities for Keycloak + Modulo Integration
# Comprehensive command-line tools for common administrative operations

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Default configuration
DEFAULT_KEYCLOAK_URL="http://localhost:8080"
DEFAULT_REALM="modulo"
DEFAULT_ADMIN_USER="admin"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-$DEFAULT_KEYCLOAK_URL}"
REALM="${KEYCLOAK_REALM:-$DEFAULT_REALM}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-$DEFAULT_ADMIN_USER}"

# Global variables
ADMIN_TOKEN=""
SCRIPT_START_TIME=$(date +%s)

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Get admin token
get_admin_token() {
    if [[ -z "${KEYCLOAK_ADMIN_PASSWORD:-}" ]]; then
        error_exit "KEYCLOAK_ADMIN_PASSWORD environment variable is required"
    fi
    
    log_debug "Obtaining admin token..."
    
    local token_response
    token_response=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${ADMIN_USER}" \
        -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
        -d "grant_type=password" \
        -d "client_id=admin-cli" 2>/dev/null)
    
    if [[ -z "$token_response" ]]; then
        error_exit "Failed to connect to Keycloak"
    fi
    
    ADMIN_TOKEN=$(echo "$token_response" | jq -r '.access_token // empty')
    
    if [[ -z "$ADMIN_TOKEN" ]]; then
        error_exit "Failed to obtain admin token. Check credentials and Keycloak URL."
    fi
    
    log_debug "Admin token obtained successfully"
}

# Validate token is still valid
validate_admin_token() {
    if [[ -z "$ADMIN_TOKEN" ]]; then
        get_admin_token
        return
    fi
    
    # Test token validity
    local test_response
    test_response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" \
        "${KEYCLOAK_URL}/admin/realms/${REALM}" 2>/dev/null)
    
    local http_code=${test_response: -3}
    if [[ "$http_code" != "200" ]]; then
        log_debug "Admin token expired, obtaining new token..."
        get_admin_token
    fi
}

# Generic API call wrapper
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="${3:-}"
    local content_type="${4:-application/json}"
    
    validate_admin_token
    
    local curl_opts=(-s -w "%{http_code}" -X "$method" -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if [[ -n "$data" ]]; then
        curl_opts+=(-H "Content-Type: $content_type" -d "$data")
    fi
    
    curl "${curl_opts[@]}" "${KEYCLOAK_URL}${endpoint}"
}

# User management functions

create_user() {
    local username="$1"
    local email="$2"
    local first_name="$3"
    local last_name="$4"
    local temporary_password="${5:-true}"
    local password="$6"
    
    log_info "Creating user: $username"
    
    # Check if user already exists
    local existing_user
    existing_user=$(api_call "GET" "/admin/realms/${REALM}/users?username=${username}")
    local http_code=${existing_user: -3}
    existing_user=${existing_user%???}
    
    if [[ "$http_code" == "200" ]] && [[ $(echo "$existing_user" | jq '. | length') -gt 0 ]]; then
        log_warning "User $username already exists"
        return 1
    fi
    
    local user_data
    user_data=$(cat << EOF
{
    "username": "${username}",
    "email": "${email}",
    "firstName": "${first_name}",
    "lastName": "${last_name}",
    "enabled": true,
    "emailVerified": false,
    "requiredActions": ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
    "credentials": [
        {
            "type": "password",
            "value": "${password}",
            "temporary": ${temporary_password}
        }
    ]
}
EOF
)
    
    local response
    response=$(api_call "POST" "/admin/realms/${REALM}/users" "$user_data")
    local create_code=${response: -3}
    
    if [[ "$create_code" == "201" ]]; then
        log_success "User $username created successfully"
        
        # Send welcome email if enabled
        if [[ "${SEND_WELCOME_EMAIL:-false}" == "true" ]]; then
            send_welcome_email "$username"
        fi
    else
        error_exit "Failed to create user $username. HTTP code: $create_code"
    fi
}

disable_user() {
    local username="$1"
    local reason="${2:-Manual disable}"
    
    log_info "Disabling user: $username"
    
    # Get user ID
    local user_data
    user_data=$(api_call "GET" "/admin/realms/${REALM}/users?username=${username}")
    local http_code=${user_data: -3}
    user_data=${user_data%???}
    
    if [[ "$http_code" != "200" ]] || [[ $(echo "$user_data" | jq '. | length') -eq 0 ]]; then
        error_exit "User $username not found"
    fi
    
    local user_id
    user_id=$(echo "$user_data" | jq -r '.[0].id')
    
    # Disable user
    local disable_data='{"enabled": false}'
    local response
    response=$(api_call "PUT" "/admin/realms/${REALM}/users/${user_id}" "$disable_data")
    local disable_code=${response: -3}
    
    if [[ "$disable_code" == "204" ]]; then
        log_success "User $username disabled successfully"
        
        # Log the action
        log_audit_action "USER_DISABLED" "$username" "$reason"
        
        # Revoke all sessions
        revoke_user_sessions "$user_id"
    else
        error_exit "Failed to disable user $username. HTTP code: $disable_code"
    fi
}

reset_user_password() {
    local username="$1"
    local new_password="$2"
    local temporary="${3:-true}"
    local notify_user="${4:-false}"
    
    log_info "Resetting password for user: $username"
    
    # Get user ID
    local user_data
    user_data=$(api_call "GET" "/admin/realms/${REALM}/users?username=${username}")
    local http_code=${user_data: -3}
    user_data=${user_data%???}
    
    if [[ "$http_code" != "200" ]] || [[ $(echo "$user_data" | jq '. | length') -eq 0 ]]; then
        error_exit "User $username not found"
    fi
    
    local user_id
    user_id=$(echo "$user_data" | jq -r '.[0].id')
    
    # Reset password
    local password_data
    password_data=$(cat << EOF
{
    "type": "password",
    "value": "${new_password}",
    "temporary": ${temporary}
}
EOF
)
    
    local response
    response=$(api_call "PUT" "/admin/realms/${REALM}/users/${user_id}/reset-password" "$password_data")
    local reset_code=${response: -3}
    
    if [[ "$reset_code" == "204" ]]; then
        log_success "Password reset successfully for user: $username"
        
        # Send notification email if requested
        if [[ "$notify_user" == "true" ]]; then
            send_password_reset_email "$user_id"
        fi
        
        # Log the action
        log_audit_action "PASSWORD_RESET" "$username" "Admin password reset"
    else
        error_exit "Failed to reset password for user $username. HTTP code: $reset_code"
    fi
}

assign_role_to_user() {
    local username="$1"
    local role_name="$2"
    local justification="${3:-Manual role assignment}"
    
    log_info "Assigning role $role_name to user: $username"
    
    # Get user ID
    local user_data
    user_data=$(api_call "GET" "/admin/realms/${REALM}/users?username=${username}")
    local http_code=${user_data: -3}
    user_data=${user_data%???}
    
    if [[ "$http_code" != "200" ]] || [[ $(echo "$user_data" | jq '. | length') -eq 0 ]]; then
        error_exit "User $username not found"
    fi
    
    local user_id
    user_id=$(echo "$user_data" | jq -r '.[0].id')
    
    # Get role details
    local role_data
    role_data=$(api_call "GET" "/admin/realms/${REALM}/roles/${role_name}")
    local role_code=${role_data: -3}
    role_data=${role_data%???}
    
    if [[ "$role_code" != "200" ]]; then
        error_exit "Role $role_name not found"
    fi
    
    # Assign role
    local role_assignment="[$role_data]"
    local response
    response=$(api_call "POST" "/admin/realms/${REALM}/users/${user_id}/role-mappings/realm" "$role_assignment")
    local assign_code=${response: -3}
    
    if [[ "$assign_code" == "204" ]]; then
        log_success "Role $role_name assigned to user $username"
        log_audit_action "ROLE_ASSIGNED" "$username" "Role: $role_name, Justification: $justification"
    else
        error_exit "Failed to assign role $role_name to user $username. HTTP code: $assign_code"
    fi
}

revoke_user_sessions() {
    local user_id="$1"
    
    log_info "Revoking all sessions for user ID: $user_id"
    
    local response
    response=$(api_call "POST" "/admin/realms/${REALM}/users/${user_id}/logout")
    local revoke_code=${response: -3}
    
    if [[ "$revoke_code" == "204" ]]; then
        log_success "All sessions revoked for user"
    else
        log_warning "Failed to revoke sessions. HTTP code: $revoke_code"
    fi
}

# Bulk operations

bulk_create_users() {
    local csv_file="$1"
    local default_role="${2:-workspace_viewer}"
    
    log_info "Bulk creating users from CSV: $csv_file"
    
    if [[ ! -f "$csv_file" ]]; then
        error_exit "CSV file not found: $csv_file"
    fi
    
    local line_number=0
    while IFS=',' read -r username email first_name last_name password || [[ -n "$username" ]]; do
        ((line_number++))
        
        # Skip header line
        if [[ $line_number -eq 1 ]] && [[ "$username" == "username" ]]; then
            continue
        fi
        
        # Skip empty lines
        if [[ -z "$username" ]]; then
            continue
        fi
        
        log_info "Processing user $line_number: $username"
        
        # Create user
        if create_user "$username" "$email" "$first_name" "$last_name" "true" "${password:-TempPass123!}"; then
            # Assign default role
            assign_role_to_user "$username" "$default_role" "Bulk user creation"
            log_success "User $username created and role assigned"
        else
            log_warning "Failed to create user $username"
        fi
        
        # Rate limiting to avoid overwhelming Keycloak
        sleep 0.5
    done < "$csv_file"
    
    log_success "Bulk user creation completed"
}

bulk_assign_roles() {
    local csv_file="$1"
    
    log_info "Bulk assigning roles from CSV: $csv_file"
    
    if [[ ! -f "$csv_file" ]]; then
        error_exit "CSV file not found: $csv_file"
    fi
    
    local line_number=0
    while IFS=',' read -r username role_name justification || [[ -n "$username" ]]; do
        ((line_number++))
        
        # Skip header line
        if [[ $line_number -eq 1 ]] && [[ "$username" == "username" ]]; then
            continue
        fi
        
        # Skip empty lines
        if [[ -z "$username" ]]; then
            continue
        fi
        
        log_info "Processing role assignment $line_number: $username -> $role_name"
        
        if assign_role_to_user "$username" "$role_name" "${justification:-Bulk role assignment}"; then
            log_success "Role assigned: $username -> $role_name"
        else
            log_warning "Failed to assign role to $username"
        fi
        
        # Rate limiting
        sleep 0.3
    done < "$csv_file"
    
    log_success "Bulk role assignment completed"
}

# System health and monitoring

health_check() {
    log_info "Performing comprehensive health check..."
    
    local overall_status="healthy"
    
    # Keycloak server health
    log_info "Checking Keycloak server health..."
    if curl -sf "${KEYCLOAK_URL}/health" >/dev/null 2>&1; then
        log_success "✅ Keycloak server is healthy"
    else
        log_error "❌ Keycloak server health check failed"
        overall_status="unhealthy"
    fi
    
    # Admin API accessibility
    log_info "Checking admin API accessibility..."
    validate_admin_token
    local realm_check
    realm_check=$(api_call "GET" "/admin/realms/${REALM}")
    local realm_code=${realm_check: -3}
    
    if [[ "$realm_code" == "200" ]]; then
        log_success "✅ Admin API is accessible"
    else
        log_error "❌ Admin API accessibility check failed"
        overall_status="unhealthy"
    fi
    
    # Database connectivity (indirect check)
    log_info "Checking database connectivity..."
    local user_count
    user_count=$(api_call "GET" "/admin/realms/${REALM}/users-management-permissions")
    local db_code=${user_count: -3}
    
    if [[ "$db_code" == "200" ]]; then
        log_success "✅ Database connectivity is working"
    else
        log_error "❌ Database connectivity check failed"
        overall_status="unhealthy"
    fi
    
    # OIDC endpoints
    log_info "Checking OIDC endpoints..."
    if curl -sf "${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid_configuration" >/dev/null 2>&1; then
        log_success "✅ OIDC discovery endpoint is accessible"
    else
        log_error "❌ OIDC discovery endpoint check failed"
        overall_status="unhealthy"
    fi
    
    # Performance check
    log_info "Performing basic performance check..."
    local start_time=$(date +%s%3N)
    api_call "GET" "/admin/realms/${REALM}" >/dev/null
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [[ $response_time -lt 1000 ]]; then
        log_success "✅ API response time: ${response_time}ms (good)"
    elif [[ $response_time -lt 2000 ]]; then
        log_warning "⚠️  API response time: ${response_time}ms (acceptable)"
    else
        log_error "❌ API response time: ${response_time}ms (slow)"
        overall_status="degraded"
    fi
    
    # Summary
    echo "========================="
    if [[ "$overall_status" == "healthy" ]]; then
        log_success "🎉 Overall system status: HEALTHY"
    elif [[ "$overall_status" == "degraded" ]]; then
        log_warning "⚠️  Overall system status: DEGRADED"
    else
        log_error "💥 Overall system status: UNHEALTHY"
    fi
    echo "========================="
}

quick_status() {
    log_info "Quick status check..."
    
    # Server ping
    if curl -sf "${KEYCLOAK_URL}/health" >/dev/null 2>&1; then
        echo "🟢 Keycloak: UP"
    else
        echo "🔴 Keycloak: DOWN"
    fi
    
    # Realm check
    validate_admin_token
    local realm_check
    realm_check=$(api_call "GET" "/admin/realms/${REALM}")
    local realm_code=${realm_check: -3}
    
    if [[ "$realm_code" == "200" ]]; then
        echo "🟢 Realm $REALM: ACCESSIBLE"
    else
        echo "🔴 Realm $REALM: INACCESSIBLE"
    fi
    
    # Active sessions count
    local sessions
    sessions=$(api_call "GET" "/admin/realms/${REALM}/client-session-stats")
    local sessions_code=${sessions: -3}
    sessions=${sessions%???}
    
    if [[ "$sessions_code" == "200" ]]; then
        local active_sessions
        active_sessions=$(echo "$sessions" | jq '[.[] | .active] | add // 0')
        echo "📊 Active Sessions: $active_sessions"
    else
        echo "📊 Active Sessions: UNKNOWN"
    fi
    
    # Users count
    local users_count
    users_count=$(api_call "GET" "/admin/realms/${REALM}/users/count")
    local count_code=${users_count: -3}
    users_count=${users_count%???}
    
    if [[ "$count_code" == "200" ]]; then
        echo "👥 Total Users: $users_count"
    else
        echo "👥 Total Users: UNKNOWN"
    fi
}

# Audit and compliance functions

audit_user_permissions() {
    local username="$1"
    local detailed="${2:-false}"
    
    log_info "Auditing permissions for user: $username"
    
    # Get user data
    local user_data
    user_data=$(api_call "GET" "/admin/realms/${REALM}/users?username=${username}")
    local http_code=${user_data: -3}
    user_data=${user_data%???}
    
    if [[ "$http_code" != "200" ]] || [[ $(echo "$user_data" | jq '. | length') -eq 0 ]]; then
        error_exit "User $username not found"
    fi
    
    local user_id
    user_id=$(echo "$user_data" | jq -r '.[0].id')
    
    # Get user roles
    local user_roles
    user_roles=$(api_call "GET" "/admin/realms/${REALM}/users/${user_id}/role-mappings/realm")
    local roles_code=${user_roles: -3}
    user_roles=${user_roles%???}
    
    echo "=== User Permission Audit Report ==="
    echo "User: $username"
    echo "User ID: $user_id"
    echo "Enabled: $(echo "$user_data" | jq -r '.[0].enabled')"
    echo "Email Verified: $(echo "$user_data" | jq -r '.[0].emailVerified')"
    echo "Created: $(echo "$user_data" | jq -r '.[0].createdTimestamp' | xargs -I{} date -d @{} 2>/dev/null || echo "Unknown")"
    echo ""
    
    if [[ "$roles_code" == "200" ]]; then
        echo "=== Assigned Roles ==="
        echo "$user_roles" | jq -r '.[] | "- \(.name): \(.description // "No description")"'
        echo ""
        
        if [[ "$detailed" == "true" ]]; then
            echo "=== Role Details ==="
            echo "$user_roles" | jq -r '.[] | "Role: \(.name)\nID: \(.id)\nComposite: \(.composite)\n"'
        fi
    else
        log_warning "Could not retrieve role information"
    fi
    
    # Get recent user events
    local user_events
    user_events=$(api_call "GET" "/admin/realms/${REALM}/events?type=LOGIN&type=LOGIN_ERROR&type=LOGOUT&userId=${user_id}&max=10")
    local events_code=${user_events: -3}
    user_events=${user_events%???}
    
    if [[ "$events_code" == "200" ]] && [[ $(echo "$user_events" | jq '. | length') -gt 0 ]]; then
        echo "=== Recent Activity (Last 10 Events) ==="
        echo "$user_events" | jq -r '.[] | "\(.time | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S")): \(.type) from \(.ipAddress // "unknown")"'
    else
        echo "=== Recent Activity ==="
        echo "No recent events found"
    fi
    
    echo "================================="
}

export_audit_trail() {
    local date_range="${1:-last_7_days}"
    local output_file="${2:-audit_trail_$(date +%Y%m%d).csv}"
    
    log_info "Exporting audit trail for date range: $date_range"
    
    # Calculate date parameters
    local date_from=""
    local date_to=""
    
    case "$date_range" in
        "last_24h")
            date_from=$(date -d "yesterday" '+%Y-%m-%d')
            date_to=$(date '+%Y-%m-%d')
            ;;
        "last_7_days")
            date_from=$(date -d "7 days ago" '+%Y-%m-%d')
            date_to=$(date '+%Y-%m-%d')
            ;;
        "last_30_days")
            date_from=$(date -d "30 days ago" '+%Y-%m-%d')
            date_to=$(date '+%Y-%m-%d')
            ;;
        *)
            if [[ "$date_range" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2},[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
                IFS=',' read -r date_from date_to <<< "$date_range"
            else
                error_exit "Invalid date range format. Use 'YYYY-MM-DD,YYYY-MM-DD' or predefined ranges"
            fi
            ;;
    esac
    
    # Get events
    local events
    events=$(api_call "GET" "/admin/realms/${REALM}/events?dateFrom=${date_from}&dateTo=${date_to}&max=1000")
    local events_code=${events: -3}
    events=${events%???}
    
    if [[ "$events_code" == "200" ]]; then
        # Convert to CSV
        {
            echo "timestamp,event_type,user_id,username,ip_address,client_id,details"
            echo "$events" | jq -r '.[] | [
                (.time | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S")),
                .type,
                (.userId // ""),
                (.username // ""),
                (.ipAddress // ""),
                (.clientId // ""),
                (.details | to_entries | map("\(.key)=\(.value)") | join("; "))
            ] | @csv'
        } > "$output_file"
        
        local event_count
        event_count=$(echo "$events" | jq '. | length')
        log_success "Audit trail exported: $output_file ($event_count events)"
    else
        error_exit "Failed to retrieve audit events. HTTP code: $events_code"
    fi
}

log_audit_action() {
    local action="$1"
    local target="$2"
    local details="$3"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Log to local audit file
    local audit_file="${PROJECT_ROOT}/logs/admin_audit.log"
    mkdir -p "$(dirname "$audit_file")"
    
    echo "${timestamp},${action},${target},${USER:-unknown},${details}" >> "$audit_file"
    
    log_debug "Audit action logged: $action on $target"
}

# Testing and validation functions

test_auth_flow() {
    local username="$1"
    local client_id="${2:-modulo-frontend}"
    
    log_info "Testing authentication flow for user: $username"
    
    if [[ -z "${TEST_USER_PASSWORD:-}" ]]; then
        read -sp "Enter test user password: " TEST_USER_PASSWORD
        echo
    fi
    
    # Test password flow
    local token_response
    token_response=$(curl -s -X POST \
        "${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${username}" \
        -d "password=${TEST_USER_PASSWORD}" \
        -d "grant_type=password" \
        -d "client_id=${client_id}")
    
    local access_token
    access_token=$(echo "$token_response" | jq -r '.access_token // empty')
    
    if [[ -n "$access_token" ]]; then
        log_success "✅ Authentication successful"
        
        # Test token validation
        local userinfo
        userinfo=$(curl -s -H "Authorization: Bearer $access_token" \
            "${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/userinfo")
        
        if [[ $(echo "$userinfo" | jq -r '.sub // empty') ]]; then
            log_success "✅ Token validation successful"
            echo "User info: $(echo "$userinfo" | jq -c '.')"
        else
            log_error "❌ Token validation failed"
        fi
        
        # Test token refresh
        local refresh_token
        refresh_token=$(echo "$token_response" | jq -r '.refresh_token // empty')
        
        if [[ -n "$refresh_token" ]]; then
            local refresh_response
            refresh_response=$(curl -s -X POST \
                "${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token" \
                -H "Content-Type: application/x-www-form-urlencoded" \
                -d "grant_type=refresh_token" \
                -d "refresh_token=${refresh_token}" \
                -d "client_id=${client_id}")
            
            local new_token
            new_token=$(echo "$refresh_response" | jq -r '.access_token // empty')
            
            if [[ -n "$new_token" ]]; then
                log_success "✅ Token refresh successful"
            else
                log_error "❌ Token refresh failed"
            fi
        fi
    else
        log_error "❌ Authentication failed"
        echo "Error: $(echo "$token_response" | jq -r '.error_description // .error // "Unknown error"')"
    fi
}

validate_oidc_config() {
    local client_id="${1:-modulo-frontend}"
    
    log_info "Validating OIDC configuration for client: $client_id"
    
    # Get OIDC discovery
    local oidc_config
    oidc_config=$(curl -s "${KEYCLOAK_URL}/realms/${REALM}/.well-known/openid_configuration")
    
    if [[ $(echo "$oidc_config" | jq -r '.issuer // empty') ]]; then
        log_success "✅ OIDC discovery endpoint accessible"
        
        # Validate required endpoints
        local endpoints=("authorization_endpoint" "token_endpoint" "userinfo_endpoint" "jwks_uri" "end_session_endpoint")
        
        for endpoint in "${endpoints[@]}"; do
            local endpoint_url
            endpoint_url=$(echo "$oidc_config" | jq -r ".$endpoint // empty")
            
            if [[ -n "$endpoint_url" ]]; then
                if curl -sf "$endpoint_url" >/dev/null 2>&1; then
                    log_success "✅ $endpoint accessible"
                else
                    log_warning "⚠️  $endpoint not accessible: $endpoint_url"
                fi
            else
                log_error "❌ $endpoint not configured"
            fi
        done
        
        # Validate JWKS
        local jwks_uri
        jwks_uri=$(echo "$oidc_config" | jq -r '.jwks_uri')
        local jwks
        jwks=$(curl -s "$jwks_uri")
        
        local key_count
        key_count=$(echo "$jwks" | jq '.keys | length')
        
        if [[ $key_count -gt 0 ]]; then
            log_success "✅ JWKS contains $key_count key(s)"
        else
            log_error "❌ JWKS validation failed"
        fi
        
    else
        log_error "❌ OIDC discovery endpoint failed"
    fi
    
    # Validate client configuration
    local client_data
    client_data=$(api_call "GET" "/admin/realms/${REALM}/clients?clientId=${client_id}")
    local client_code=${client_data: -3}
    client_data=${client_data%???}
    
    if [[ "$client_code" == "200" ]] && [[ $(echo "$client_data" | jq '. | length') -gt 0 ]]; then
        log_success "✅ Client $client_id found"
        
        local client_info
        client_info=$(echo "$client_data" | jq -r '.[0] | {
            clientId,
            enabled,
            publicClient,
            standardFlowEnabled,
            redirectUris,
            webOrigins
        }')
        
        echo "Client configuration:"
        echo "$client_info" | jq '.'
    else
        log_error "❌ Client $client_id not found"
    fi
}

# Utility functions

show_help() {
    cat << EOF
Keycloak Admin Utilities

Usage: $0 <command> [options]

ENVIRONMENT VARIABLES:
  KEYCLOAK_URL              Keycloak server URL (default: http://localhost:8080)
  KEYCLOAK_REALM           Target realm (default: modulo)
  KEYCLOAK_ADMIN_PASSWORD  Admin password (required)
  KEYCLOAK_ADMIN_USER      Admin username (default: admin)

COMMANDS:
  User Management:
    create-user <username> <email> <first_name> <last_name> [temp_password] [password]
                                   Create a new user
    disable-user <username> [reason]
                                   Disable a user account
    reset-password <username> <new_password> [temporary] [notify]
                                   Reset user password
    assign-role <username> <role> [justification]
                                   Assign role to user
    revoke-sessions <username>     Revoke all user sessions

  Bulk Operations:
    bulk-create-users <csv_file> [default_role]
                                   Create users from CSV file
    bulk-assign-roles <csv_file>   Assign roles from CSV file

  System Health:
    health-check                   Comprehensive health check
    quick-status                   Quick system status
    performance-check              Performance diagnostics

  Audit & Compliance:
    audit-user-permissions <username> [detailed]
                                   Audit user permissions
    export-audit-trail [date_range] [output_file]
                                   Export audit events

  Testing & Validation:
    test-auth-flow <username> [client_id]
                                   Test authentication flow
    validate-oidc-config [client_id]
                                   Validate OIDC configuration
    debug-jwt-token <token_file>   Debug JWT token

  Information:
    user-info <username>           Get user information
    list-sessions [realm]          List active sessions
    export-logs [date_range]       Export system logs

EXAMPLES:
  # Create a new user
  KEYCLOAK_ADMIN_PASSWORD=admin123 \\
    $0 create-user john.doe john@example.com John Doe true "TempPass123!"

  # Bulk create users from CSV
  KEYCLOAK_ADMIN_PASSWORD=admin123 \\
    $0 bulk-create-users users.csv workspace_editor

  # Health check
  KEYCLOAK_ADMIN_PASSWORD=admin123 \\
    $0 health-check

  # Audit user permissions
  KEYCLOAK_ADMIN_PASSWORD=admin123 \\
    $0 audit-user-permissions john.doe detailed

CSV FORMAT for bulk-create-users:
  username,email,first_name,last_name,password
  john.doe,john@example.com,John,Doe,SecurePass123!

CSV FORMAT for bulk-assign-roles:
  username,role_name,justification
  john.doe,workspace_admin,Project lead promotion

EOF
}

# Command routing
main() {
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        "create-user")
            if [[ $# -lt 4 ]]; then
                error_exit "Usage: create-user <username> <email> <first_name> <last_name> [temp_password] [password]"
            fi
            create_user "$1" "$2" "$3" "$4" "${5:-true}" "${6:-TempPass123!}"
            ;;
        "disable-user")
            if [[ $# -lt 1 ]]; then
                error_exit "Usage: disable-user <username> [reason]"
            fi
            disable_user "$1" "${2:-Manual disable via admin utility}"
            ;;
        "reset-password")
            if [[ $# -lt 2 ]]; then
                error_exit "Usage: reset-password <username> <new_password> [temporary] [notify]"
            fi
            reset_user_password "$1" "$2" "${3:-true}" "${4:-false}"
            ;;
        "assign-role")
            if [[ $# -lt 2 ]]; then
                error_exit "Usage: assign-role <username> <role> [justification]"
            fi
            assign_role_to_user "$1" "$2" "${3:-Manual role assignment}"
            ;;
        "bulk-create-users")
            if [[ $# -lt 1 ]]; then
                error_exit "Usage: bulk-create-users <csv_file> [default_role]"
            fi
            bulk_create_users "$1" "${2:-workspace_viewer}"
            ;;
        "bulk-assign-roles")
            if [[ $# -lt 1 ]]; then
                error_exit "Usage: bulk-assign-roles <csv_file>"
            fi
            bulk_assign_roles "$1"
            ;;
        "health-check")
            health_check
            ;;
        "quick-status")
            quick_status
            ;;
        "audit-user-permissions")
            if [[ $# -lt 1 ]]; then
                error_exit "Usage: audit-user-permissions <username> [detailed]"
            fi
            audit_user_permissions "$1" "${2:-false}"
            ;;
        "export-audit-trail")
            export_audit_trail "${1:-last_7_days}" "${2:-audit_trail_$(date +%Y%m%d).csv}"
            ;;
        "test-auth-flow")
            if [[ $# -lt 1 ]]; then
                error_exit "Usage: test-auth-flow <username> [client_id]"
            fi
            test_auth_flow "$1" "${2:-modulo-frontend}"
            ;;
        "validate-oidc-config")
            validate_oidc_config "${1:-modulo-frontend}"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
