#!/bin/bash
# Bootstrap development environment with demo users and clients

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env" 2>/dev/null || true

# Default configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${REALM:-modulo-dev}"
ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

echo "🚀 Modulo Development Environment Bootstrap"
echo "Keycloak URL: $KEYCLOAK_URL"
echo "Realm: $REALM"
echo

# Function to get admin token
get_admin_token() {
  curl -s -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" | jq -r '.access_token' 2>/dev/null || echo "null"
}

# Wait for Keycloak to be ready
wait_for_keycloak() {
  echo "⏳ Waiting for Keycloak to be ready..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if curl -s -f "$KEYCLOAK_URL/health" >/dev/null 2>&1; then
      echo "✅ Keycloak is ready"
      return 0
    fi
    echo "  Retrying in 5 seconds... ($retries attempts left)"
    sleep 5
    retries=$((retries - 1))
  done
  echo "❌ Keycloak failed to start"
  return 1
}

# Get and validate admin token
authenticate_admin() {
  ADMIN_TOKEN=$(get_admin_token)
  if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to authenticate with Keycloak admin"
    echo "   Please verify KEYCLOAK_ADMIN_USER and KEYCLOAK_ADMIN_PASSWORD"
    return 1
  fi
  echo "✅ Authenticated with Keycloak admin"
  return 0
}

# Create or update development realm
create_realm() {
  echo "📋 Creating development realm: $REALM"
  
  # Check if realm already exists
  local existing_realm=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | jq -r '.realm // "null"')
  
  if [ "$existing_realm" != "null" ] && [ "$existing_realm" = "$REALM" ]; then
    echo "  ℹ️  Realm $REALM already exists, skipping creation"
    return 0
  fi
  
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
      \"loginWithEmailAllowed\": true,
      \"duplicateEmailsAllowed\": false,
      \"resetPasswordAllowed\": true,
      \"editUsernameAllowed\": false,
      \"attributes\": {
        \"displayName\": \"Modulo Development Environment\",
        \"_browser_header.contentSecurityPolicy\": \"frame-src 'self'; frame-ancestors 'self'; object-src 'none';\",
        \"_browser_header.xContentTypeOptions\": \"nosniff\",
        \"_browser_header.xRobotsTag\": \"none\",
        \"_browser_header.xFrameOptions\": \"SAMEORIGIN\",
        \"_browser_header.strictTransportSecurity\": \"max-age=31536000; includeSubDomains\"
      }
    }" >/dev/null
    
  if [ $? -eq 0 ]; then
    echo "  ✅ Realm $REALM created successfully"
  else
    echo "  ❌ Failed to create realm $REALM"
    return 1
  fi
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
    "note_owner:Note ownership permissions"
    "note_editor:Note editing permissions"
    "note_commenter:Note commenting permissions"
    "note_viewer:Note viewing permissions"
  )
  
  for role_def in "${roles[@]}"; do
    IFS=':' read -r role_name description <<< "$role_def"
    
    # Check if role already exists
    local existing_role=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/roles/$role_name" \
      -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null | jq -r '.name // "null"')
    
    if [ "$existing_role" != "null" ]; then
      echo "    ℹ️  Role $role_name already exists, skipping"
      continue
    fi
    
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/roles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"$role_name\",
        \"description\": \"$description\",
        \"composite\": false,
        \"clientRole\": false
      }" >/dev/null
      
    if [ $? -eq 0 ]; then
      echo "    ✅ Role created: $role_name"
    else
      echo "    ❌ Failed to create role: $role_name"
    fi
  done
}

# Create development clients
create_clients() {
  echo "🔧 Creating development clients"
  
  # Frontend client (public)
  echo "  Creating frontend client..."
  local frontend_exists=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo-frontend-dev" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r 'length')
  
  if [ "$frontend_exists" -eq 0 ]; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"clientId\": \"modulo-frontend-dev\",
        \"name\": \"Modulo Frontend (Dev)\",
        \"description\": \"Development frontend application\",
        \"enabled\": true,
        \"publicClient\": true,
        \"standardFlowEnabled\": true,
        \"implicitFlowEnabled\": false,
        \"directAccessGrantsEnabled\": true,
        \"redirectUris\": [
          \"http://localhost:3000/*\", 
          \"http://127.0.0.1:3000/*\",
          \"http://localhost:3001/*\",
          \"http://host.docker.internal:3000/*\"
        ],
        \"webOrigins\": [
          \"http://localhost:3000\", 
          \"http://127.0.0.1:3000\",
          \"http://localhost:3001\",
          \"http://host.docker.internal:3000\"
        ],
        \"protocol\": \"openid-connect\",
        \"attributes\": {
          \"post.logout.redirect.uris\": \"http://localhost:3000/logout+http://127.0.0.1:3000/logout\",
          \"pkce.code.challenge.method\": \"S256\"
        },
        \"defaultClientScopes\": [\"web-origins\", \"roles\", \"profile\", \"email\"],
        \"optionalClientScopes\": [\"address\", \"phone\", \"offline_access\", \"microprofile-jwt\"]
      }" >/dev/null
    echo "    ✅ Frontend client created"
  else
    echo "    ℹ️  Frontend client already exists"
  fi

  # Backend API client (confidential)
  echo "  Creating backend API client..."
  local backend_exists=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo-api-dev" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r 'length')
  
  if [ "$backend_exists" -eq 0 ]; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"clientId\": \"modulo-api-dev\",
        \"name\": \"Modulo API (Dev)\",
        \"description\": \"Development backend API service\",
        \"enabled\": true,
        \"publicClient\": false,
        \"serviceAccountsEnabled\": true,
        \"authorizationServicesEnabled\": true,
        \"standardFlowEnabled\": true,
        \"directAccessGrantsEnabled\": true,
        \"secret\": \"dev-api-secret-12345-very-secure\",
        \"redirectUris\": [\"http://localhost:8081/*\", \"http://127.0.0.1:8081/*\"],
        \"webOrigins\": [\"*\"],
        \"protocol\": \"openid-connect\",
        \"attributes\": {
          \"access.token.lifespan\": \"3600\",
          \"client.session.idle.timeout\": \"1800\",
          \"client.session.max.lifespan\": \"28800\"
        }
      }" >/dev/null
    echo "    ✅ Backend API client created"
  else
    echo "    ℹ️  Backend API client already exists"
  fi
  
  # Admin client (for management operations)
  echo "  Creating admin client..."
  local admin_exists=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo-admin-dev" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r 'length')
  
  if [ "$admin_exists" -eq 0 ]; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"clientId\": \"modulo-admin-dev\",
        \"name\": \"Modulo Admin (Dev)\",
        \"description\": \"Development administration interface\",
        \"enabled\": true,
        \"publicClient\": false,
        \"serviceAccountsEnabled\": true,
        \"secret\": \"admin-secret-dev-67890-secure\",
        \"directAccessGrantsEnabled\": true,
        \"protocol\": \"openid-connect\"
      }" >/dev/null
    echo "    ✅ Admin client created"
  else
    echo "    ℹ️  Admin client already exists"
  fi
}

# Create client mappers for token customization
create_mappers() {
  echo "🗺️ Creating client mappers for token customization"
  
  # Get frontend client ID
  local FRONTEND_CLIENT_ID=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients?clientId=modulo-frontend-dev" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
  
  if [ "$FRONTEND_CLIENT_ID" = "null" ]; then
    echo "    ❌ Frontend client not found"
    return 1
  fi
  
  # Check existing mappers
  local existing_mappers=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[].name')
  
  # Realm roles mapper
  if ! echo "$existing_mappers" | grep -q "realm-roles"; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"realm-roles\",
        \"protocol\": \"openid-connect\",
        \"protocolMapper\": \"oidc-usermodel-realm-role-mapper\",
        \"config\": {
          \"multivalued\": \"true\",
          \"userinfo.token.claim\": \"true\",
          \"id.token.claim\": \"true\",
          \"access.token.claim\": \"true\",
          \"claim.name\": \"realm_access.roles\",
          \"jsonType.label\": \"String\"
        }
      }" >/dev/null
    echo "    ✅ Realm roles mapper created"
  fi
    
  # Tenant attribute mapper
  if ! echo "$existing_mappers" | grep -q "tenant-mapper"; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"tenant-mapper\",
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
      }" >/dev/null
    echo "    ✅ Tenant attribute mapper created"
  fi
  
  # Groups mapper
  if ! echo "$existing_mappers" | grep -q "groups-mapper"; then
    curl -s -X POST \
      "$KEYCLOAK_URL/admin/realms/$REALM/clients/$FRONTEND_CLIENT_ID/protocol-mappers/models" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"groups-mapper\",
        \"protocol\": \"openid-connect\",
        \"protocolMapper\": \"oidc-group-membership-mapper\",
        \"config\": {
          \"full.path\": \"false\",
          \"id.token.claim\": \"true\",
          \"access.token.claim\": \"true\",
          \"claim.name\": \"groups\",
          \"userinfo.token.claim\": \"true\"
        }
      }" >/dev/null
    echo "    ✅ Groups mapper created"
  fi
}

# Create demo users with various roles
create_demo_users() {
  echo "👥 Creating demo users"
  
  declare -A demo_users=(
    ["admin@modulo.dev"]="Admin User:admin:super_admin:acme-corp:Administrator with full system access"
    ["alice.manager@modulo.dev"]="Alice Manager:alice123:workspace_admin:acme-corp:Project manager with workspace admin rights"
    ["bob.developer@modulo.dev"]="Bob Developer:bob123:workspace_editor:acme-corp:Senior developer with content editing capabilities"
    ["carol.viewer@modulo.dev"]="Carol Viewer:carol123:workspace_viewer:acme-corp:Stakeholder with read-only access"
    ["dave.tester@modulo.dev"]="Dave Tester:dave123:workspace_contributor:acme-corp:QA engineer with contribution access"
    ["eve.plugin@modulo.dev"]="Eve Plugin:eve123:plugin_admin:acme-corp:Plugin administrator and developer"
    ["frank.security@modulo.dev"]="Frank Security:frank123:tenant_admin:acme-corp:Security officer with tenant admin rights"
  )
  
  for email in "${!demo_users[@]}"; do
    IFS=':' read -r full_name password primary_role tenant description <<< "${demo_users[$email]}"
    
    local first_name=$(echo "$full_name" | cut -d' ' -f1)
    local last_name=$(echo "$full_name" | cut -d' ' -f2-)
    local username=$(echo "$email" | cut -d'@' -f1 | tr '.' '-')
    
    echo "  Creating user: $username ($email)"
    
    # Check if user already exists
    local existing_user=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
      -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r 'length')
    
    if [ "$existing_user" -gt 0 ]; then
      echo "    ℹ️  User $username already exists, skipping"
      continue
    fi
    
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
          \"tenant\": [\"$tenant\"],
          \"department\": [\"engineering\"],
          \"primary_role\": [\"$primary_role\"],
          \"description\": [\"$description\"],
          \"created_by\": [\"bootstrap-script\"],
          \"created_date\": [\"$(date -Iseconds)\"]
        },
        \"requiredActions\": []
      }" >/dev/null
      
    # Get user ID for password and role assignment
    local USER_ID=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$username" \
      -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.[0].id')
    
    if [ "$USER_ID" = "null" ]; then
      echo "    ❌ Failed to create user $username"
      continue
    fi
    
    # Set password
    curl -s -X PUT \
      "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"$password\",
        \"temporary\": false
      }" >/dev/null
      
    # Assign primary role
    local ROLE_ID=$(curl -s -X GET \
      "$KEYCLOAK_URL/admin/realms/$REALM/roles/$primary_role" \
      -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.id // "null"')
    
    if [ "$ROLE_ID" != "null" ]; then
      curl -s -X POST \
        "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "[{\"id\": \"$ROLE_ID\", \"name\": \"$primary_role\"}]" >/dev/null
    fi
      
    echo "    ✅ $username created with password: $password (role: $primary_role)"
  done
  
  echo "  📊 Demo user summary:"
  echo "    - Admin: admin@modulo.dev / admin (super_admin)"
  echo "    - Manager: alice.manager@modulo.dev / alice123 (workspace_admin)"
  echo "    - Developer: bob.developer@modulo.dev / bob123 (workspace_editor)"
  echo "    - Viewer: carol.viewer@modulo.dev / carol123 (workspace_viewer)" 
  echo "    - Tester: dave.tester@modulo.dev / dave123 (workspace_contributor)"
  echo "    - Plugin Admin: eve.plugin@modulo.dev / eve123 (plugin_admin)"
  echo "    - Security: frank.security@modulo.dev / frank123 (tenant_admin)"
}

# Generate configuration files for development
generate_configuration() {
  echo "📝 Generating development configuration files"
  
  # Frontend environment configuration
  cat > "$SCRIPT_DIR/.env.local" << EOF
# Frontend Development Configuration
# Generated by bootstrap script at $(date)

REACT_APP_KEYCLOAK_URL=$KEYCLOAK_URL
REACT_APP_KEYCLOAK_REALM=$REALM
REACT_APP_KEYCLOAK_CLIENT_ID=modulo-frontend-dev
REACT_APP_API_URL=http://localhost:8081/api
REACT_APP_WEBSOCKET_URL=ws://localhost:8081/ws
REACT_APP_VERSION=dev
REACT_APP_ENVIRONMENT=development

# Optional debugging
REACT_APP_DEBUG_KEYCLOAK=false
REACT_APP_LOG_LEVEL=debug
EOF

  # Backend Spring Boot configuration
  cat > "$SCRIPT_DIR/application-dev.yml" << EOF
# Backend Development Configuration
# Generated by bootstrap script at $(date)

server:
  port: 8081
  servlet:
    context-path: /api

spring:
  profiles:
    active: dev
  datasource:
    url: jdbc:h2:mem:modulo-dev
    driver-class-name: org.h2.Driver
    username: sa
    password: 
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
  h2:
    console:
      enabled: true
      path: /h2-console
  
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
    secret: dev-api-secret-12345-very-secure
  use-resource-role-mappings: true
  cors: true

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always

logging:
  level:
    org.springframework.security: DEBUG
    org.keycloak: DEBUG
    com.modulo: DEBUG
    org.springframework.web: DEBUG
  pattern:
    console: "%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"

# Development-specific settings
app:
  cors:
    allowed-origins: 
      - http://localhost:3000
      - http://127.0.0.1:3000
      - http://localhost:3001
  
  jwt:
    debug: true
    log-claims: true
EOF

  # Docker Compose override for development
  cat > "$SCRIPT_DIR/docker-compose.dev.yml" << EOF
# Development Docker Compose Override
# Generated by bootstrap script at $(date)

version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:22.0.0
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: dev-file
      KC_HTTP_RELATIVE_PATH: /
      KC_HOSTNAME_STRICT: false
      KC_HOSTNAME_STRICT_HTTPS: false
      KC_HTTP_ENABLED: true
      KEYCLOAK_LOGLEVEL: INFO
    ports:
      - "8080:8080"
    volumes:
      - keycloak-data:/opt/keycloak/data
    command:
      - start-dev
      - --import-realm
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
      
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: modulo_dev
      POSTGRES_USER: modulo
      POSTGRES_PASSWORD: dev-password-123
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init-dev.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U modulo -d modulo_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      SPRING_PROFILES_ACTIVE: dev
      KEYCLOAK_REALM: $REALM
      KEYCLOAK_URL: $KEYCLOAK_URL
      DATABASE_URL: jdbc:postgresql://postgres:5432/modulo_dev
      DATABASE_USERNAME: modulo
      DATABASE_PASSWORD: dev-password-123
    ports:
      - "8081:8081"
    depends_on:
      keycloak:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
      - ./backend/target:/app/target
    restart: unless-stopped
    
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    environment:
      REACT_APP_KEYCLOAK_URL: $KEYCLOAK_URL
      REACT_APP_KEYCLOAK_REALM: $REALM
      REACT_APP_KEYCLOAK_CLIENT_ID: modulo-frontend-dev
      REACT_APP_API_URL: http://localhost:8081/api
    ports:
      - "3000:3000"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  keycloak-data:
  postgres-data:

networks:
  default:
    driver: bridge
EOF

  # Environment template
  cat > "$SCRIPT_DIR/.env.template" << EOF
# Copy this file to .env and customize for your environment

# Keycloak Configuration
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin
REALM=modulo-dev

# Database Configuration  
DATABASE_URL=jdbc:postgresql://localhost:5432/modulo_dev
DATABASE_USERNAME=modulo
DATABASE_PASSWORD=dev-password-123

# API Configuration
API_URL=http://localhost:8081/api
FRONTEND_URL=http://localhost:3000

# Optional: External Services
# SMTP_HOST=localhost
# SMTP_PORT=587
# REDIS_URL=redis://localhost:6379
EOF

  # Makefile for development commands
  cat > "$SCRIPT_DIR/Makefile.dev" << EOF
# Development Makefile
# Generated by bootstrap script at $(date)

.PHONY: help bootstrap start stop restart clean logs test-users health

help: ## Show this help message
	@echo "Development Commands:"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \\033[36m%-15s\\033[0m %s\n", \$\$1, \$\$2 }' \$(MAKEFILE_LIST)

bootstrap: ## Bootstrap development environment
	@echo "🚀 Bootstrapping development environment..."
	./scripts/bootstrap-dev.sh

start: ## Start development services
	docker-compose -f docker-compose.dev.yml up -d
	@echo "🎯 Services starting... Check with 'make health'"

stop: ## Stop development services
	docker-compose -f docker-compose.dev.yml down

restart: ## Restart development services
	docker-compose -f docker-compose.dev.yml down
	docker-compose -f docker-compose.dev.yml up -d

clean: ## Clean up development environment
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f

logs: ## Follow service logs
	docker-compose -f docker-compose.dev.yml logs -f

health: ## Check service health
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:8080/health || echo "❌ Keycloak not ready"
	@curl -s http://localhost:8081/api/actuator/health || echo "❌ Backend not ready"
	@curl -s http://localhost:3000 || echo "❌ Frontend not ready"

test-users: ## Create test users (run after bootstrap)
	@echo "👥 Demo users available:"
	@echo "  admin@modulo.dev / admin (super_admin)"
	@echo "  alice.manager@modulo.dev / alice123 (workspace_admin)"
	@echo "  bob.developer@modulo.dev / bob123 (workspace_editor)"
	@echo "  carol.viewer@modulo.dev / carol123 (workspace_viewer)"
	@echo "  dave.tester@modulo.dev / dave123 (workspace_contributor)"
	@echo "  eve.plugin@modulo.dev / eve123 (plugin_admin)"
	@echo "  frank.security@modulo.dev / frank123 (tenant_admin)"

dev-urls: ## Show development URLs
	@echo "🌐 Development URLs:"
	@echo "  Frontend:     http://localhost:3000"
	@echo "  Backend API:  http://localhost:8081/api"
	@echo "  Keycloak:     http://localhost:8080"
	@echo "  H2 Console:   http://localhost:8081/api/h2-console"
	@echo "  Swagger UI:   http://localhost:8081/api/swagger-ui.html"

quick-start: bootstrap start ## Quick start: bootstrap + start services
	@echo "⏳ Waiting for services to be ready..."
	@sleep 30
	@make health
	@echo ""
	@make dev-urls
	@echo ""
	@make test-users
EOF

  echo "  ✅ Configuration files generated:"
  echo "    - .env.local (frontend environment)"
  echo "    - application-dev.yml (backend configuration)"
  echo "    - docker-compose.dev.yml (development services)"
  echo "    - .env.template (environment template)"
  echo "    - Makefile.dev (development commands)"
}

# Validate the bootstrap setup
validate_setup() {
  echo "🔍 Validating bootstrap setup"
  
  local validation_passed=true
  
  # Check realm exists and is accessible
  local realm_check=$(curl -s -X GET \
    "$KEYCLOAK_URL/realms/$REALM" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.realm // "null"')
  
  if [ "$realm_check" = "$REALM" ]; then
    echo "  ✅ Realm $REALM is accessible"
  else
    echo "  ❌ Realm $REALM validation failed"
    validation_passed=false
  fi
  
  # Check user count
  local user_count=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/count" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || echo "0")
  
  if [ "$user_count" -gt 0 ]; then
    echo "  ✅ $user_count users created"
  else
    echo "  ❌ No users found in realm"
    validation_passed=false
  fi
  
  # Check client count
  local client_count=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq '. | length' 2>/dev/null || echo "0")
  
  if [ "$client_count" -ge 3 ]; then
    echo "  ✅ $client_count clients configured"
  else
    echo "  ❌ Insufficient clients configured"
    validation_passed=false
  fi
  
  # Test login with a demo user
  echo "  🧪 Testing demo user authentication..."
  local test_token=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend-dev" \
    -d "username=bob-developer" \
    -d "password=bob123" | jq -r '.access_token // "null"')
  
  if [ "$test_token" != "null" ] && [ -n "$test_token" ]; then
    echo "  ✅ Demo user authentication successful"
  else
    echo "  ❌ Demo user authentication failed"
    validation_passed=false
  fi
  
  if [ "$validation_passed" = true ]; then
    echo "  🎉 All validation checks passed!"
    return 0
  else
    echo "  ⚠️  Some validation checks failed"
    return 1
  fi
}

# Main execution function
main() {
  local start_time=$(date +%s)
  
  echo "================================"
  echo "🚀 Modulo Development Bootstrap"
  echo "================================"
  echo "Started at: $(date)"
  echo
  
  # Pre-flight checks
  if ! command -v curl >/dev/null 2>&1; then
    echo "❌ curl is required but not installed"
    exit 1
  fi
  
  if ! command -v jq >/dev/null 2>&1; then
    echo "❌ jq is required but not installed"
    exit 1
  fi
  
  # Main bootstrap sequence
  if ! wait_for_keycloak; then
    exit 1
  fi
  
  if ! authenticate_admin; then
    exit 1
  fi
  
  create_realm || { echo "❌ Failed to create realm"; exit 1; }
  sleep 2
  
  create_roles || { echo "❌ Failed to create roles"; exit 1; }
  sleep 1
  
  create_clients || { echo "❌ Failed to create clients"; exit 1; }
  sleep 1
  
  create_mappers || { echo "❌ Failed to create mappers"; exit 1; }
  sleep 1
  
  create_demo_users || { echo "❌ Failed to create demo users"; exit 1; }
  sleep 2
  
  generate_configuration || { echo "❌ Failed to generate configuration"; exit 1; }
  
  if validate_setup; then
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo
    echo "🎉 Bootstrap completed successfully in ${duration}s!"
    echo
    echo "📋 Summary:"
    echo "  - Realm: $REALM"
    echo "  - Users: 7 demo users created"
    echo "  - Clients: 3 development clients"
    echo "  - Roles: 12 realm roles"
    echo "  - Configuration files: 5 generated"
    echo
    echo "🌐 Access URLs:"
    echo "  - Keycloak Admin: $KEYCLOAK_URL/admin (admin/admin)"
    echo "  - Keycloak Account: $KEYCLOAK_URL/realms/$REALM/account"
    echo "  - Frontend: http://localhost:3000 (after starting services)"
    echo "  - Backend API: http://localhost:8081/api (after starting services)"
    echo
    echo "🚀 Next Steps:"
    echo "  1. Start services: make -f Makefile.dev start"
    echo "  2. Check health: make -f Makefile.dev health"
    echo "  3. View URLs: make -f Makefile.dev dev-urls"
    echo "  4. Test users: make -f Makefile.dev test-users"
    echo
    echo "📖 For more information, see docs/authz/operator-playbook.md"
  else
    echo "❌ Bootstrap completed with validation errors"
    exit 1
  fi
}

# Command line argument parsing
case "${1:-}" in
  --help|-h)
    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --validate    Only run validation checks"
    echo "  --clean       Clean existing realm before bootstrap"
    echo
    echo "Environment variables:"
    echo "  KEYCLOAK_URL           Keycloak server URL (default: http://localhost:8080)"
    echo "  KEYCLOAK_ADMIN_USER    Admin username (default: admin)"
    echo "  KEYCLOAK_ADMIN_PASSWORD Admin password (default: admin)"
    echo "  REALM                  Target realm name (default: modulo-dev)"
    exit 0
    ;;
  --validate)
    wait_for_keycloak && authenticate_admin && validate_setup
    exit $?
    ;;
  --clean)
    echo "🧹 Cleaning existing realm..."
    wait_for_keycloak && authenticate_admin
    curl -s -X DELETE "$KEYCLOAK_URL/admin/realms/$REALM" -H "Authorization: Bearer $ADMIN_TOKEN" || true
    echo "Realm cleaned. Run without --clean to bootstrap fresh."
    exit 0
    ;;
  "")
    main
    ;;
  *)
    echo "Unknown option: $1"
    echo "Use --help for usage information"
    exit 1
    ;;
esac
