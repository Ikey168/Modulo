#!/bin/bash
# Admin & Operator Utilities
# Common functions for Keycloak and Modulo administration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env" 2>/dev/null || true

# Default configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${REALM:-modulo}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
LOG_FILE="${LOG_FILE:-/var/log/modulo/admin-operations.log}"

# Utility functions
log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

error() {
  echo "[$(date -Iseconds)] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# Authentication function
get_admin_token() {
  local token=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" | jq -r '.access_token' 2>/dev/null || echo "null")
  
  if [ "$token" = "null" ] || [ -z "$token" ]; then
    error "Failed to authenticate with Keycloak admin"
    return 1
  fi
  
  echo "$token"
}

# User management functions
create_user() {
  local username="$1"
  local email="$2"
  local first_name="$3"
  local last_name="$4"
  local tenant="${5:-default}"
  local password="${6:-$(openssl rand -base64 12)}"
  
  if [ -z "$username" ] || [ -z "$email" ] || [ -z "$first_name" ] || [ -z "$last_name" ]; then
    error "Usage: create_user <username> <email> <first_name> <last_name> [tenant] [password]"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  log "Creating user: $username ($email)"
  
  # Check if user already exists
  local existing_user=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token" | jq -r 'length')
  
  if [ "$existing_user" -gt 0 ]; then
    error "User $username already exists"
    return 1
  fi
  
  # Create user
  local user_response=$(curl -s -w "%{http_code}" -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$username\",
      \"email\": \"$email\",
      \"firstName\": \"$first_name\",
      \"lastName\": \"$last_name\",
      \"enabled\": true,
      \"emailVerified\": false,
      \"attributes\": {
        \"tenant\": [\"$tenant\"],
        \"created_by\": [\"$(whoami)\"],
        \"created_date\": [\"$(date -Iseconds)\"]
      },
      \"requiredActions\": [\"UPDATE_PASSWORD\", \"VERIFY_EMAIL\"]
    }")
  
  local http_code="${user_response: -3}"
  if [ "$http_code" = "201" ]; then
    # Get user ID and set password
    local user_id=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
      -H "Authorization: Bearer $admin_token" | jq -r '.[0].id')
    
    # Set password
    curl -s -X PUT \
      "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/reset-password" \
      -H "Authorization: Bearer $admin_token" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"$password\",
        \"temporary\": true
      }" >/dev/null
    
    log "User $username created successfully with temporary password: $password"
    return 0
  else
    error "Failed to create user $username (HTTP $http_code)"
    return 1
  fi
}

disable_user() {
  local username="$1"
  local reason="${2:-Manual disable}"
  
  if [ -z "$username" ]; then
    error "Usage: disable_user <username> [reason]"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  log "Disabling user: $username (Reason: $reason)"
  
  # Get user ID
  local user_data=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token")
  
  local user_id=$(echo "$user_data" | jq -r '.[0].id // "null"')
  if [ "$user_id" = "null" ]; then
    error "User $username not found"
    return 1
  fi
  
  # Disable user
  local disable_response=$(curl -s -w "%{http_code}" -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"enabled\": false,
      \"attributes\": {
        \"disabled_date\": [\"$(date -Iseconds)\"],
        \"disabled_reason\": [\"$reason\"],
        \"disabled_by\": [\"$(whoami)\"]
      }
    }")
  
  local http_code="${disable_response: -3}"
  if [ "$http_code" = "204" ]; then
    # Revoke all sessions
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/logout" \
      -H "Authorization: Bearer $admin_token" >/dev/null
    
    log "User $username disabled and sessions revoked successfully"
    return 0
  else
    error "Failed to disable user $username (HTTP $http_code)"
    return 1
  fi
}

reset_user_password() {
  local username="$1"
  local new_password="${2:-$(openssl rand -base64 16)}"
  local temporary="${3:-true}"
  
  if [ -z "$username" ]; then
    error "Usage: reset_user_password <username> [new_password] [temporary:true|false]"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  log "Resetting password for user: $username"
  
  # Get user ID
  local user_id=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[0].id // "null"')
  
  if [ "$user_id" = "null" ]; then
    error "User $username not found"
    return 1
  fi
  
  # Reset password
  local reset_response=$(curl -s -w "%{http_code}" -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/reset-password" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"password\",
      \"value\": \"$new_password\",
      \"temporary\": $temporary
    }")
  
  local http_code="${reset_response: -3}"
  if [ "$http_code" = "204" ]; then
    if [ "$temporary" = "true" ]; then
      # Add required action for password update
      curl -s -X PUT \
        "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/execute-actions-email" \
        -H "Authorization: Bearer $admin_token" \
        -H "Content-Type: application/json" \
        -d "[\"UPDATE_PASSWORD\"]" >/dev/null
      
      log "Password reset for $username. Temporary password: $new_password (user must change on next login)"
    else
      log "Password reset for $username. New password: $new_password"
    fi
    return 0
  else
    error "Failed to reset password for user $username (HTTP $http_code)"
    return 1
  fi
}

# Role management functions
assign_role() {
  local username="$1"
  local role_name="$2"
  local justification="${3:-Administrative action}"
  
  if [ -z "$username" ] || [ -z "$role_name" ]; then
    error "Usage: assign_role <username> <role_name> [justification]"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  log "Assigning role $role_name to user $username (Justification: $justification)"
  
  # Get user ID
  local user_id=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[0].id // "null"')
  
  if [ "$user_id" = "null" ]; then
    error "User $username not found"
    return 1
  fi
  
  # Get role ID
  local role_id=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role_name" \
    -H "Authorization: Bearer $admin_token" | jq -r '.id // "null"')
  
  if [ "$role_id" = "null" ]; then
    error "Role $role_name not found"
    return 1
  fi
  
  # Check if user already has the role
  local existing_roles=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[].name')
  
  if echo "$existing_roles" | grep -q "^$role_name$"; then
    log "User $username already has role $role_name"
    return 0
  fi
  
  # Assign role
  local assign_response=$(curl -s -w "%{http_code}" -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "[{\"id\": \"$role_id\", \"name\": \"$role_name\"}]")
  
  local http_code="${assign_response: -3}"
  if [ "$http_code" = "204" ]; then
    log "Role $role_name assigned to $username successfully"
    
    # Log the assignment for audit
    echo "$(date -Iseconds): Role assignment - User: $username, Role: $role_name, By: $(whoami), Justification: $justification" >> "${LOG_FILE%.log}-role-assignments.log"
    return 0
  else
    error "Failed to assign role $role_name to user $username (HTTP $http_code)"
    return 1
  fi
}

remove_role() {
  local username="$1"
  local role_name="$2"
  local justification="${3:-Administrative action}"
  
  if [ -z "$username" ] || [ -z "$role_name" ]; then
    error "Usage: remove_role <username> <role_name> [justification]"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  log "Removing role $role_name from user $username (Justification: $justification)"
  
  # Get user and role IDs (similar to assign_role)
  local user_id=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[0].id // "null"')
  
  local role_id=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role_name" \
    -H "Authorization: Bearer $admin_token" | jq -r '.id // "null"')
  
  if [ "$user_id" = "null" ] || [ "$role_id" = "null" ]; then
    error "User or role not found"
    return 1
  fi
  
  # Remove role
  local remove_response=$(curl -s -w "%{http_code}" -X DELETE \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "[{\"id\": \"$role_id\", \"name\": \"$role_name\"}]")
  
  local http_code="${remove_response: -3}"
  if [ "$http_code" = "204" ]; then
    log "Role $role_name removed from $username successfully"
    
    # Log the removal for audit
    echo "$(date -Iseconds): Role removal - User: $username, Role: $role_name, By: $(whoami), Justification: $justification" >> "${LOG_FILE%.log}-role-assignments.log"
    return 0
  else
    error "Failed to remove role $role_name from user $username (HTTP $http_code)"
    return 1
  fi
}

# Audit and reporting functions
audit_user_permissions() {
  local username="$1"
  
  if [ -z "$username" ]; then
    error "Usage: audit_user_permissions <username>"
    return 1
  fi
  
  local admin_token=$(get_admin_token) || return 1
  
  echo "=== User Permission Audit: $username ==="
  echo "Generated: $(date)"
  echo
  
  # Get user details
  local user_data=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
    -H "Authorization: Bearer $admin_token")
  
  if [ "$(echo "$user_data" | jq '. | length')" -eq 0 ]; then
    error "User $username not found"
    return 1
  fi
  
  echo "User Details:"
  echo "$user_data" | jq -r '.[0] | "ID: \(.id)\nUsername: \(.username)\nEmail: \(.email)\nEnabled: \(.enabled)\nEmail Verified: \(.emailVerified)\nCreated: \(.createdTimestamp | if . then (./1000 | strftime("%Y-%m-%d %H:%M:%S")) else "N/A" end)"'
  
  local user_id=$(echo "$user_data" | jq -r '.[0].id')
  
  echo
  echo "User Attributes:"
  echo "$user_data" | jq -r '.[0].attributes // {} | to_entries[] | "\(.key): \(.value | join(", "))"'
  
  echo
  echo "Realm Roles:"
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[] | "- \(.name) (ID: \(.id))"'
  
  echo
  echo "Client Roles:"
  local client_roles=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/role-mappings/clients" \
    -H "Authorization: Bearer $admin_token")
  
  if [ "$(echo "$client_roles" | jq '. | length')" -gt 0 ]; then
    echo "$client_roles" | jq -r 'to_entries[] | "Client: \(.key)\nRoles: \(.value | map("- " + .name) | join("\n"))\n"'
  else
    echo "No client roles assigned"
  fi
  
  echo
  echo "Groups:"
  local groups=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/groups" \
    -H "Authorization: Bearer $admin_token")
  
  if [ "$(echo "$groups" | jq '. | length')" -gt 0 ]; then
    echo "$groups" | jq -r '.[] | "- \(.name) (\(.path))"'
  else
    echo "No groups assigned"
  fi
  
  echo
  echo "Recent Sessions:"
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$user_id/sessions" \
    -H "Authorization: Bearer $admin_token" | jq -r '.[] | "- Session ID: \(.id)\n  Started: \(.start/1000 | strftime("%Y-%m-%d %H:%M:%S"))\n  Last Access: \(.lastAccess/1000 | strftime("%Y-%m-%d %H:%M:%S"))\n  IP: \(.ipAddress)\n"'
}

# System health functions
health_check() {
  echo "=== Modulo System Health Check ==="
  echo "Timestamp: $(date -Iseconds)"
  echo
  
  local all_healthy=true
  
  # Keycloak health
  echo -n "🔍 Checking Keycloak health... "
  if curl -s -f "$KEYCLOAK_URL/health" >/dev/null 2>&1; then
    echo "✅ Healthy"
  else
    echo "❌ Unhealthy"
    all_healthy=false
  fi
  
  # Realm accessibility
  echo -n "🔍 Checking realm accessibility... "
  if curl -s -f "$KEYCLOAK_URL/realms/$REALM" >/dev/null 2>&1; then
    echo "✅ Accessible"
  else
    echo "❌ Inaccessible"
    all_healthy=false
  fi
  
  # Admin authentication
  echo -n "🔍 Testing admin authentication... "
  local admin_token=$(get_admin_token 2>/dev/null)
  if [ "$?" -eq 0 ] && [ "$admin_token" != "null" ]; then
    echo "✅ Working"
  else
    echo "❌ Failed"
    all_healthy=false
  fi
  
  # User count
  echo -n "🔍 Checking user count... "
  if [ "$admin_token" != "null" ]; then
    local user_count=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/users/count" \
      -H "Authorization: Bearer $admin_token" 2>/dev/null)
    
    if [ -n "$user_count" ] && [ "$user_count" -ge 0 ]; then
      echo "✅ $user_count users"
    else
      echo "❌ Unable to retrieve count"
      all_healthy=false
    fi
  else
    echo "❌ Cannot check (auth failed)"
    all_healthy=false
  fi
  
  # Client count
  echo -n "🔍 Checking client count... "
  if [ "$admin_token" != "null" ]; then
    local client_count=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $admin_token" 2>/dev/null | jq '. | length' 2>/dev/null)
    
    if [ -n "$client_count" ] && [ "$client_count" -gt 0 ]; then
      echo "✅ $client_count clients"
    else
      echo "❌ Unable to retrieve count"
      all_healthy=false
    fi
  else
    echo "❌ Cannot check (auth failed)"
    all_healthy=false
  fi
  
  # Recent activity
  echo -n "🔍 Checking recent login activity... "
  if [ "$admin_token" != "null" ]; then
    local recent_logins=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/events?type=LOGIN&max=10" \
      -H "Authorization: Bearer $admin_token" 2>/dev/null | jq '. | length' 2>/dev/null)
    
    if [ -n "$recent_logins" ]; then
      echo "✅ $recent_logins recent logins"
    else
      echo "⚠️  No recent activity or unable to check"
    fi
  else
    echo "❌ Cannot check (auth failed)"
  fi
  
  echo
  if [ "$all_healthy" = true ]; then
    echo "🎉 Overall Status: HEALTHY"
    return 0
  else
    echo "⚠️  Overall Status: ISSUES DETECTED"
    return 1
  fi
}

# Backup functions
backup_realm() {
  local backup_date=$(date +"%Y%m%d_%H%M%S")
  local backup_dir="${BACKUP_DIR:-/var/backups/keycloak}/$backup_date"
  
  mkdir -p "$backup_dir"
  
  log "Starting realm backup: $backup_date"
  
  local admin_token=$(get_admin_token) || return 1
  
  # Export realm configuration
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/partial-export" \
    -H "Authorization: Bearer $admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"exportClients\": true,
      \"exportGroupsAndRoles\": true,
      \"exportUsers\": true
    }" > "$backup_dir/realm-export.json"
  
  # Export individual components for granular restore options
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?max=10000" \
    -H "Authorization: Bearer $admin_token" > "$backup_dir/users.json"
  
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $admin_token" > "$backup_dir/clients.json"
  
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
    -H "Authorization: Bearer $admin_token" > "$backup_dir/roles.json"
  
  curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/groups" \
    -H "Authorization: Bearer $admin_token" > "$backup_dir/groups.json"
  
  # Create backup manifest
  cat > "$backup_dir/manifest.json" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "realm": "$REALM",
  "keycloak_version": "$(curl -s "$KEYCLOAK_URL/admin/serverinfo" -H "Authorization: Bearer $admin_token" | jq -r '.systemInfo.version' 2>/dev/null || echo "unknown")",
  "operator": "$(whoami)",
  "hostname": "$(hostname)",
  "files": [
    "realm-export.json",
    "users.json",
    "clients.json",
    "roles.json",
    "groups.json"
  ],
  "backup_type": "full"
}
EOF
  
  # Compress backup
  tar -czf "${backup_dir%/*}/realm-backup-$backup_date.tar.gz" -C "${backup_dir%/*}" "$(basename "$backup_dir")"
  
  # Cleanup uncompressed backup
  rm -rf "$backup_dir"
  
  log "Backup completed successfully: realm-backup-$backup_date.tar.gz"
  return 0
}

# Command line interface
case "${1:-}" in
  create-user)
    create_user "$2" "$3" "$4" "$5" "$6" "$7"
    ;;
  disable-user)
    disable_user "$2" "$3"
    ;;
  reset-password)
    reset_user_password "$2" "$3" "$4"
    ;;
  assign-role)
    assign_role "$2" "$3" "$4"
    ;;
  remove-role)
    remove_role "$2" "$3" "$4"
    ;;
  audit-user)
    audit_user_permissions "$2"
    ;;
  health-check)
    health_check
    ;;
  backup)
    backup_realm
    ;;
  help|--help|-h)
    echo "Modulo Admin & Operator Utilities"
    echo "Usage: $0 <command> [arguments]"
    echo
    echo "User Management:"
    echo "  create-user <username> <email> <first_name> <last_name> [tenant] [password]"
    echo "  disable-user <username> [reason]"
    echo "  reset-password <username> [new_password] [temporary:true|false]"
    echo
    echo "Role Management:"
    echo "  assign-role <username> <role_name> [justification]"
    echo "  remove-role <username> <role_name> [justification]"
    echo
    echo "Auditing & Monitoring:"
    echo "  audit-user <username>"
    echo "  health-check"
    echo
    echo "Backup & Recovery:"
    echo "  backup"
    echo
    echo "Help:"
    echo "  help, --help, -h    Show this help message"
    ;;
  "")
    echo "No command specified. Use '$0 help' for usage information."
    exit 1
    ;;
  *)
    error "Unknown command: $1"
    echo "Use '$0 help' for usage information."
    exit 1
    ;;
esac
