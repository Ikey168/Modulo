# Custom Role Migration Guide

This document provides comprehensive guidance for migrating to the new role-based access control system and creating custom roles within the Modulo platform.

## 🎯 Migration Overview

The migration from legacy permission systems to the new RBAC matrix involves careful planning, phased rollout, and comprehensive testing to ensure business continuity while enhancing security.

## 🔄 Migration Phases

### Phase 1: Assessment & Mapping (Weeks 1-2)

#### Current State Analysis
1. **Legacy Role Inventory**
   ```bash
   # Audit existing roles
   SELECT DISTINCT role_name, COUNT(*) as user_count 
   FROM user_roles 
   GROUP BY role_name 
   ORDER BY user_count DESC;
   ```

2. **Permission Mapping Matrix**
   | Legacy Role | New Role(s) | Migration Notes |
   |-------------|-------------|-----------------|
   | `admin` | `workspace_admin` + `tenant_member` | Split administrative scope |
   | `power_user` | `workspace_editor` | Reduced privilege scope |
   | `editor` | `workspace_contributor` | Maintained editing capabilities |
   | `viewer` | `workspace_viewer` | Direct mapping |
   | `guest` | `note_viewer` (specific notes) | More granular access |

3. **Risk Assessment**
   - **High Risk**: Administrative role changes
   - **Medium Risk**: Permission scope reductions  
   - **Low Risk**: Role name changes without permission changes

### Phase 2: Preparation & Testing (Weeks 3-4)

#### Test Environment Setup
```yaml
# migration-config.yml
migration:
  phases:
    - name: "admin_users"
      users: ["admin1@company.com", "admin2@company.com"]
      strategy: "manual_approval"
    - name: "power_users"  
      users_query: "role = 'power_user'"
      strategy: "automated_with_review"
    - name: "standard_users"
      users_query: "role IN ('editor', 'viewer')"
      strategy: "automated"

rollback:
  enabled: true
  backup_tables: ["user_roles", "permissions", "role_mappings"]
  rollback_script: "scripts/rollback_migration.sql"
```

#### Migration Scripts
```sql
-- Create backup tables
CREATE TABLE user_roles_backup AS SELECT * FROM user_roles;
CREATE TABLE permissions_backup AS SELECT * FROM permissions;

-- Migration stored procedure
DELIMITER $$
CREATE PROCEDURE MigrateUserRole(
  IN p_user_id VARCHAR(255),
  IN p_legacy_role VARCHAR(100),
  IN p_new_roles JSON,
  IN p_tenant_id VARCHAR(255)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  
  START TRANSACTION;
  
  -- Log migration attempt
  INSERT INTO migration_log (user_id, legacy_role, new_roles, timestamp, status)
  VALUES (p_user_id, p_legacy_role, p_new_roles, NOW(), 'IN_PROGRESS');
  
  -- Remove legacy role
  DELETE FROM user_roles WHERE user_id = p_user_id AND role_name = p_legacy_role;
  
  -- Add new roles
  INSERT INTO user_roles (user_id, role_name, tenant_id, granted_at)
  SELECT p_user_id, JSON_UNQUOTE(JSON_EXTRACT(role.value, '$.name')), p_tenant_id, NOW()
  FROM JSON_TABLE(p_new_roles, '$[*]' COLUMNS (value JSON PATH '$')) AS role;
  
  -- Update migration log
  UPDATE migration_log 
  SET status = 'COMPLETED', completed_at = NOW()
  WHERE user_id = p_user_id AND legacy_role = p_legacy_role;
  
  COMMIT;
END$$
DELIMITER ;
```

### Phase 3: Staged Rollout (Weeks 5-8)

#### Week 5: Administrative Users
```javascript
// Migrate administrative users first
const adminMigration = {
  userGroups: ['system_admins', 'tenant_admins'],
  strategy: 'manual_approval',
  rollbackWindow: '24h',
  monitoring: 'enhanced'
};

await migrateUserGroup(adminMigration);
```

#### Week 6: Power Users
```javascript
// Migrate power users with automated approval
const powerUserMigration = {
  userQuery: "role IN ('power_user', 'advanced_editor')",
  strategy: 'automated_with_notification',
  rollbackWindow: '12h',
  batchSize: 50
};

await migrateBatch(powerUserMigration);
```

#### Week 7-8: Standard Users
```javascript
// Bulk migrate standard users
const standardMigration = {
  userQuery: "role IN ('editor', 'viewer', 'guest')",
  strategy: 'automated',
  rollbackWindow: '6h',
  batchSize: 200
};

await migrateBulk(standardMigration);
```

### Phase 4: Validation & Cleanup (Week 9)

#### Migration Validation
```sql
-- Verify all users migrated
SELECT 
  COUNT(*) as total_users,
  SUM(CASE WHEN migrated = 1 THEN 1 ELSE 0 END) as migrated_users,
  SUM(CASE WHEN migrated = 0 THEN 1 ELSE 0 END) as pending_users
FROM (
  SELECT user_id,
    CASE WHEN EXISTS(
      SELECT 1 FROM user_roles ur2 
      WHERE ur2.user_id = ur.user_id 
      AND ur2.role_name IN (SELECT name FROM new_roles)
    ) THEN 1 ELSE 0 END as migrated
  FROM user_roles ur
  WHERE role_name IN (SELECT name FROM legacy_roles)
) migration_status;
```

## 🛠️ Custom Role Development

### Custom Role Design Principles

#### 1. Principle of Least Privilege
```yaml
# Good: Specific, limited permissions
custom_role:
  name: "content_reviewer"
  permissions:
    - "notes:read:workspace:project-docs"
    - "comments:create:notes:project-docs"
    - "reviews:create:notes:project-docs"

# Bad: Overly broad permissions  
bad_role:
  name: "content_reviewer"
  permissions:
    - "notes:*:*:*"  # Too permissive
```

#### 2. Separation of Duties
```yaml
# Good: Separate roles for different functions
role_creator:
  name: "content_creator"
  permissions: ["notes:create", "notes:write:own"]

role_approver:
  name: "content_approver" 
  permissions: ["notes:approve", "notes:publish"]

# Bad: Combining conflicting duties
bad_role:
  name: "content_manager"
  permissions: 
    - "notes:create"
    - "notes:approve:own"  # Can approve own content
```

### Custom Role Templates

#### Template 1: Department-Specific Role
```yaml
name: "finance_analyst"
description: "Financial data analyst with limited editing permissions"
department: "finance"
tenant: "{{ tenant_id }}"
permissions:
  - resource: "notes"
    actions: ["read", "comment"]
    conditions:
      - "resource.tags CONTAINS 'financial'"
      - "resource.workspace IN user.assigned_workspaces"
  - resource: "reports"
    actions: ["read", "create", "update"]
    conditions:
      - "resource.type == 'financial_report'"
      - "resource.owner == user.id OR resource.collaborators CONTAINS user.id"
constraints:
  max_notes_per_day: 10
  allowed_workspaces: ["finance-reporting", "budget-planning"]
  ip_restrictions: ["10.0.0.0/8"]
expiration:
  enabled: true
  duration: "365d"
  renewal_required: true
```

#### Template 2: Integration Service Role
```yaml
name: "crm_integration_service"
type: "service_account"
description: "Service account for CRM system integration"
tenant: "{{ tenant_id }}"
permissions:
  - resource: "api"
    actions: ["read", "create"]
    conditions:
      - "endpoint IN ['/api/v1/notes', '/api/v1/contacts']"
  - resource: "webhooks"
    actions: ["create", "update", "delete"]
    conditions:
      - "webhook.source == 'crm_system'"
constraints:
  rate_limit: 1000  # requests per minute
  allowed_ips: ["{{ crm_system_ip }}"]
  required_headers: ["X-API-Key", "X-Integration-Source"]
monitoring:
  log_all_requests: true
  alert_on_errors: true
  daily_usage_report: true
```

#### Template 3: Time-Limited Project Role
```yaml
name: "project_consultant_{{ project_id }}"
description: "External consultant for specific project"
type: "temporary"
tenant: "{{ tenant_id }}"
project: "{{ project_id }}"
permissions:
  - resource: "notes"
    actions: ["read", "comment"]
    conditions:
      - "resource.workspace == '{{ project_workspace }}'"
      - "resource.visibility != 'confidential'"
  - resource: "meetings"
    actions: ["read", "attend"]
    conditions:
      - "meeting.project == '{{ project_id }}'"
constraints:
  workspace_access: ["{{ project_workspace }}"]
  excluded_tags: ["confidential", "internal-only"]
expiration:
  enabled: true
  duration: "90d"  # 3-month engagement
  auto_revoke: true
  extension_approval: ["project_manager", "security_team"]
```

### Role Testing Framework

#### Unit Tests for Custom Roles
```javascript
// test/roles/custom-role.test.js
describe('Custom Role: finance_analyst', () => {
  let testUser, financeRole;
  
  beforeEach(async () => {
    testUser = await createTestUser('finance-test@company.com');
    financeRole = await createRole('finance_analyst', {
      tenant: 'test-tenant',
      user: testUser.id
    });
  });

  it('should allow reading financial notes', async () => {
    const financialNote = await createNote({
      tags: ['financial'],
      workspace: 'finance-reporting'
    });
    
    const hasAccess = await checkPermission(testUser, 'notes:read', financialNote);
    expect(hasAccess).toBe(true);
  });

  it('should deny access to non-financial notes', async () => {
    const hrNote = await createNote({
      tags: ['hr'],
      workspace: 'finance-reporting'
    });
    
    const hasAccess = await checkPermission(testUser, 'notes:read', hrNote);
    expect(hasAccess).toBe(false);
  });

  it('should enforce daily creation limits', async () => {
    // Create maximum allowed notes
    for (let i = 0; i < 10; i++) {
      await createNote({ owner: testUser.id, type: 'financial_report' });
    }
    
    // 11th note should fail
    await expect(createNote({ 
      owner: testUser.id, 
      type: 'financial_report' 
    })).rejects.toThrow('Daily limit exceeded');
  });
});
```

#### Integration Tests
```javascript
describe('Role Migration Integration', () => {
  it('should migrate legacy admin to new role structure', async () => {
    const legacyAdmin = await createLegacyUser({
      email: 'admin@company.com',
      role: 'admin'
    });
    
    await migrateUser(legacyAdmin.id);
    
    const newRoles = await getUserRoles(legacyAdmin.id);
    expect(newRoles).toContainEqual({
      name: 'workspace_admin',
      tenant: 'company-corp'
    });
    expect(newRoles).toContainEqual({
      name: 'tenant_member',
      tenant: 'company-corp'
    });
  });
});
```

## 📊 Migration Monitoring & Metrics

### Key Metrics to Track
```sql
-- Migration success rate by role type
SELECT 
  legacy_role,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  ROUND(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM migration_log
GROUP BY legacy_role;

-- Permission usage after migration
SELECT 
  ur.role_name,
  p.permission_name,
  COUNT(*) as usage_count
FROM user_roles ur
JOIN role_permissions rp ON ur.role_name = rp.role_name  
JOIN permissions p ON rp.permission_id = p.id
JOIN audit_log al ON al.user_id = ur.user_id AND al.permission = p.permission_name
WHERE ur.created_at >= '2025-09-01'  -- After migration start
GROUP BY ur.role_name, p.permission_name
ORDER BY usage_count DESC;
```

### Dashboards & Alerts
```yaml
# monitoring/migration-dashboard.yml
dashboard:
  name: "RBAC Migration Progress"
  panels:
    - title: "Migration Progress"
      type: "stat"
      query: "SELECT COUNT(*) FROM migration_log WHERE status = 'COMPLETED'"
    - title: "Failed Migrations"
      type: "stat"  
      query: "SELECT COUNT(*) FROM migration_log WHERE status = 'FAILED'"
      alert:
        threshold: 5
        severity: "warning"
    - title: "Daily Migration Rate"
      type: "graph"
      query: "SELECT DATE(completed_at), COUNT(*) FROM migration_log WHERE status = 'COMPLETED' GROUP BY DATE(completed_at)"

alerts:
  - name: "High Migration Failure Rate"
    condition: "failed_migrations > 10"
    notification: "slack:#security-alerts"
  - name: "Permission Escalation Detected" 
    condition: "new_permissions > old_permissions * 1.2"
    notification: "email:security@company.com"
```

## 🛡️ Security Validation

### Security Checklist for Custom Roles
- [ ] **Least Privilege**: Role grants minimum necessary permissions
- [ ] **Separation of Duties**: No conflicting permissions combined
- [ ] **Time Limits**: Temporary roles have appropriate expiration
- [ ] **Scope Boundaries**: Clear tenant/workspace/resource boundaries
- [ ] **Approval Workflow**: Appropriate approval process defined
- [ ] **Audit Trail**: All role grants/changes logged
- [ ] **Testing**: Comprehensive test coverage for role behavior
- [ ] **Documentation**: Clear description and usage guidelines

### Automated Security Validation
```python
# scripts/validate_custom_role.py
def validate_custom_role(role_definition):
    """Validate custom role against security policies."""
    errors = []
    warnings = []
    
    # Check for overly broad permissions
    if '*' in str(role_definition.get('permissions', [])):
        errors.append("Wildcard permissions not allowed in custom roles")
    
    # Validate separation of duties
    sensitive_combinations = [
        ('create', 'approve'),  # Can't create and approve same resource
        ('write', 'audit'),     # Can't modify and audit same resource
    ]
    
    user_actions = extract_actions(role_definition['permissions'])
    for combo in sensitive_combinations:
        if all(action in user_actions for action in combo):
            errors.append(f"Conflicting permissions detected: {combo}")
    
    # Check for required constraints
    if not role_definition.get('constraints'):
        warnings.append("No constraints defined - consider adding rate limits or IP restrictions")
    
    # Validate expiration for high-privilege roles
    high_privilege_actions = ['admin', 'delete', 'system']
    if any(action in str(role_definition) for action in high_privilege_actions):
        if not role_definition.get('expiration', {}).get('enabled'):
            errors.append("High-privilege roles must have expiration enabled")
    
    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }
```

## 📚 Best Practices Summary

### For Administrators
1. **Plan Thoroughly**: Map legacy roles comprehensively before migration
2. **Test Extensively**: Use staging environment for migration testing
3. **Migrate Gradually**: Phased rollout minimizes risk
4. **Monitor Closely**: Track migration progress and user issues
5. **Have Rollback Plan**: Prepare for quick rollback if needed

### For Developers
1. **Follow Templates**: Use provided templates for consistency
2. **Validate Early**: Run security validation before deployment
3. **Test Thoroughly**: Comprehensive unit and integration testing
4. **Document Clearly**: Provide clear role descriptions and usage
5. **Monitor Usage**: Track role effectiveness post-deployment

### For Security Teams
1. **Review All Changes**: Approve all custom role definitions
2. **Audit Regularly**: Regular access reviews and certifications
3. **Monitor Anomalies**: Alert on unusual permission usage
4. **Maintain Standards**: Enforce security standards consistently
5. **Update Policies**: Keep security policies current with role changes

This migration guide ensures smooth transition to the new RBAC system while maintaining security and operational continuity.
