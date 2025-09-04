# Smoke Test Checklist for Releases

This checklist provides comprehensive smoke tests to validate Modulo platform functionality after releases, focusing on user management, authentication, authorization, and critical system operations.

## 🎯 Overview

The smoke test checklist ensures that critical functionality works correctly after deployments. These tests should be executed in order and any failures must be resolved before considering a release successful.

**Estimated Time**: 30-45 minutes  
**Prerequisites**: Admin access to Keycloak and Modulo platform  
**Environment**: Should be run against staging environment first  

## 📋 Pre-Release Validation

### ✅ Infrastructure Health Checks

#### 1. Service Availability
- [ ] **Keycloak Health Check**
  ```bash
  curl -f "$KEYCLOAK_URL/health" || exit 1
  ```
  Expected: HTTP 200 with status "UP"

- [ ] **Keycloak Admin Console**
  ```bash
  curl -f "$KEYCLOAK_URL/admin/" || exit 1
  ```
  Expected: Admin console loads without errors

- [ ] **Realm Accessibility**
  ```bash
  curl -f "$KEYCLOAK_URL/realms/$REALM" || exit 1
  ```
  Expected: Realm configuration accessible

- [ ] **Backend API Health**
  ```bash
  curl -f "$MODULO_API_URL/actuator/health" || exit 1
  ```
  Expected: API responds with healthy status

- [ ] **Frontend Application**
  ```bash
  curl -f "$FRONTEND_URL" || exit 1
  ```
  Expected: Frontend loads without 5xx errors

- [ ] **Database Connectivity**
  ```bash
  curl -f "$MODULO_API_URL/actuator/health/db" || exit 1
  ```
  Expected: Database connection healthy

#### 2. Configuration Validation
- [ ] **Environment Variables Set**
  - `KEYCLOAK_URL` configured correctly
  - `REALM` matches deployment environment
  - `CLIENT_IDS` match registered clients
  - Database connection strings valid

- [ ] **Client Registration**
  ```bash
  # Verify all required clients exist
  CLIENTS=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/clients" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$CLIENTS" | jq -r '.[].clientId' | grep -q "modulo-frontend"
  echo "$CLIENTS" | jq -r '.[].clientId' | grep -q "modulo-api"
  ```
  Expected: All application clients registered

- [ ] **Realm Roles Present**
  ```bash
  curl -s -X GET "$KEYCLOAK_URL/admin/realms/$REALM/roles" -H "Authorization: Bearer $ADMIN_TOKEN" | \
  jq -r '.[].name' | grep -q "workspace_admin"
  ```
  Expected: Required roles exist

## 🔐 Authentication & Authorization Tests

### ✅ Admin Authentication Flow

#### 3. Keycloak Admin Access
- [ ] **Admin Console Login**
  - Navigate to `$KEYCLOAK_URL/admin/`
  - Login with admin credentials
  - Expected: Successfully access admin console

- [ ] **Realm Management Access**
  - Navigate to target realm in admin console
  - Verify access to Users, Roles, Clients sections
  - Expected: All sections accessible without errors

- [ ] **User Management Operations**
  ```bash
  # Test admin token retrieval
  ADMIN_TOKEN=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" | jq -r '.access_token')
  
  [ "$ADMIN_TOKEN" != "null" ] || exit 1
  ```
  Expected: Valid admin token obtained

### ✅ User Lifecycle Operations

#### 4. Create Test User
- [ ] **User Creation via API**
  ```bash
  TEST_USER="smoketest-$(date +%s)"
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$TEST_USER\",
      \"email\": \"$TEST_USER@example.com\",
      \"firstName\": \"Smoke\",
      \"lastName\": \"Test\",
      \"enabled\": true,
      \"emailVerified\": true
    }"
  ```
  Expected: HTTP 201, user created successfully

- [ ] **Verify User Exists**
  ```bash
  USER_DATA=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$TEST_USER" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  [ "$(echo "$USER_DATA" | jq '. | length')" -eq 1 ] || exit 1
  ```
  Expected: User found in realm

- [ ] **Set User Password**
  ```bash
  USER_ID=$(echo "$USER_DATA" | jq -r '.[0].id')
  curl -s -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/reset-password" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"password\",
      \"value\": \"SmokeTest123!\",
      \"temporary\": false
    }"
  ```
  Expected: HTTP 204, password set successfully

#### 5. Role Assignment
- [ ] **Assign Role to User**
  ```bash
  # Get workspace_viewer role
  ROLE_DATA=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/roles/workspace_viewer" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  ROLE_ID=$(echo "$ROLE_DATA" | jq -r '.id')
  
  # Assign role to user
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "[{\"id\": \"$ROLE_ID\", \"name\": \"workspace_viewer\"}]"
  ```
  Expected: HTTP 204, role assigned successfully

- [ ] **Verify Role Assignment**
  ```bash
  USER_ROLES=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  echo "$USER_ROLES" | jq -r '.[].name' | grep -q "workspace_viewer"
  ```
  Expected: Role appears in user's role mappings

### ✅ SSO Authentication Tests

#### 6. User Login Flow
- [ ] **Direct Login (Password Grant)**
  ```bash
  LOGIN_TOKEN=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend" \
    -d "username=$TEST_USER" \
    -d "password=SmokeTest123!" | jq -r '.access_token')
  
  [ "$LOGIN_TOKEN" != "null" ] || exit 1
  ```
  Expected: Valid access token obtained

- [ ] **Token Introspection**
  ```bash
  INTROSPECTION=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token/introspect" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=$LOGIN_TOKEN" \
    -d "client_id=modulo-api" \
    -d "client_secret=$CLIENT_SECRET")
  
  [ "$(echo "$INTROSPECTION" | jq -r '.active')" = "true" ] || exit 1
  ```
  Expected: Token is active and valid

- [ ] **Token Claims Validation**
  ```bash
  # Decode JWT payload
  TOKEN_PAYLOAD=$(echo "$LOGIN_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .)
  
  # Verify essential claims
  [ "$(echo "$TOKEN_PAYLOAD" | jq -r '.sub')" != "null" ] || exit 1
  [ "$(echo "$TOKEN_PAYLOAD" | jq -r '.email')" = "$TEST_USER@example.com" ] || exit 1
  [ "$(echo "$TOKEN_PAYLOAD" | jq -r '.realm_access.roles[]' | grep -c 'workspace_viewer')" -eq 1 ] || exit 1
  ```
  Expected: JWT contains expected user information and roles

#### 7. API Authorization Tests
- [ ] **Authorized API Access**
  ```bash
  API_RESPONSE=$(curl -s -X GET \
    "$MODULO_API_URL/api/me" \
    -H "Authorization: Bearer $LOGIN_TOKEN")
  
  [ "$(echo "$API_RESPONSE" | jq -r '.username')" = "$TEST_USER" ] || exit 1
  ```
  Expected: User profile returned successfully

- [ ] **Role-Based Access Control**
  ```bash
  # Test viewer can read but not write
  READ_RESPONSE=$(curl -s -X GET \
    "$MODULO_API_URL/api/notes" \
    -H "Authorization: Bearer $LOGIN_TOKEN")
  
  [ "$(curl -o /dev/null -s -w '%{http_code}' -X POST \
    "$MODULO_API_URL/api/notes" \
    -H "Authorization: Bearer $LOGIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{\"title\":\"test\",\"content\":\"test\"}')" -eq 403 ] || exit 1
  ```
  Expected: Read access granted, write access denied

- [ ] **Invalid Token Rejection**
  ```bash
  INVALID_RESPONSE_CODE=$(curl -o /dev/null -s -w '%{http_code}' \
    "$MODULO_API_URL/api/me" \
    -H "Authorization: Bearer invalid-token-here")
  
  [ "$INVALID_RESPONSE_CODE" -eq 401 ] || exit 1
  ```
  Expected: HTTP 401 Unauthorized

### ✅ Frontend Integration Tests

#### 8. Frontend Authentication
- [ ] **Login Page Load**
  - Navigate to `$FRONTEND_URL/login`
  - Expected: Login form loads without JavaScript errors

- [ ] **Keycloak Redirect**
  - Click "Login" button
  - Expected: Redirected to Keycloak login page

- [ ] **Login Flow Completion**
  - Enter test user credentials
  - Expected: Successful login and redirect to dashboard

- [ ] **Protected Route Access**
  - Navigate to protected routes
  - Expected: Access granted with valid session

- [ ] **Logout Flow**
  - Click logout
  - Expected: Session cleared, redirected to public page

## 🔄 System Operations Tests

### ✅ User Management Operations

#### 9. User Modification
- [ ] **Update User Profile**
  ```bash
  curl -s -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"firstName\": \"Updated\",
      \"lastName\": \"Name\",
      \"attributes\": {\"department\": [\"testing\"]}
    }"
  ```
  Expected: HTTP 204, profile updated successfully

- [ ] **Disable User**
  ```bash
  curl -s -X PUT \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"enabled\": false}"
  ```
  Expected: HTTP 204, user disabled successfully

- [ ] **Verify Disabled User Cannot Login**
  ```bash
  DISABLED_LOGIN=$(curl -s -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=modulo-frontend" \
    -d "username=$TEST_USER" \
    -d "password=SmokeTest123!")
  
  [ "$(echo "$DISABLED_LOGIN" | jq -r '.error')" != "null" ] || exit 1
  ```
  Expected: Login fails with appropriate error

#### 10. Role Management
- [ ] **Remove Role from User**
  ```bash
  curl -s -X DELETE \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "[{\"id\": \"$ROLE_ID\", \"name\": \"workspace_viewer\"}]"
  ```
  Expected: HTTP 204, role removed successfully

- [ ] **Verify Role Removal**
  ```bash
  REMAINING_ROLES=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/role-mappings/realm" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  ! echo "$REMAINING_ROLES" | jq -r '.[].name' | grep -q "workspace_viewer"
  ```
  Expected: Role no longer appears in user's mappings

### ✅ Session Management

#### 11. Session Operations
- [ ] **List Active Sessions**
  ```bash
  SESSIONS=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/sessions" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  [ "$(echo "$SESSIONS" | jq '. | length')" -ge 0 ] || exit 1
  ```
  Expected: Sessions list retrieved successfully

- [ ] **Logout User Sessions**
  ```bash
  curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID/logout" \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  ```
  Expected: HTTP 204, sessions terminated successfully

### ✅ Backup & Recovery Validation

#### 12. Configuration Backup
- [ ] **Export Realm Configuration**
  ```bash
  REALM_EXPORT=$(curl -s -X POST \
    "$KEYCLOAK_URL/admin/realms/$REALM/partial-export" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"exportUsers\": false, \"exportClients\": true, \"exportGroupsAndRoles\": true}")
  
  [ "$(echo "$REALM_EXPORT" | jq -r '.realm')" = "$REALM" ] || exit 1
  ```
  Expected: Realm configuration exported successfully

- [ ] **Validate Export Content**
  ```bash
  # Verify essential components in export
  [ "$(echo "$REALM_EXPORT" | jq '.roles | length')" -gt 0 ] || exit 1
  [ "$(echo "$REALM_EXPORT" | jq '.clients | length')" -gt 0 ] || exit 1
  ```
  Expected: Export contains roles and clients

## 🧹 Test Cleanup

### ✅ Remove Test Data

#### 13. Delete Test User
- [ ] **Remove Test User**
  ```bash
  curl -s -X DELETE \
    "$KEYCLOAK_URL/admin/realms/$REALM/users/$USER_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  ```
  Expected: HTTP 204, test user deleted successfully

- [ ] **Verify User Deletion**
  ```bash
  DELETED_USER=$(curl -s -X GET \
    "$KEYCLOAK_URL/admin/realms/$REALM/users?username=$TEST_USER" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  [ "$(echo "$DELETED_USER" | jq '. | length')" -eq 0 ] || exit 1
  ```
  Expected: User no longer exists in realm

#### 14. Clean Test Sessions
- [ ] **Clear Any Remaining Test Sessions**
  ```bash
  # Clear admin token (force re-authentication next time)
  unset ADMIN_TOKEN
  unset LOGIN_TOKEN
  unset TEST_USER
  unset USER_ID
  ```
  Expected: Test variables cleared

## 🚨 Performance & Stress Tests

### ✅ Basic Performance Validation

#### 15. Response Time Tests
- [ ] **Authentication Response Time**
  ```bash
  AUTH_TIME=$(curl -o /dev/null -s -w '%{time_total}' -X POST \
    "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=modulo-api" \
    -d "client_secret=$CLIENT_SECRET")
  
  [ $(echo "$AUTH_TIME < 2.0" | bc -l) -eq 1 ] || exit 1
  ```
  Expected: Authentication completes in < 2 seconds

- [ ] **API Response Time**
  ```bash
  API_TIME=$(curl -o /dev/null -s -w '%{time_total}' \
    "$MODULO_API_URL/actuator/health")
  
  [ $(echo "$API_TIME < 1.0" | bc -l) -eq 1 ] || exit 1
  ```
  Expected: API health check completes in < 1 second

#### 16. Concurrent Request Handling
- [ ] **Concurrent Authentication**
  ```bash
  # Test 5 concurrent authentication requests
  for i in {1..5}; do
    curl -s -X POST \
      "$KEYCLOAK_URL/realms/$REALM/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=client_credentials" \
      -d "client_id=modulo-api" \
      -d "client_secret=$CLIENT_SECRET" &
  done
  wait
  ```
  Expected: All requests complete successfully

## 📊 Test Results Documentation

### ✅ Results Summary Template

```
==================================================
SMOKE TEST RESULTS - $(date)
==================================================

Environment: _______________
Keycloak Version: _______________
Modulo Version: _______________
Tester: _______________

INFRASTRUCTURE HEALTH:
[ ] Service Availability (6/6 checks)
[ ] Configuration Validation (3/3 checks)

AUTHENTICATION & AUTHORIZATION:
[ ] Admin Authentication (3/3 checks)
[ ] User Lifecycle (3/3 checks)
[ ] SSO Integration (4/4 checks)

SYSTEM OPERATIONS:
[ ] User Management (3/3 checks)
[ ] Role Management (2/2 checks)
[ ] Session Management (2/2 checks)
[ ] Backup Validation (2/2 checks)

PERFORMANCE:
[ ] Response Times (2/2 checks)
[ ] Concurrent Requests (1/1 checks)

CLEANUP:
[ ] Test Data Removal (2/2 checks)

OVERALL RESULT: [ ] PASS [ ] FAIL

NOTES:
_____________________________________________________
_____________________________________________________
_____________________________________________________

FAILED TESTS (if any):
_____________________________________________________
_____________________________________________________

NEXT ACTIONS:
_____________________________________________________
_____________________________________________________
```

## 🔄 Automated Test Script

For automated execution of these smoke tests, use the provided script:

```bash
#!/bin/bash
# Automated smoke test execution
# Usage: ./smoke-tests.sh [environment]

# Source the smoke test functions
source "$(dirname "$0")/smoke-test-functions.sh"

# Execute all tests in order
run_infrastructure_tests
run_authentication_tests  
run_system_operation_tests
run_performance_tests
cleanup_test_data

# Generate report
generate_test_report
```

## 📞 Escalation Procedures

**If Any Test Fails:**

1. **Immediate Actions:**
   - Stop deployment process
   - Document failing test details
   - Preserve system state for investigation

2. **Investigation:**
   - Check service logs for errors
   - Verify configuration settings
   - Test in isolation to reproduce issue

3. **Escalation:**
   - **Level 1**: Development Team (0-30 minutes)
   - **Level 2**: Platform Team (30-60 minutes)  
   - **Level 3**: Security Team (if auth/authz related)
   - **Level 4**: Engineering Management (critical issues)

4. **Communication:**
   - Update deployment status
   - Notify stakeholders
   - Document resolution steps

---

**Note**: This checklist should be executed by trained operators and updated regularly based on system changes and lessons learned from production incidents.
