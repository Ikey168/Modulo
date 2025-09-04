# Role/Claim Matrix & Least-Privilege Defaults

This document defines the comprehensive role-based access control (RBAC) matrix for the Modulo platform, establishing least-privilege defaults and clear permission boundaries for auditable role design.

## 🎯 Overview

The Modulo platform implements a hierarchical role system with least-privilege defaults, ensuring that users receive only the minimum permissions necessary to perform their intended functions. This approach enhances security, simplifies compliance auditing, and facilitates smooth onboarding processes.

## 🏗️ Role Hierarchy & Architecture

### Role Categories
1. **System Roles** - Platform-wide administrative capabilities
2. **Workspace Roles** - Project/workspace-level permissions  
3. **Resource Roles** - Fine-grained resource-specific access
4. **Custom Roles** - Organization-defined role extensions

### Tenancy Model
- **Multi-tenant Architecture**: Each organization operates in isolated tenants
- **Workspace Isolation**: Projects and workspaces provide secondary boundaries
- **Claim Encoding**: JWT tokens include tenant and workspace context
- **Cross-tenant Prevention**: Built-in safeguards prevent data leakage

## 📊 Comprehensive Role Matrix

### System-Level Roles

| Role | Description | Read Notes | Write Notes | Share Notes | Manage Users | Admin Actions | Plugin Access | System Config |
|------|-------------|------------|-------------|-------------|--------------|---------------|---------------|---------------|
| **super_admin** | Platform superuser | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Full | ✅ All | ✅ Full |
| **system_admin** | System administrator | ✅ All | ✅ All | ✅ All | ✅ Tenant | ✅ Limited | ✅ Approved | ✅ Limited |
| **tenant_admin** | Organization administrator | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Workspace | ✅ Tenant | ❌ None |
| **security_officer** | Security and compliance | ✅ Audit | ❌ None | ❌ None | ✅ View | ✅ Security | ❌ None | ✅ Security |

### Workspace-Level Roles

| Role | Description | Read Notes | Write Notes | Share Notes | Invite Users | Workspace Admin | Plugin Install | Export Data |
|------|-------------|------------|-------------|-------------|--------------|-----------------|----------------|-------------|
| **workspace_owner** | Workspace creator/owner | ✅ All | ✅ All | ✅ All | ✅ All | ✅ Full | ✅ All | ✅ Full |
| **workspace_admin** | Workspace administrator | ✅ All | ✅ All | ✅ All | ✅ Limited | ✅ Limited | ✅ Approved | ✅ Full |
| **workspace_editor** | Content editor | ✅ All | ✅ All | ✅ Own+Shared | ✅ Limited | ❌ None | ✅ Approved | ✅ Own |
| **workspace_contributor** | Content contributor | ✅ Assigned | ✅ Assigned | ✅ Own | ❌ None | ❌ None | ❌ None | ✅ Own |
| **workspace_viewer** | Read-only access | ✅ Shared | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None |

### Resource-Level Roles

| Role | Description | Read Notes | Write Notes | Delete Notes | Share Notes | Tag Management | Comment | Version Control |
|------|-------------|------------|-------------|--------------|-------------|----------------|---------|-----------------|
| **note_owner** | Note creator | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ All | ✅ Own |
| **note_editor** | Note collaborator | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ Assigned | ✅ All | ✅ Assigned |
| **note_commenter** | Comment contributor | ✅ Assigned | ❌ None | ❌ None | ❌ None | ❌ None | ✅ All | ✅ View |
| **note_viewer** | Read-only access | ✅ Assigned | ❌ None | ❌ None | ❌ None | ❌ None | ✅ View | ✅ View |

### Plugin-Specific Roles

| Role | Description | Install Plugins | Configure Plugins | Manage Plugin Data | Plugin Admin | Marketplace Access |
|------|-------------|-----------------|-------------------|-------------------|--------------|-------------------|
| **plugin_admin** | Plugin system administrator | ✅ All | ✅ All | ✅ All | ✅ Full | ✅ Full |
| **plugin_manager** | Plugin configuration manager | ✅ Approved | ✅ Assigned | ✅ Managed | ✅ Limited | ✅ Read |
| **plugin_user** | Plugin consumer | ❌ None | ✅ Personal | ✅ Own | ❌ None | ✅ Browse |

## 🔒 Least-Privilege Defaults

### New User Defaults
- **Default Role**: `workspace_viewer`
- **Initial Permissions**: Read-only access to shared content
- **Escalation Process**: Explicit approval required for higher privileges
- **Trial Period**: 30-day evaluation period with limited permissions

### Permission Escalation Matrix

| From Role | To Role | Approval Required | Justification | Review Period |
|-----------|---------|------------------|---------------|---------------|
| `workspace_viewer` | `workspace_contributor` | Team Lead | Business need | 90 days |
| `workspace_contributor` | `workspace_editor` | Project Manager | Proven contribution | 180 days |
| `workspace_editor` | `workspace_admin` | Workspace Owner | Administrative need | 365 days |
| `workspace_admin` | `tenant_admin` | System Admin | Organizational role | Annual |
| Any Role | `super_admin` | Current Super Admin | Critical business need | Permanent review |

### Automatic Permission Reduction
- **Inactive Users**: Permissions reduced after 90 days of inactivity
- **Role Expiration**: Time-limited roles automatically expire
- **Access Reviews**: Quarterly reviews for elevated permissions
- **Compliance Triggers**: Automatic reduction based on policy violations

## 🏢 Tenancy & Claims Architecture

### JWT Token Structure
```json
{
  "sub": "user-uuid-12345",
  "email": "user@organization.com",
  "tenant": "org-acme-corp",
  "workspaces": ["ws-project-alpha", "ws-project-beta"],
  "roles": {
    "system": ["workspace_editor"],
    "tenant": {
      "org-acme-corp": ["tenant_member"]
    },
    "workspace": {
      "ws-project-alpha": ["workspace_admin"],
      "ws-project-beta": ["workspace_contributor"]
    },
    "resource": {
      "note-12345": ["note_owner"],
      "note-67890": ["note_editor"]
    }
  },
  "permissions": [
    "notes:read:ws-project-alpha",
    "notes:write:ws-project-alpha",
    "notes:read:note-12345",
    "notes:write:note-12345"
  ],
  "iat": 1725123456,
  "exp": 1725127056,
  "iss": "modulo-keycloak"
}
```

### Tenant Isolation Mechanisms
- **Database Isolation**: Row-level security with tenant filtering
- **API Filtering**: Middleware enforces tenant boundaries
- **Storage Isolation**: S3/blob storage prefixed by tenant ID
- **Network Isolation**: VPC/subnet separation for enterprise customers

### Cross-Tenant Prevention
- **Claim Validation**: Every request validates tenant context
- **Resource Ownership**: Resources tagged with tenant ownership
- **Access Logging**: All cross-tenant attempts logged and blocked
- **Audit Trails**: Comprehensive logging for compliance

## 🔄 Migration & Custom Role Guidelines

### Custom Role Creation Guidelines

#### 1. Role Definition Template
```yaml
name: "custom_role_name"
description: "Clear description of role purpose"
tenant: "tenant-id"
permissions:
  - resource: "notes"
    actions: ["read", "write"]
    conditions:
      - "resource.workspace IN user.workspaces"
      - "resource.visibility != 'private' OR resource.owner == user.id"
inheritance:
  - base_role: "workspace_contributor"
    inherit_permissions: true
expiration:
  enabled: true
  duration: "90d"
  renewable: true
approval_workflow:
  required: true
  approvers: ["workspace_admin", "tenant_admin"]
```

#### 2. Role Validation Criteria
- **Least Privilege**: Role grants minimum necessary permissions
- **Separation of Duties**: No conflicting permissions combined
- **Audit Requirements**: All actions must be auditable
- **Compliance Alignment**: Meets regulatory requirements
- **Business Justification**: Clear business need documented

### Migration Strategies

#### From Basic to Advanced RBAC
1. **Phase 1**: Implement basic roles (viewer, contributor, admin)
2. **Phase 2**: Add resource-level permissions
3. **Phase 3**: Introduce custom roles and complex policies
4. **Phase 4**: Implement attribute-based access control (ABAC)

#### Legacy System Integration
- **Identity Mapping**: Map existing roles to new role matrix
- **Permission Translation**: Convert legacy permissions to new format
- **Gradual Migration**: Phased rollout with fallback options
- **User Training**: Comprehensive training on new role system

## 🛡️ Security Considerations

### Role-Based Security Features
- **Principle of Least Privilege**: Users receive minimum required permissions
- **Separation of Duties**: Critical actions require multiple approvals
- **Defense in Depth**: Multiple layers of access control
- **Zero Trust**: Every request authenticated and authorized

### Administrative Safeguards
- **Admin Role Rotation**: Regular rotation of administrative roles
- **Multi-Factor Authentication**: Required for elevated permissions
- **Session Management**: Time-limited sessions with automatic logout
- **Emergency Access**: Break-glass procedures for critical situations

### Monitoring & Compliance
- **Access Logging**: All permission grants and denials logged
- **Anomaly Detection**: Unusual access patterns flagged
- **Regular Audits**: Quarterly access reviews and certifications
- **Compliance Reports**: Automated compliance reporting

## 📈 Role Usage Analytics

### Common Role Patterns
| Role | Usage % | Typical Use Cases | Recommended For |
|------|---------|------------------|-----------------|
| `workspace_viewer` | 45% | Content consumers, stakeholders | New users, external partners |
| `workspace_contributor` | 30% | Content creators, team members | Regular team members |
| `workspace_editor` | 20% | Content managers, leads | Team leads, subject experts |
| `workspace_admin` | 4% | Project managers | Project/workspace owners |
| `tenant_admin` | 1% | IT administrators | IT staff, compliance officers |

### Permission Grant Statistics
- **Average Permissions per User**: 12
- **Most Requested Permission**: `notes:read`
- **Most Restricted Permission**: `system:admin`
- **Permission Escalation Rate**: 15% quarterly
- **Permission Revocation Rate**: 8% quarterly

## 🚀 Implementation Examples

### Example 1: New Team Member Onboarding
```javascript
// 1. Create user with minimal permissions
const newUser = {
  id: "user-new-hire",
  email: "newhire@company.com",
  tenant: "company-corp",
  defaultRole: "workspace_viewer"
};

// 2. Grant workspace access
await grantWorkspaceAccess(newUser.id, "project-alpha", "workspace_viewer");

// 3. Time-limited trial access
await grantTemporaryRole(newUser.id, "workspace_contributor", "30d");
```

### Example 2: Project Lead Assignment
```javascript
// 1. Verify current permissions
const currentRoles = await getUserRoles("user-experienced");

// 2. Request escalation approval
const escalationRequest = {
  userId: "user-experienced",
  fromRole: "workspace_contributor",
  toRole: "workspace_admin",
  workspace: "project-beta",
  justification: "Leading new project initiative",
  approver: "manager-alice"
};

// 3. Grant approved permissions
await processRoleEscalation(escalationRequest);
```

### Example 3: Custom Role for Integration
```yaml
# Custom role for API integration service
name: "api_integration_service"
type: "service_account"
tenant: "company-corp"
permissions:
  - resource: "notes"
    actions: ["read", "create"]
    conditions: ["source == 'api_integration'"]
  - resource: "webhooks"
    actions: ["create", "update"]
    conditions: ["webhook.target IN allowed_endpoints"]
constraints:
  - max_requests_per_minute: 1000
  - allowed_ip_ranges: ["10.0.0.0/8"]
  - required_headers: ["X-API-Key", "X-Tenant-ID"]
```

## 📚 References & Standards

### Compliance Frameworks
- **SOC 2 Type II**: Access control requirements
- **GDPR**: Data processing and consent management
- **HIPAA**: Healthcare data protection (if applicable)
- **ISO 27001**: Information security management

### Industry Best Practices
- **NIST Cybersecurity Framework**: Access control guidelines
- **OWASP ASVS**: Application security verification
- **Zero Trust Architecture**: NIST SP 800-207
- **RBAC Standard**: NIST RBAC Standard (RBAC-2000)

### Internal Documentation
- [OPA Authorization Policies](../policy/authorization.rego)
- [Keycloak Integration Guide](../KEYCLOAK_INTEGRATION.md)
- [Security Architecture](../SECURITY.md)
- [API Authentication](../API_AUTHENTICATION.md)

---

## 📝 Maintenance Notes

**Document Version**: 1.0
**Last Updated**: September 2025
**Next Review**: December 2025
**Owner**: Security Team
**Reviewers**: Platform Team, Compliance Team

This role matrix serves as the authoritative source for all access control decisions within the Modulo platform. Any changes must be approved through the security review process and reflected in both policy code and documentation.
