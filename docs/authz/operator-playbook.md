# Admin & Operator Playbook - Keycloak + Modulo

This document provides comprehensive operational procedures for managing user lifecycle, security incidents, and system maintenance in the Modulo platform with Keycloak integration.

## 🎯 Overview

The Admin & Operator Playbook covers essential operational tasks including user management, role assignments, SSO troubleshooting, credential rotation, and system recovery procedures. All procedures follow security best practices and maintain audit trails.

## 📋 Prerequisites

### Required Access
- **Keycloak Admin Console**: Full realm administration access
- **Modulo Platform**: System administrator role
- **Infrastructure**: Kubernetes/Docker admin access
- **Monitoring**: Access to logs and metrics

### Required Tools
```bash
# CLI Tools
kubectl            # Kubernetes management
docker             # Container management
gh                 # GitHub CLI
curl               # HTTP requests
jq                 # JSON processing

# Keycloak Admin CLI
wget https://github.com/keycloak/keycloak/releases/download/22.0.0/keycloak-22.0.0.zip
unzip keycloak-22.0.0.zip
export PATH=$PATH:./keycloak-22.0.0/bin
```

### Environment Variables
```bash
export KEYCLOAK_URL="https://keycloak.modulo.dev"
export KEYCLOAK_REALM="modulo"
export KEYCLOAK_ADMIN_USER="admin"
export KEYCLOAK_ADMIN_PASSWORD="secure-password"
export MODULO_API_URL="https://api.modulo.dev"
```

## 👥 User Lifecycle Management

### 🆕 Create New User

#### Via Keycloak Admin Console
1. **Navigate to Users**
   - Access: `Keycloak Admin Console > Users > Add user`
   - Required Fields: Username, Email, First Name, Last Name

2. **Set User Attributes**
   ```json
   {
     "tenant": "organization-name",
     "department": "engineering",
     "employee_id": "EMP-12345",
     "start_date": "2025-09-04"
   }
   ```

3. **Configure Authentication**
   - Set temporary password
   - Require password change on first login
   - Enable email verification (recommended)

#### Via CLI (Automated)
```bash
#!/bin/bash
# Create user via Keycloak Admin CLI

REALM="modulo"
USERNAME="$1"
EMAIL="$2"
FIRST_NAME="$3"
LAST_NAME="$4"
TENANT="$5"

# Get admin token
ADMIN_TOKEN=$(curl -s -X POST \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$KEYCLOAK_ADMIN_USER" \
  -d "password=$KEYCLOAK_ADMIN_PASSWORD" | jq -r '.access_token')

# Create user
curl -s -X POST \
  "$KEYCLOAK_URL/admin/realms/$REALM/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"email\": \"$EMAIL\",
    \"firstName\": \"$FIRST_NAME\",
    \"lastName\": \"$LAST_NAME\",
    \"enabled\": true,
    \"emailVerified\": false,
    \"attributes\": {
      \"tenant\": [\"$TENANT\"],
      \"created_by\": [\"system\"],
      \"created_date\": [\"$(date -Iseconds)\"]
    },
    \"requiredActions\": [\"UPDATE_PASSWORD\", \"VERIFY_EMAIL\"]
  }"

echo "User $USERNAME created successfully"
```

### 🔒 Disable User Account

#### Immediate Disable (Security Incident)
```bash
#!/bin/bash
# Emergency user disable

USERNAME="$1"
REASON="$2"

# Get user ID
USER_ID=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

# Disable user
curl -s -X PUT \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"enabled\": false,
    \"attributes\": {
      \"disabled_date\": [\"$(date -Iseconds)\"],
      \"disabled_reason\": [\"$REASON\"],
      \"disabled_by\": [\"$OPERATOR_USERNAME\"]
    }
  }"

# Revoke all sessions
curl -s -X POST \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/logout" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "User $USERNAME disabled and sessions revoked"
```

#### Graceful Disable (Planned)
1. **Notification**: Send 7-day advance notice
2. **Data Backup**: Export user's data and configurations
3. **Permission Transfer**: Reassign owned resources
4. **Account Disable**: Disable after grace period
5. **Audit Log**: Document all actions taken

### 🔐 Reset User Password

#### Emergency Reset
```bash
#!/bin/bash
# Emergency password reset

USERNAME="$1"
TEMP_PASSWORD="TempPass-$(date +%s)"

USER_ID=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

# Set temporary password
curl -s -X PUT \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"password\",
    \"value\": \"$TEMP_PASSWORD\",
    \"temporary\": true
  }"

# Force password change on next login
curl -s -X PUT \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/execute-actions-email" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[\"UPDATE_PASSWORD\"]"

echo "Password reset for $USERNAME. Temporary password: $TEMP_PASSWORD"
echo "User will be required to change password on next login"
```

## 🏗️ Role Management

### 📋 Assign Roles to User

#### Standard Role Assignment
```bash
#!/bin/bash
# Assign role to user

USERNAME="$1"
ROLE_NAME="$2"
WORKSPACE_ID="$3"
JUSTIFICATION="$4"

# Get user ID
USER_ID=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')

# Get role ID
ROLE_ID=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/roles/$ROLE_NAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.id')

# Assign role
curl -s -X POST \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[{
    \"id\": \"$ROLE_ID\",
    \"name\": \"$ROLE_NAME\"
  }]"

# Log the assignment
echo "$(date -Iseconds): Role $ROLE_NAME assigned to $USERNAME by $OPERATOR_USERNAME. Justification: $JUSTIFICATION" >> /var/log/modulo/role-assignments.log

echo "Role $ROLE_NAME assigned to $USERNAME"
```

#### Temporary Role Assignment (Time-limited)
```bash
#!/bin/bash
# Assign temporary role with expiration

USERNAME="$1"
ROLE_NAME="$2"
DURATION_DAYS="$3"
JUSTIFICATION="$4"

EXPIRY_DATE=$(date -d "+$DURATION_DAYS days" -Iseconds)

# Assign role (same as above)
# ... role assignment code ...

# Schedule automatic removal
echo "#!/bin/bash
curl -s -X DELETE \
  \"$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm\" \
  -H \"Authorization: Bearer \$(get_admin_token)\" \
  -H \"Content-Type: application/json\" \
  -d \"[{\\\"id\\\": \\\"$ROLE_ID\\\", \\\"name\\\": \\\"$ROLE_NAME\\\"}]\"
echo \"Temporary role $ROLE_NAME removed from $USERNAME (expired)\"" > /tmp/remove_role_${USERNAME}_${ROLE_NAME}.sh

# Schedule with cron or systemd timer
at "$(date -d "+$DURATION_DAYS days" +"%Y-%m-%d %H:%M")" < /tmp/remove_role_${USERNAME}_${ROLE_NAME}.sh

echo "Temporary role $ROLE_NAME assigned to $USERNAME, expires: $EXPIRY_DATE"
```

### 🔍 Audit User Permissions
```bash
#!/bin/bash
# Comprehensive user permission audit

USERNAME="$1"

echo "=== User Permission Audit: $USERNAME ==="
echo "Generated: $(date)"
echo

# Get user details
USER_DATA=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "User Details:"
echo "$USER_DATA" | jq -r '.[0] | "ID: \(.id)\nEmail: \(.email)\nEnabled: \(.enabled)\nCreated: \(.createdTimestamp | tonumber | strftime("%Y-%m-%d %H:%M:%S"))"'
echo

# Get realm roles
echo "Realm Roles:"
USER_ID=$(echo "$USER_DATA" | jq -r '.[0].id')
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | "- \(.name)"'
echo

# Get client roles
echo "Client Roles:"
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r 'to_entries[] | "Client: \(.key)\nRoles: \(.value | map("- " + .name) | join("\n"))\n"'

# Get groups
echo "Groups:"
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/groups" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | "- \(.name) (\(.path))"'
```

## 🔐 SSO Troubleshooting

### 🚨 Common SSO Issues

#### Issue 1: User Cannot Login
**Symptoms**: Authentication fails with valid credentials
**Diagnosis Steps**:
```bash
# Check user status
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$USERNAME" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[0] | {enabled, emailVerified, requiredActions}'

# Check login events
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/events?type=LOGIN_ERROR&userId=$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | {time: (.time/1000 | strftime("%Y-%m-%d %H:%M:%S")), error, details}'

# Check client configuration
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[0] | {enabled, redirectUris, webOrigins}'
```

**Common Solutions**:
- Enable user account
- Verify email if required
- Reset password
- Clear required actions
- Check client redirect URIs

#### Issue 2: Token Validation Failures
**Symptoms**: Valid login but API calls fail with 401/403
**Diagnosis Steps**:
```bash
# Validate JWT token structure
echo "$JWT_TOKEN" | cut -d. -f2 | base64 -d | jq

# Check token expiration
TOKEN_PAYLOAD=$(echo "$JWT_TOKEN" | cut -d. -f2 | base64 -d)
EXP=$(echo "$TOKEN_PAYLOAD" | jq -r '.exp')
CURRENT=$(date +%s)
if [ $EXP -lt $CURRENT ]; then
  echo "Token expired at $(date -d @$EXP)"
fi

# Verify token signature
curl -s -X GET "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/certs" | jq '.keys[0]'
```

#### Issue 3: Role Mapping Issues
**Symptoms**: User authenticated but lacks proper permissions
**Diagnosis Steps**:
```bash
# Check user's effective roles
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm/composite" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[] | .name'

# Verify client mappers
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients/$CLIENT_ID/protocol-mappers/models" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | select(.protocolMapper == "oidc-usermodel-realm-role-mapper")'

# Test token content
curl -s -X POST \
  "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token/introspect" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=$ACCESS_TOKEN&client_id=modulo&client_secret=$CLIENT_SECRET" | jq
```

### 📊 SSO Health Monitoring

#### Health Check Script
```bash
#!/bin/bash
# SSO system health check

echo "=== Keycloak Health Check ==="

# 1. Basic connectivity
if curl -s "$KEYCLOAK_URL/health" | grep -q "UP"; then
  echo "✅ Keycloak server accessible"
else
  echo "❌ Keycloak server unavailable"
  exit 1
fi

# 2. Realm accessibility
if curl -s "$KEYCLOAK_URL/realms/$REALM" | grep -q "realm"; then
  echo "✅ Modulo realm accessible"
else
  echo "❌ Modulo realm unavailable"
fi

# 3. Client registration
CLIENT_COUNT=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '. | length')
echo "✅ $CLIENT_COUNT clients registered"

# 4. User count
USER_COUNT=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "✅ $USER_COUNT users registered"

# 5. Recent login activity
RECENT_LOGINS=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/events?type=LOGIN&max=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '. | length')
echo "✅ $RECENT_LOGINS recent login events"

echo "=== Health Check Complete ==="
```

## 🔄 Credential Rotation

### 🔐 Rotate Keycloak Admin Credentials

#### Emergency Rotation (Security Incident)
```bash
#!/bin/bash
# Emergency admin credential rotation

echo "=== EMERGENCY KEYCLOAK ADMIN ROTATION ==="
echo "Current time: $(date)"

# Generate new secure password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Update admin user in master realm
OLD_TOKEN=$ADMIN_TOKEN
curl -s -X PUT \
  "$KEYCLOAK_URL/admin/realms/master/users/$ADMIN_USER_ID/reset-password" \
  -H "Authorization: Bearer $OLD_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"password\",
    \"value\": \"$NEW_PASSWORD\",
    \"temporary\": false
  }"

# Test new credentials
NEW_TOKEN=$(curl -s -X POST \
  "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$KEYCLOAK_ADMIN_USER" \
  -d "password=$NEW_PASSWORD" | jq -r '.access_token')

if [ "$NEW_TOKEN" != "null" ]; then
  echo "✅ Admin credentials rotated successfully"
  echo "New password stored in secure location"
  
  # Update environment/secrets
  kubectl create secret generic keycloak-admin-creds \
    --from-literal=username="$KEYCLOAK_ADMIN_USER" \
    --from-literal=password="$NEW_PASSWORD" \
    --dry-run=client -o yaml | kubectl apply -f -
    
  # Notify security team
  echo "URGENT: Keycloak admin credentials rotated at $(date). New password deployed to cluster." | \
    mail -s "Keycloak Admin Credential Rotation" security@company.com
else
  echo "❌ Credential rotation failed"
  exit 1
fi
```

#### Scheduled Rotation (Quarterly)
```bash
#!/bin/bash
# Scheduled credential rotation with rollback capability

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
mkdir -p /secure/backups/keycloak/$BACKUP_DATE

# Backup current configuration
echo "Backing up current admin configuration..."
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/master/users/$ADMIN_USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /secure/backups/keycloak/$BACKUP_DATE/admin_user.json

# Generate and set new password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Update password with rollback preparation
# ... rotation logic with testing and rollback capability ...

echo "Scheduled rotation completed successfully"
```

### 🔐 Client Secret Rotation

```bash
#!/bin/bash
# Rotate client secrets for all Modulo clients

for CLIENT_NAME in "modulo-frontend" "modulo-api" "modulo-admin"; do
  echo "Rotating secret for client: $CLIENT_NAME"
  
  # Get client ID
  CLIENT_ID=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=$CLIENT_NAME" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
  
  # Generate new secret
  NEW_SECRET=$(openssl rand -hex 32)
  
  # Update client secret
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients/$CLIENT_ID/client-secret" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"value\": \"$NEW_SECRET\"}"
  
  # Update application configuration
  kubectl patch secret "$CLIENT_NAME-secrets" \
    -p "{\"data\":{\"client-secret\":\"$(echo -n $NEW_SECRET | base64)\"}}"
  
  # Restart application pods
  kubectl rollout restart deployment "$CLIENT_NAME"
  
  echo "✅ $CLIENT_NAME secret rotated and deployed"
done
```

## 🗃️ Backup & Restore

### 📦 Backup Keycloak Realm

#### Full Realm Export
```bash
#!/bin/bash
# Complete realm backup

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/secure/backups/keycloak/$BACKUP_DATE"
mkdir -p "$BACKUP_DIR"

echo "Starting full realm backup: $BACKUP_DATE"

# Export realm configuration
curl -s -X POST \
  "$KEYCLOAK_URL/admin/realms/$REALM/partial-export" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"exportClients\": true,
    \"exportGroupsAndRoles\": true,
    \"exportUsers\": true
  }" > "$BACKUP_DIR/realm-export.json"

# Export individual components
echo "Exporting users..."
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?max=10000" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > "$BACKUP_DIR/users.json"

echo "Exporting clients..."
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > "$BACKUP_DIR/clients.json"

echo "Exporting roles..."
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > "$BACKUP_DIR/roles.json"

echo "Exporting groups..."
curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/groups" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > "$BACKUP_DIR/groups.json"

# Create backup manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup_date": "$(date -Iseconds)",
  "realm": "$REALM",
  "keycloak_version": "$(curl -s "$KEYCLOAK_URL/admin/serverinfo" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.systemInfo.version')",
  "operator": "$OPERATOR_USERNAME",
  "files": [
    "realm-export.json",
    "users.json",
    "clients.json", 
    "roles.json",
    "groups.json"
  ]
}
EOF

# Compress backup
tar -czf "/secure/backups/keycloak/realm-backup-$BACKUP_DATE.tar.gz" -C "/secure/backups/keycloak" "$BACKUP_DATE"

echo "✅ Backup completed: realm-backup-$BACKUP_DATE.tar.gz"
```

#### Incremental User Backup
```bash
#!/bin/bash
# Backup only changed users since last backup

LAST_BACKUP=$(find /secure/backups/keycloak -name "users-*.json" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)
LAST_BACKUP_TIME=$(stat -c %Y "$LAST_BACKUP" 2>/dev/null || echo 0)
CURRENT_TIME=$(date +%s)
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

echo "Incremental user backup since $(date -d @$LAST_BACKUP_TIME)"

# Get users modified since last backup
MODIFIED_USERS=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users?max=10000" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq --argjson since "$LAST_BACKUP_TIME" '[.[] | select((.createdTimestamp // 0) / 1000 > $since or (.modifiedTimestamp // 0) / 1000 > $since)]')

echo "$MODIFIED_USERS" > "/secure/backups/keycloak/users-incremental-$BACKUP_DATE.json"
echo "✅ Incremental backup: $(echo "$MODIFIED_USERS" | jq '. | length') users backed up"
```

### 🔄 Restore Keycloak Realm

#### Full Restore (Disaster Recovery)
```bash
#!/bin/bash
# Full realm restore from backup

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  exit 1
fi

echo "=== DISASTER RECOVERY: KEYCLOAK REALM RESTORE ==="
echo "Backup file: $BACKUP_FILE"
echo "Target realm: $REALM"
echo "Are you sure? This will REPLACE all current data! (yes/no)"
read CONFIRMATION

if [ "$CONFIRMATION" != "yes" ]; then
  echo "Restore cancelled"
  exit 1
fi

# Extract backup
RESTORE_DIR="/tmp/keycloak-restore-$(date +%s)"
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Find the actual backup directory
BACKUP_DIR=$(find "$RESTORE_DIR" -type d -name "202*" | head -1)
if [ -z "$BACKUP_DIR" ]; then
  echo "❌ Invalid backup format"
  exit 1
fi

echo "Restoring from: $BACKUP_DIR"

# 1. Create new realm or clean existing
echo "Preparing realm for restore..."
curl -s -X DELETE \
  "$KEYCLOAK_URL/admin/realms/$REALM" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

sleep 5

# 2. Import realm
echo "Importing realm configuration..."
curl -s -X POST \
  "$KEYCLOAK_URL/admin/realms" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "@$BACKUP_DIR/realm-export.json"

# 3. Verify restore
echo "Verifying restore..."
USER_COUNT=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/users/count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CLIENT_COUNT=$(curl -s -X GET \
  "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '. | length')

echo "✅ Restore completed:"
echo "  - Users: $USER_COUNT"
echo "  - Clients: $CLIENT_COUNT"

# Cleanup
rm -rf "$RESTORE_DIR"
```

## 🚀 Bootstrap & Development Setup

### 🛠️ Development Environment Bootstrap

Create the bootstrap script for setting up development users and clients:

```bash
#!/bin/bash
# Bootstrap development environment with demo users and clients

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env.dev" 2>/dev/null || true

# Default configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${REALM:-modulo-dev}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

echo "🚀 Modulo Development Environment Bootstrap"
echo "Keycloak URL: $KEYCLOAK_URL"
echo "Realm: $REALM"
echo

# Get admin token
get_admin_token() {
  curl -s -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" | jq -r '.access_token'
}

ADMIN_TOKEN=$(get_admin_token)
if [ "$ADMIN_TOKEN" = "null" ]; then
  echo "❌ Failed to authenticate with Keycloak admin"
  exit 1
fi

echo "✅ Authenticated with Keycloak admin"

# Create development realm
create_realm() {
  echo "📋 Creating development realm: $REALM"
  
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"realm\": \"$REALM\",
      \"displayName\": \"Modulo Development\",
      \"enabled\": true,
      \"registrationAllowed\": true,
      \"passwordPolicy\": \"length(8)\",
      \"accessTokenLifespan\": 3600,
      \"refreshTokenMaxReuse\": 0,
      \"ssoSessionMaxLifespan\": 86400,
      \"attributes\": {
        \"displayName\": \"Modulo Development Environment\"
      }
    }" || echo "Realm might already exist"
}

# Create development clients
create_clients() {
  echo "🔧 Creating development clients"
  
  # Frontend client
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"modulo-frontend-dev\",
      \"name\": \"Modulo Frontend (Dev)\",
      \"enabled\": true,
      \"publicClient\": true,
      \"redirectUris\": [\"http://localhost:3000/*\", \"http://127.0.0.1:3000/*\"],
      \"webOrigins\": [\"http://localhost:3000\", \"http://127.0.0.1:3000\"],
      \"protocol\": \"openid-connect\",
      \"attributes\": {
        \"post.logout.redirect.uris\": \"http://localhost:3000/logout\"
      }
    }"

  # Backend API client  
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"modulo-api-dev\",
      \"name\": \"Modulo API (Dev)\",
      \"enabled\": true,
      \"serviceAccountsEnabled\": true,
      \"authorizationServicesEnabled\": true,
      \"secret\": \"dev-api-secret-12345\",
      \"redirectUris\": [\"http://localhost:8081/*\"],
      \"webOrigins\": [\"*\"],
      \"protocol\": \"openid-connect\"
    }"
    
  echo "✅ Development clients created"
}

# Create demo users
create_demo_users() {
  echo "👥 Creating demo users"
  
  declare -A demo_users
  demo_users=(
    ["admin@modulo.dev"]="Admin User:admin:super_admin"
    ["alice.manager@modulo.dev"]="Alice Manager:alice123:workspace_admin"
    ["bob.developer@modulo.dev"]="Bob Developer:bob123:workspace_editor" 
    ["carol.viewer@modulo.dev"]="Carol Viewer:carol123:workspace_viewer"
    ["dave.tester@modulo.dev"]="Dave Tester:dave123:workspace_contributor"
  )
  
  for email in "${!demo_users[@]}"; do
    IFS=':' read -r full_name password role <<< "${demo_users[$email]}"
    first_name=$(echo "$full_name" | cut -d' ' -f1)
    last_name=$(echo "$full_name" | cut -d' ' -f2-)
    username=$(echo "$email" | cut -d'@' -f1)
    
    echo "  Creating user: $username ($email)"
    
    # Create user
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/users" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"username\": \"$username\",
        \"email\": \"$email\",
        \"firstName\": \"$first_name\",
        \"lastName\": \"$last_name\",
        \"enabled\": true,
        \"emailVerified\": true,
        \"attributes\": {
          \"tenant\": [\"modulo-dev\"],
          \"department\": [\"engineering\"],
          \"role\": [\"$role\"]
        }
      }"
      
    # Get user ID
    USER_ID=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
      -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
    
    # Set password
    curl -s -X PUT \
      "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"$password\",
        \"temporary\": false
      }"
      
    echo "    ✅ $username created with password: $password"
  done
}

# Create realm roles
create_roles() {
  echo "🏗️ Creating realm roles"
  
  declare -a roles=(
    "super_admin:Full system administration access"
    "tenant_admin:Organization-level administration"
    "workspace_admin:Workspace administration access"
    "workspace_editor:Content editing capabilities"
    "workspace_contributor:Content contribution access"
    "workspace_viewer:Read-only workspace access"
    "plugin_admin:Plugin management access"
    "plugin_user:Plugin usage access"
  )
  
  for role_def in "${roles[@]}"; do
    IFS=':' read -r role_name description <<< "$role_def"
    
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"$role_name\",
        \"description\": \"$description\"
      }"
      
    echo "  ✅ Role created: $role_name"
  done
}

# Configure client mappers
create_mappers() {
  echo "🗺️ Creating client mappers for token customization"
  
  # Get frontend client ID
  FRONTEND_CLIENT_ID=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo-frontend-dev" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
  
  # Role mapper
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"roles\",
      \"protocol\": \"openid-connect\",
      \"protocolMapper\": \"oidc-usermodel-realm-role-mapper\",
      \"config\": {
        \"multivalued\": \"true\",
        \"userinfo.token.claim\": \"true\",
        \"id.token.claim\": \"true\",
        \"access.token.claim\": \"true\",
        \"claim.name\": \"roles\",
        \"jsonType.label\": \"String\"
      }
    }"
    
  # Tenant mapper
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"tenant\",
      \"protocol\": \"openid-connect\",
      \"protocolMapper\": \"oidc-usermodel-attribute-mapper\",
      \"config\": {
        \"userinfo.token.claim\": \"true\",
        \"user.attribute\": \"tenant\",
        \"id.token.claim\": \"true\",
        \"access.token.claim\": \"true\",
        \"claim.name\": \"tenant\",
        \"jsonType.label\": \"String\"
      }
    }"
    
  echo "✅ Client mappers configured"
}

# Generate test configuration
generate_test_config() {
  echo "📝 Generating test configuration files"
  
  # Frontend environment
  cat > "$SCRIPT_DIR/.env.local" << EOF
REACT_APP_KEYCLOAK_URL=$KEYCLOAK_URL
REACT_APP_KEYCLOAK_REALM=$REALM
REACT_APP_KEYCLOAK_CLIENT_ID=modulo-frontend-dev
REACT_APP_API_URL=http://localhost:8081/api
EOF

  # Backend configuration
  cat > "$SCRIPT_DIR/application-dev.yml" << EOF
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: $KEYCLOAK_URL/realms/$REALM
          jwk-set-uri: $KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/certs

keycloak:
  realm: $REALM
  auth-server-url: $KEYCLOAK_URL
  ssl-required: none
  resource: modulo-api-dev
  credentials:
    secret: dev-api-secret-12345
  use-resource-role-mappings: true
EOF

  # Docker compose override
  cat > "$SCRIPT_DIR/docker-compose.dev.yml" << EOF
version: '3.8'
services:
  keycloak:
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    ports:
      - "8080:8080"
    command:
      - start-dev
      - --import-realm
      - --http-relative-path=/auth
      
  backend:
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - KEYCLOAK_REALM=$REALM
      - KEYCLOAK_URL=$KEYCLOAK_URL
    depends_on:
      - keycloak
EOF

  echo "✅ Configuration files generated"
}

# Main execution
main() {
  echo "Starting bootstrap process..."
  
  create_realm
  sleep 2
  
  create_roles
  sleep 1
  
  create_clients  
  sleep 1
  
  create_mappers
  sleep 1
  
  create_demo_users
  sleep 1
  
  generate_test_config
  
  echo
  echo "🎉 Bootstrap completed successfully!"
  echo
  echo "Demo Users:"
  echo "  admin@modulo.dev / admin (super_admin)"
  echo "  alice.manager@modulo.dev / alice123 (workspace_admin)"
  echo "  bob.developer@modulo.dev / bob123 (workspace_editor)"
  echo "  carol.viewer@modulo.dev / carol123 (workspace_viewer)"
  echo "  dave.tester@modulo.dev / dave123 (workspace_contributor)"
  echo
  echo "Configuration files created:"
  echo "  - .env.local (frontend)"
  echo "  - application-dev.yml (backend)" 
  echo "  - docker-compose.dev.yml (services)"
  echo
  echo "Next steps:"
  echo "  1. Start services: docker-compose -f docker-compose.dev.yml up -d"
  echo "  2. Access Keycloak: $KEYCLOAK_URL/admin (admin/admin)"
  echo "  3. Test login: Use any demo user credentials"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
```

## 🏃‍♂️ Smoke Test Checklist

### 🧪 Release Smoke Test Checklist

#### Pre-Release Validation
- [ ] **Keycloak Health Check**
  ```bash
  curl -f "$KEYCLOAK_URL/health" || exit 1
  ```
  
- [ ] **Realm Accessibility**
  ```bash
  curl -f "$KEYCLOAK_URL/realms/$REALM" || exit 1
  ```
  
- [ ] **Admin Authentication**
  ```bash
  ADMIN_TOKEN=$(get_admin_token)
  [ "$ADMIN_TOKEN" != "null" ] || exit 1
  ```

#### User Lifecycle Tests
- [ ] **Create Test User**
  ```bash
  ./scripts/create-user.sh "smoketest-$(date +%s)" "test@example.com" "Test" "User" "test-tenant"
  ```
  
- [ ] **Assign Role**
  ```bash
  ./scripts/assign-role.sh "smoketest-user" "workspace_viewer" "" "Smoke test"
  ```
  
- [ ] **Login Test**
  ```bash
  TOKEN=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -d "grant_type=password&client_id=modulo-frontend&username=smoketest-user&password=temp-password" | \
    jq -r '.access_token')
  [ "$TOKEN" != "null" ] || exit 1
  ```
  
- [ ] **Permission Verification**
  ```bash
  curl -f -H "Authorization: Bearer $TOKEN" "$MODULO_API_URL/api/me" || exit 1
  ```
  
- [ ] **Cleanup Test User**
  ```bash
  ./scripts/disable-user.sh "smoketest-user" "Smoke test cleanup"
  ```

#### SSO Integration Tests
- [ ] **Token Validation**
  ```bash
  curl -f -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token/introspect" \
    -d "token=$TOKEN&client_id=modulo-api&client_secret=$CLIENT_SECRET" || exit 1
  ```
  
- [ ] **Role Mapping**
  ```bash
  ROLES=$(echo "$TOKEN" | cut -d. -f2 | base64 -d | jq -r '.realm_access.roles[]')
  echo "$ROLES" | grep -q "workspace_viewer" || exit 1
  ```

#### Security Tests  
- [ ] **Invalid Token Rejection**
  ```bash
  curl -s -H "Authorization: Bearer invalid-token" "$MODULO_API_URL/api/me" | \
    grep -q "401\|403" || exit 1
  ```
  
- [ ] **Expired Token Handling**
  ```bash
  # Test with expired token (implementation specific)
  ```
  
- [ ] **Cross-tenant Prevention**
  ```bash
  # Verify tenant isolation (implementation specific)
  ```

#### Backup & Recovery Tests
- [ ] **Backup Creation**
  ```bash
  ./scripts/backup-realm.sh
  ls -la /secure/backups/keycloak/realm-backup-*.tar.gz || exit 1
  ```
  
- [ ] **Backup Verification**
  ```bash
  tar -tzf /secure/backups/keycloak/realm-backup-*.tar.gz | \
    grep -q "realm-export.json" || exit 1
  ```

#### Performance Tests
- [ ] **Response Time Check**
  ```bash
  RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "$KEYCLOAK_URL/realms/$REALM")
  [ $(echo "$RESPONSE_TIME < 1.0" | bc) -eq 1 ] || exit 1
  ```
  
- [ ] **Concurrent Login Test**
  ```bash
  # Run concurrent authentication requests
  for i in {1..10}; do
    curl -s "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" &
  done
  wait
  ```

### 🎯 Automated Smoke Test Script

```bash
#!/bin/bash
# Comprehensive smoke test suite

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env" 2>/dev/null || true

FAILED_TESTS=()
PASSED_TESTS=()

run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -n "Running: $test_name... "
  
  if eval "$test_command" &>/dev/null; then
    echo "✅ PASS"
    PASSED_TESTS+=("$test_name")
  else
    echo "❌ FAIL"
    FAILED_TESTS+=("$test_name")
  fi
}

echo "🚀 Starting Modulo Smoke Tests"
echo "================================"

# Infrastructure Tests
run_test "Keycloak Health" "curl -f $KEYCLOAK_URL/health"
run_test "Realm Access" "curl -f $KEYCLOAK_URL/realms/$REALM"
run_test "Admin Authentication" "[ \$(get_admin_token) != 'null' ]"

# User Management Tests
run_test "Create User" "./scripts/create-user.sh smoketest-\$(date +%s) test@example.com Test User test-tenant"
run_test "Login Test" "test_user_login"
run_test "Token Validation" "validate_test_token"

# Security Tests
run_test "Invalid Token Rejection" "test_invalid_token_rejection"
run_test "Permission Enforcement" "test_permission_enforcement"

# Backup Tests
run_test "Backup Creation" "./scripts/backup-realm.sh"
run_test "Backup Verification" "verify_backup_integrity"

# Performance Tests  
run_test "Response Time" "check_response_time"
run_test "Concurrent Requests" "test_concurrent_requests"

echo
echo "================================"
echo "Smoke Test Results"
echo "================================"
echo "✅ Passed: ${#PASSED_TESTS[@]}"
echo "❌ Failed: ${#FAILED_TESTS[@]}"

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo
  echo "Failed tests:"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  - $test"
  done
  exit 1
else
  echo
  echo "🎉 All smoke tests passed!"
  exit 0
fi
```

---

## 📚 Quick Reference

### 🔑 Common Commands
```bash
# Get admin token
get_admin_token

# Create user
./scripts/create-user.sh <username> <email> <first> <last> <tenant>

# Disable user
./scripts/disable-user.sh <username> <reason>

# Reset password  
./scripts/reset-password.sh <username>

# Assign role
./scripts/assign-role.sh <username> <role> <workspace> <justification>

# Backup realm
./scripts/backup-realm.sh

# Health check
./scripts/health-check.sh

# Bootstrap dev environment
./scripts/bootstrap-dev.sh
```

### 🚨 Emergency Procedures
- **Security Incident**: Disable user immediately → Revoke sessions → Audit access logs
- **Password Compromise**: Reset password → Force re-authentication → Notify security team
- **System Breach**: Rotate all credentials → Backup current state → Restore from clean backup
- **Service Outage**: Check health endpoints → Restart services → Verify functionality

### 📞 Contact Information
- **Security Team**: security@company.com
- **Platform Team**: platform@company.com  
- **On-call**: Use PagerDuty escalation policy

---

*This playbook is maintained by the Platform Security Team and should be updated quarterly or after any major security incidents.*
