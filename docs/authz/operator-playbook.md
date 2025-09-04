# Admin & Operator Playbook

This playbook provides comprehensive operational procedures for managing Keycloak and Modulo integration in production environments.

## 🎯 Overview

This document covers all operational aspects of the Enterprise Identity & Policy system including user lifecycle management, role administration, SSO troubleshooting, security operations, and system maintenance.

## 🏗️ System Architecture

```
User/Admin → Keycloak Admin Console → Keycloak Server → OPA Policies → Modulo Backend
                 ↓                        ↓              ↓                ↓
         Admin Scripts ←→ Keycloak API ←→ JWT Tokens ←→ Authorization Engine
```

## 👥 User Lifecycle Management

### Creating New Users

#### Via Keycloak Admin Console
1. **Access Admin Console**
   - Navigate to `https://keycloak.yourdomain.com/admin`
   - Login with admin credentials
   - Select the Modulo realm

2. **Create User**
   ```bash
   # Via CLI using admin-utils.sh
   ./scripts/admin-utils.sh create-user \
     --username "john.doe" \
     --email "john.doe@company.com" \
     --first-name "John" \
     --last-name "Doe" \
     --realm "modulo" \
     --temporary-password
   ```

3. **User Configuration**
   - Set temporary password (user must change on first login)
   - Enable email verification if required
   - Configure required actions (verify email, update password)

#### Automated User Creation
```bash
#!/bin/bash
# Bulk user creation from CSV
./scripts/admin-utils.sh bulk-create-users \
  --csv-file users.csv \
  --realm modulo \
  --default-role workspace_viewer \
  --send-welcome-email
```

### Disabling Users

#### Immediate Disable
```bash
# Disable user account
./scripts/admin-utils.sh disable-user \
  --username "john.doe" \
  --realm "modulo" \
  --reason "security_incident"

# Revoke all active sessions
./scripts/admin-utils.sh revoke-sessions \
  --username "john.doe" \
  --realm "modulo"
```

#### Scheduled Disable
```bash
# Schedule user disable (for departing employees)
./scripts/admin-utils.sh schedule-disable \
  --username "john.doe" \
  --disable-date "2025-09-15" \
  --notification-days "7,3,1"
```

### Password Management

#### Reset User Password
```bash
# Reset password with temporary flag
./scripts/admin-utils.sh reset-password \
  --username "john.doe" \
  --realm "modulo" \
  --temporary-password \
  --notify-user
```

#### Bulk Password Reset
```bash
# Reset passwords for security incident
./scripts/admin-utils.sh bulk-password-reset \
  --user-list "affected_users.txt" \
  --realm "modulo" \
  --force-change-on-login
```

#### Password Policy Enforcement
```bash
# Update password policy
./scripts/admin-utils.sh update-password-policy \
  --realm "modulo" \
  --min-length 12 \
  --require-uppercase \
  --require-lowercase \
  --require-digits \
  --require-special-chars \
  --history-count 12 \
  --max-age-days 90
```

## 🔐 Role Management

### Assigning Roles

#### Single User Role Assignment
```bash
# Assign workspace role
./scripts/admin-utils.sh assign-role \
  --username "john.doe" \
  --realm "modulo" \
  --role "workspace_editor" \
  --workspace "project-alpha" \
  --justification "Promotion to team lead"
```

#### Bulk Role Assignment
```bash
# Assign roles to multiple users
./scripts/admin-utils.sh bulk-assign-roles \
  --csv-file "role_assignments.csv" \
  --realm "modulo" \
  --approval-required \
  --audit-trail
```

#### Role Assignment with Time Limits
```bash
# Temporary elevated access
./scripts/admin-utils.sh assign-temporary-role \
  --username "john.doe" \
  --role "workspace_admin" \
  --duration "7d" \
  --workspace "project-alpha" \
  --justification "Project deadline support"
```

### Role Validation and Audit

#### Audit User Permissions
```bash
# Generate user permission report
./scripts/admin-utils.sh audit-user-permissions \
  --username "john.doe" \
  --realm "modulo" \
  --output-format "detailed" \
  --include-inherited
```

#### Role Compliance Check
```bash
# Validate role assignments against policy
./scripts/admin-utils.sh validate-role-compliance \
  --realm "modulo" \
  --policy-file "role-compliance.json" \
  --report-violations
```

#### Generate Audit Trail
```bash
# Export complete audit trail
./scripts/admin-utils.sh export-audit-trail \
  --realm "modulo" \
  --date-range "2025-08-01,2025-09-01" \
  --include-changes "roles,users,permissions" \
  --format "csv"
```

## 🚨 SSO Troubleshooting

### Common SSO Issues

#### User Cannot Login
```bash
# Diagnostic procedure
echo "=== SSO Login Troubleshooting ==="

# 1. Check user status
./scripts/admin-utils.sh check-user-status \
  --username "john.doe" \
  --realm "modulo"

# 2. Verify realm configuration
./scripts/admin-utils.sh verify-realm-config \
  --realm "modulo" \
  --check-clients \
  --check-identity-providers

# 3. Test authentication flow
./scripts/admin-utils.sh test-auth-flow \
  --username "john.doe" \
  --realm "modulo" \
  --client-id "modulo-frontend"

# 4. Check event logs
./scripts/admin-utils.sh get-user-events \
  --username "john.doe" \
  --realm "modulo" \
  --event-type "LOGIN_ERROR" \
  --last-hours 24
```

#### Token Validation Issues
```bash
# JWT token debugging
./scripts/admin-utils.sh debug-jwt-token \
  --token-file "user_token.jwt" \
  --verify-signature \
  --check-expiration \
  --validate-claims
```

#### OIDC Configuration Issues
```bash
# Validate OIDC endpoints
./scripts/admin-utils.sh validate-oidc-config \
  --realm "modulo" \
  --client-id "modulo-backend" \
  --test-endpoints \
  --verify-certificates
```

### Performance Issues

#### High Response Times
```bash
# Performance diagnostics
./scripts/admin-utils.sh performance-check \
  --realm "modulo" \
  --include-database-stats \
  --include-session-stats \
  --include-cache-stats
```

#### Database Connection Issues
```bash
# Database health check
./scripts/admin-utils.sh check-database-health \
  --connection-pool-stats \
  --slow-query-analysis \
  --connection-timeout-test
```

## 🔄 Security Operations

### Rotating Keycloak Admin Credentials

#### Admin Password Rotation
```bash
# Automated admin credential rotation
./scripts/admin-utils.sh rotate-admin-credentials \
  --current-password-file "/secure/admin_password" \
  --new-password-file "/secure/new_admin_password" \
  --verify-access \
  --update-config-files
```

#### Service Account Key Rotation
```bash
# Rotate service account keys
./scripts/admin-utils.sh rotate-service-keys \
  --service-account "modulo-backend-service" \
  --key-type "RS256" \
  --generate-new-keypair \
  --update-clients
```

#### Master Realm Security
```bash
# Secure master realm
./scripts/admin-utils.sh secure-master-realm \
  --disable-default-admin \
  --require-2fa \
  --limit-admin-sessions \
  --audit-admin-actions
```

### Certificate Management
```bash
# SSL certificate rotation
./scripts/admin-utils.sh rotate-ssl-certificates \
  --cert-file "/certs/new_cert.pem" \
  --key-file "/certs/new_key.pem" \
  --backup-current \
  --verify-chain \
  --restart-services
```

## 💾 Backup and Restore Operations

### Realm Backup

#### Complete Realm Export
```bash
# Export entire realm
./scripts/admin-utils.sh export-realm \
  --realm "modulo" \
  --output-file "modulo_realm_backup_$(date +%Y%m%d).json" \
  --include-users \
  --include-roles \
  --include-clients \
  --include-policies
```

#### Incremental Backup
```bash
# Export only recent changes
./scripts/admin-utils.sh incremental-backup \
  --realm "modulo" \
  --since-date "2025-09-01" \
  --output-dir "/backups/incremental/" \
  --compress
```

### Realm Restore

#### Full Realm Restore
```bash
# Restore from backup
./scripts/admin-utils.sh restore-realm \
  --backup-file "modulo_realm_backup_20250904.json" \
  --target-realm "modulo" \
  --verify-integrity \
  --dry-run  # Remove for actual restore
```

#### Selective Restore
```bash
# Restore specific components
./scripts/admin-utils.sh selective-restore \
  --backup-file "realm_backup.json" \
  --restore-users \
  --restore-roles \
  --skip-clients \
  --target-realm "modulo"
```

### Database Backup Integration
```bash
# Coordinate with database backups
./scripts/admin-utils.sh coordinated-backup \
  --realm "modulo" \
  --database-backup \
  --application-pause \
  --verify-consistency
```

## 📊 System Monitoring and Health Checks

### Health Check Procedures

#### Basic Health Check
```bash
# Comprehensive health check
./scripts/admin-utils.sh health-check \
  --realm "modulo" \
  --check-services \
  --check-database \
  --check-certificates \
  --check-integrations
```

#### Performance Monitoring
```bash
# Performance metrics collection
./scripts/admin-utils.sh collect-metrics \
  --duration "1h" \
  --metrics "response_time,throughput,error_rate" \
  --output-format "prometheus" \
  --alert-thresholds
```

### Alerting Configuration
```bash
# Configure monitoring alerts
./scripts/admin-utils.sh setup-alerts \
  --alert-type "authentication_failures" \
  --threshold "50_per_minute" \
  --notification-channel "security-team"

./scripts/admin-utils.sh setup-alerts \
  --alert-type "high_response_time" \
  --threshold "2000ms" \
  --notification-channel "ops-team"
```

## 🚨 Incident Response Procedures

### Security Incident Response

#### Suspected Breach
```bash
# Emergency security procedures
echo "=== SECURITY INCIDENT RESPONSE ==="

# 1. Immediate containment
./scripts/admin-utils.sh emergency-lockdown \
  --realm "modulo" \
  --disable-new-logins \
  --revoke-active-sessions \
  --notify-security-team

# 2. Evidence collection
./scripts/admin-utils.sh collect-incident-evidence \
  --realm "modulo" \
  --time-range "last_24h" \
  --include-audit-logs \
  --include-access-logs \
  --secure-storage

# 3. User impact assessment
./scripts/admin-utils.sh assess-user-impact \
  --realm "modulo" \
  --suspicious-activities \
  --affected-accounts-report
```

#### Compromised Account Response
```bash
# Compromised user account
./scripts/admin-utils.sh handle-compromised-account \
  --username "compromised.user" \
  --immediate-disable \
  --revoke-sessions \
  --reset-credentials \
  --audit-recent-activity \
  --notify-user-manager
```

### Service Outage Response
```bash
# Service restoration procedures
./scripts/admin-utils.sh service-recovery \
  --check-dependencies \
  --restart-services \
  --verify-configuration \
  --validate-connectivity \
  --run-smoke-tests
```

## 📋 Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Maintenance
```bash
#!/bin/bash
# Weekly maintenance script
./scripts/admin-utils.sh weekly-maintenance \
  --cleanup-expired-tokens \
  --archive-old-sessions \
  --update-certificate-warnings \
  --generate-usage-reports \
  --verify-backup-integrity
```

#### Monthly Maintenance
```bash
# Monthly security review
./scripts/admin-utils.sh monthly-security-review \
  --audit-admin-accounts \
  --review-role-assignments \
  --check-unused-accounts \
  --validate-password-policies \
  --generate-compliance-report
```

### Update Procedures
```bash
# Keycloak update process
./scripts/admin-utils.sh update-keycloak \
  --version "22.0.5" \
  --backup-before-update \
  --test-compatibility \
  --rollback-plan \
  --post-update-validation
```

## 📚 Reference Information

### Important File Locations
- **Configuration**: `/opt/keycloak/conf/keycloak.conf`
- **Logs**: `/var/log/keycloak/keycloak.log`
- **Backups**: `/backups/keycloak/`
- **Scripts**: `/scripts/admin-utils.sh`
- **Certificates**: `/opt/keycloak/certs/`

### Emergency Contacts
- **Security Team**: security@company.com
- **Platform Team**: platform@company.com  
- **On-call Engineer**: +1-555-ONCALL

### Useful Commands Reference
```bash
# Quick status check
./scripts/admin-utils.sh quick-status

# Get user info
./scripts/admin-utils.sh user-info --username "john.doe"

# List active sessions
./scripts/admin-utils.sh list-sessions --realm "modulo"

# Export audit logs
./scripts/admin-utils.sh export-logs --date-range "today"

# Test connectivity
./scripts/admin-utils.sh test-connectivity --all-endpoints
```

---

**Document Version**: 1.0  
**Last Updated**: September 2025  
**Next Review**: December 2025  
**Owner**: Platform Operations Team  
**Emergency Contact**: +1-555-PLATFORM
