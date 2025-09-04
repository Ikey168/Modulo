# Smoke Test Checklist for Keycloak + Modulo Integration

This checklist provides comprehensive testing procedures to validate the Enterprise Identity & Policy system after deployment or configuration changes.

## 🎯 Overview

Use this checklist to verify that all authentication, authorization, and integration components are functioning correctly in both development and production environments.

## 📋 Pre-Test Setup

### Environment Preparation
- [ ] **Environment Variables Set**
  ```bash
  export KEYCLOAK_URL="https://auth.yourcompany.com"
  export MODULO_FRONTEND_URL="https://app.yourcompany.com"
  export MODULO_BACKEND_URL="https://api.yourcompany.com"
  export TEST_REALM="modulo"
  ```

- [ ] **Test Credentials Available**
  - Admin credentials secured and accessible
  - Demo user accounts created and verified
  - Client secrets documented and stored securely

- [ ] **Tools and Dependencies**
  ```bash
  # Required tools
  which curl jq || echo "Install curl and jq"
  which openssl || echo "Install openssl"
  
  # Test user credentials
  TEST_USERNAME="test.user"
  TEST_PASSWORD="DevPassword123!"
  ```

## 🔐 Authentication Flow Tests

### 1. Keycloak Health Check
- [ ] **Server Health**
  ```bash
  # Basic health check
  curl -f "${KEYCLOAK_URL}/health" || echo "❌ Keycloak health check failed"
  
  # Detailed health metrics
  curl -f "${KEYCLOAK_URL}/health/ready" || echo "❌ Keycloak not ready"
  curl -f "${KEYCLOAK_URL}/health/live" || echo "❌ Keycloak not live"
  ```
  **Expected**: HTTP 200 responses with health status

- [ ] **Realm Discovery**
  ```bash
  # OIDC discovery endpoint
  curl -f "${KEYCLOAK_URL}/realms/${TEST_REALM}/.well-known/openid_configuration" | jq .
  ```
  **Expected**: Valid OIDC configuration with all required endpoints

### 2. Admin Authentication
- [ ] **Admin Console Access**
  ```bash
  # Test admin login
  ADMIN_TOKEN=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${KEYCLOAK_ADMIN_USER}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    -d "grant_type=password" \
    -d "client_id=admin-cli" | jq -r '.access_token')
  
  [[ "$ADMIN_TOKEN" != "null" && -n "$ADMIN_TOKEN" ]] || echo "❌ Admin authentication failed"
  ```
  **Expected**: Valid JWT access token

- [ ] **Admin API Access**
  ```bash
  # Test realm access
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${TEST_REALM}" | jq '.realm'
  ```
  **Expected**: Realm configuration returned

### 3. User Authentication
- [ ] **Password Flow (Direct Grant)**
  ```bash
  # Test user login
  USER_TOKEN=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${TEST_USERNAME}" \
    -d "password=${TEST_PASSWORD}" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend" | jq -r '.access_token')
  
  [[ "$USER_TOKEN" != "null" && -n "$USER_TOKEN" ]] || echo "❌ User authentication failed"
  ```
  **Expected**: Valid user JWT token

- [ ] **Token Validation**
  ```bash
  # Decode and validate JWT
  echo "$USER_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .
  
  # Verify token with userinfo endpoint
  curl -s -H "Authorization: Bearer $USER_TOKEN" \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/userinfo" | jq .
  ```
  **Expected**: Valid token claims and user information

### 4. Frontend Authentication Flow
- [ ] **Authorization Code Flow (PKCE)**
  ```bash
  # Generate PKCE parameters
  CODE_VERIFIER=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-43)
  CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr -d "=+/" | cut -c1-43)
  STATE=$(openssl rand -hex 16)
  
  # Authorization URL
  AUTH_URL="${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/auth"
  AUTH_URL="${AUTH_URL}?response_type=code"
  AUTH_URL="${AUTH_URL}&client_id=modulo-frontend"
  AUTH_URL="${AUTH_URL}&redirect_uri=http://localhost:3000/auth/callback"
  AUTH_URL="${AUTH_URL}&scope=openid%20profile%20email"
  AUTH_URL="${AUTH_URL}&state=${STATE}"
  AUTH_URL="${AUTH_URL}&code_challenge=${CODE_CHALLENGE}"
  AUTH_URL="${AUTH_URL}&code_challenge_method=S256"
  
  echo "Authorization URL: $AUTH_URL"
  # Manual verification: Open URL in browser and verify redirect
  ```
  **Expected**: Successful redirect to login page, then to callback URL with code

## 🔑 Authorization Policy Tests

### 5. Role-Based Access Control
- [ ] **User Role Assignment**
  ```bash
  # Check user roles
  USER_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${TEST_REALM}/users?username=${TEST_USERNAME}" | jq -r '.[0].id')
  
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${TEST_REALM}/users/${USER_ID}/role-mappings/realm" | jq '.[] | .name'
  ```
  **Expected**: Correct roles assigned to test user

- [ ] **Token Claims Verification**
  ```bash
  # Verify role claims in token
  echo "$USER_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.realm_access.roles'
  ```
  **Expected**: User roles present in JWT token

### 6. OPA Policy Integration
- [ ] **Policy Engine Health**
  ```bash
  # Test OPA health (if accessible)
  curl -f "http://localhost:8181/health" || echo "OPA health check (may not be exposed)"
  
  # Test policy evaluation through Envoy/Backend
  curl -H "Authorization: Bearer $USER_TOKEN" \
    "${MODULO_BACKEND_URL}/api/v1/notes" -v
  ```
  **Expected**: Proper authorization decisions based on user roles

### 7. Backend Authorization
- [ ] **Secured Endpoints**
  ```bash
  # Test without token (should fail)
  curl -v "${MODULO_BACKEND_URL}/api/v1/notes" 2>&1 | grep "401\|403"
  
  # Test with invalid token (should fail)
  curl -H "Authorization: Bearer invalid-token" \
    "${MODULO_BACKEND_URL}/api/v1/notes" -v 2>&1 | grep "401\|403"
  
  # Test with valid token (should succeed)
  curl -H "Authorization: Bearer $USER_TOKEN" \
    "${MODULO_BACKEND_URL}/api/v1/notes" -v
  ```
  **Expected**: Proper HTTP status codes (401/403 for unauthorized, 200 for authorized)

## 🌐 Client Configuration Tests

### 8. Frontend Client Configuration
- [ ] **Client Settings Verification**
  ```bash
  # Get frontend client configuration
  FRONTEND_CLIENT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${TEST_REALM}/clients?clientId=modulo-frontend")
  
  echo "$FRONTEND_CLIENT" | jq '.[0] | {
    clientId,
    publicClient,
    standardFlowEnabled,
    redirectUris,
    webOrigins
  }'
  ```
  **Expected**: Correct client configuration for SPA application

- [ ] **CORS Configuration**
  ```bash
  # Test CORS preflight
  curl -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Authorization" \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" -v
  ```
  **Expected**: Proper CORS headers in response

### 9. Backend Client Configuration
- [ ] **Service Account Authentication**
  ```bash
  # Get backend client details
  BACKEND_CLIENT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_URL}/admin/realms/${TEST_REALM}/clients?clientId=modulo-backend")
  
  BACKEND_CLIENT_ID=$(echo "$BACKEND_CLIENT" | jq -r '.[0].id')
  
  # Test service account token
  SERVICE_TOKEN=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=modulo-backend" \
    -d "client_secret=${BACKEND_CLIENT_SECRET}" | jq -r '.access_token')
  
  [[ "$SERVICE_TOKEN" != "null" && -n "$SERVICE_TOKEN" ]] || echo "❌ Service account auth failed"
  ```
  **Expected**: Valid service account token

## 📊 Performance and Load Tests

### 10. Authentication Performance
- [ ] **Token Generation Speed**
  ```bash
  # Measure token generation time
  time for i in {1..10}; do
    curl -s -X POST \
      "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=${TEST_USERNAME}" \
      -d "password=${TEST_PASSWORD}" \
      -d "grant_type=password" \
      -d "client_id=modulo-frontend" >/dev/null
  done
  ```
  **Expected**: Reasonable response times (< 500ms per request)

- [ ] **Concurrent Authentication**
  ```bash
  # Test concurrent logins
  seq 1 20 | xargs -n1 -P20 -I{} curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${TEST_USERNAME}" \
    -d "password=${TEST_PASSWORD}" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend" >/dev/null
  
  echo "Concurrent authentication test completed"
  ```
  **Expected**: No errors or timeouts under moderate load

### 11. Authorization Performance
- [ ] **Policy Evaluation Speed**
  ```bash
  # Test authorization decision speed
  time for i in {1..10}; do
    curl -s -H "Authorization: Bearer $USER_TOKEN" \
      "${MODULO_BACKEND_URL}/api/v1/notes" >/dev/null
  done
  ```
  **Expected**: Fast authorization decisions (< 100ms per request)

## 🔍 Integration Tests

### 12. End-to-End Workflow
- [ ] **Complete User Journey**
  ```bash
  # 1. User registration (if enabled)
  # 2. User login
  # 3. Token refresh
  # 4. Resource access
  # 5. User logout
  
  # Token refresh test
  REFRESH_TOKEN=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${TEST_USERNAME}" \
    -d "password=${TEST_PASSWORD}" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend" | jq -r '.refresh_token')
  
  # Use refresh token to get new access token
  NEW_TOKEN=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=refresh_token" \
    -d "refresh_token=${REFRESH_TOKEN}" \
    -d "client_id=modulo-frontend" | jq -r '.access_token')
  
  [[ "$NEW_TOKEN" != "null" && -n "$NEW_TOKEN" ]] || echo "❌ Token refresh failed"
  ```
  **Expected**: Successful token refresh

- [ ] **Session Management**
  ```bash
  # Test session info
  curl -s -H "Authorization: Bearer $USER_TOKEN" \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/userinfo" | jq .
  
  # Test logout
  curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/logout" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "refresh_token=${REFRESH_TOKEN}" \
    -d "client_id=modulo-frontend"
  ```
  **Expected**: Proper session management

### 13. Error Handling
- [ ] **Invalid Credentials**
  ```bash
  # Test with wrong password
  ERROR_RESPONSE=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${TEST_USERNAME}" \
    -d "password=wrongpassword" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend")
  
  echo "$ERROR_RESPONSE" | jq '.error'
  ```
  **Expected**: Proper error message and HTTP status

- [ ] **Account Lockout (Brute Force Protection)**
  ```bash
  # Test multiple failed attempts
  for i in {1..5}; do
    curl -s -X POST \
      "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "username=${TEST_USERNAME}" \
      -d "password=wrongpassword" \
      -d "grant_type=password" \
      -d "client_id=modulo-frontend" >/dev/null
  done
  
  # Check if account is locked
  LOCKOUT_RESPONSE=$(curl -s -X POST \
    "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${TEST_USERNAME}" \
    -d "password=${TEST_PASSWORD}" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend")
  
  echo "$LOCKOUT_RESPONSE" | jq '.error'
  ```
  **Expected**: Account lockout after repeated failures

## 🔒 Security Validation

### 14. SSL/TLS Configuration
- [ ] **Certificate Validation**
  ```bash
  # Check certificate details
  openssl s_client -connect $(echo $KEYCLOAK_URL | sed 's/https:\/\///'):443 -servername $(echo $KEYCLOAK_URL | sed 's/https:\/\///') </dev/null 2>/dev/null | openssl x509 -text -noout
  
  # Test SSL Labs rating (if public)
  # curl "https://api.ssllabs.com/api/v3/analyze?host=$(echo $KEYCLOAK_URL | sed 's/https:\/\///')"
  ```
  **Expected**: Valid certificate with good security rating

- [ ] **Security Headers**
  ```bash
  # Check security headers
  curl -I "${KEYCLOAK_URL}/realms/${TEST_REALM}/.well-known/openid_configuration" | grep -E "(Strict-Transport-Security|X-Content-Type-Options|X-Frame-Options|Content-Security-Policy)"
  ```
  **Expected**: Proper security headers present

### 15. Token Security
- [ ] **JWT Signature Verification**
  ```bash
  # Get JWKS
  JWKS=$(curl -s "${KEYCLOAK_URL}/realms/${TEST_REALM}/protocol/openid-connect/certs")
  echo "$JWKS" | jq '.keys[0]'
  
  # Verify token signature (requires JWT library)
  # jwt decode --verify --key="$PUBLIC_KEY" "$USER_TOKEN"
  ```
  **Expected**: Valid JWT signature verification

- [ ] **Token Expiration**
  ```bash
  # Check token expiration
  TOKEN_EXP=$(echo "$USER_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq '.exp')
  CURRENT_TIME=$(date +%s)
  
  if [[ $TOKEN_EXP -gt $CURRENT_TIME ]]; then
    echo "✅ Token is valid and not expired"
  else
    echo "❌ Token is expired"
  fi
  ```
  **Expected**: Token should be valid and properly expiring

## 📋 Release Validation Checklist

### 16. Production Readiness
- [ ] **Configuration Review**
  - [ ] All passwords changed from defaults
  - [ ] SSL/TLS properly configured
  - [ ] Database connections secure
  - [ ] Backup procedures in place
  - [ ] Monitoring configured

- [ ] **Security Hardening**
  - [ ] Admin console access restricted
  - [ ] Unnecessary endpoints disabled
  - [ ] Rate limiting configured
  - [ ] Security headers enabled
  - [ ] Audit logging active

- [ ] **Performance Validation**
  - [ ] Load testing completed
  - [ ] Database performance acceptable
  - [ ] Caching configured
  - [ ] Connection pooling optimized
  - [ ] Resource limits set

### 17. Monitoring and Alerting
- [ ] **Health Checks**
  ```bash
  # Test monitoring endpoints
  curl -f "${KEYCLOAK_URL}/health/ready"
  curl -f "${KEYCLOAK_URL}/metrics" 2>/dev/null || echo "Metrics endpoint not exposed (expected)"
  ```

- [ ] **Log Analysis**
  ```bash
  # Check for errors in recent logs
  # tail -n 100 /var/log/keycloak/keycloak.log | grep -i error
  ```

### 18. Documentation and Runbooks
- [ ] **Operational Documentation**
  - [ ] Operator playbook updated
  - [ ] Runbooks current
  - [ ] Contact information accurate
  - [ ] Escalation procedures clear

- [ ] **Recovery Procedures**
  - [ ] Backup restoration tested
  - [ ] Disaster recovery plan current
  - [ ] RTO/RPO requirements met
  - [ ] Communication plan ready

## ✅ Test Results Summary

### Test Execution Summary
```bash
# Generate test report
cat > smoke-test-results-$(date +%Y%m%d-%H%M%S).md << EOF
# Smoke Test Results

**Date**: $(date)
**Environment**: ${ENVIRONMENT:-development}
**Keycloak Version**: $(curl -s "${KEYCLOAK_URL}/admin/serverinfo" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.systemInfo.version // "unknown"')
**Realm**: ${TEST_REALM}

## Test Results
- [ ] Keycloak Health Check
- [ ] Admin Authentication
- [ ] User Authentication  
- [ ] Token Validation
- [ ] Authorization Policies
- [ ] Client Configuration
- [ ] Performance Tests
- [ ] Security Validation
- [ ] Integration Tests
- [ ] Error Handling

## Issues Found
(List any issues discovered during testing)

## Recommendations
(List any recommendations for improvement)

**Tested By**: ${USER}
**Next Test Date**: $(date -d "+1 week" +%Y-%m-%d)
EOF
```

### Sign-off
- [ ] **Development Team**: _________________ Date: _______
- [ ] **Security Team**: _________________ Date: _______  
- [ ] **Operations Team**: _________________ Date: _______
- [ ] **Product Owner**: _________________ Date: _______

---

**Document Version**: 1.0  
**Last Updated**: September 2025  
**Next Review**: October 2025  
**Owner**: Quality Assurance Team
