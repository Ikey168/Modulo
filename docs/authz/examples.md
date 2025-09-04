# Role Implementation Examples

This document provides practical, real-world examples of implementing the Modulo RBAC system in various organizational scenarios.

## 🏢 Enterprise Scenarios

### Scenario 1: Software Development Company

#### Organization Structure
- **Company**: TechCorp Solutions
- **Teams**: Development, QA, Product Management, DevOps, Security
- **Projects**: Multiple client projects with confidential requirements

#### Role Implementation
```yaml
# Development Team Lead
dev_team_lead:
  name: "development_team_lead"
  tenant: "techcorp-solutions"
  description: "Lead developer with team management capabilities"
  permissions:
    - "notes:read:workspace:all-dev-projects"
    - "notes:write:workspace:assigned-projects"
    - "notes:share:workspace:assigned-projects"
    - "users:invite:workspace:assigned-projects"
    - "code-reviews:approve:workspace:assigned-projects"
  constraints:
    max_concurrent_projects: 3
    team_size_limit: 8
  inheritance:
    - "workspace_editor"
  
# QA Engineer
qa_engineer:
  name: "qa_engineer"
  tenant: "techcorp-solutions"
  description: "Quality assurance engineer with testing permissions"
  permissions:
    - "notes:read:workspace:assigned-projects"
    - "test-cases:create:workspace:assigned-projects"
    - "test-cases:execute:workspace:assigned-projects" 
    - "bugs:create:workspace:assigned-projects"
    - "reports:create:type:qa-reports"
  constraints:
    workspace_access: ["project-alpha", "project-beta"]
    excluded_content: ["financial", "hr"]

# Client Consultant (External)
client_consultant:
  name: "client_consultant_external"
  type: "external"
  tenant: "techcorp-solutions"
  description: "External consultant with limited project access"
  permissions:
    - "notes:read:workspace:client-project"
    - "comments:create:workspace:client-project"
    - "meetings:attend:workspace:client-project"
  constraints:
    workspace_access: ["specific-client-project"]
    ip_whitelist: ["203.0.113.0/24"]  # Client office IP range
    excluded_tags: ["internal", "confidential"]
  expiration:
    enabled: true
    duration: "180d"  # 6-month contract
    renewal_approval: ["project_manager", "client_liaison"]
```

### Scenario 2: Healthcare Organization

#### Organization Structure
- **Organization**: Regional Medical Center
- **Departments**: Cardiology, Oncology, Radiology, Administration, IT
- **Compliance**: HIPAA, SOX, local healthcare regulations

#### Role Implementation
```yaml
# Physician
physician:
  name: "physician"
  tenant: "regional-medical-center"
  description: "Licensed physician with patient care responsibilities"
  permissions:
    - "patient-notes:read:department:assigned"
    - "patient-notes:write:patient:assigned"
    - "medical-images:view:patient:assigned"
    - "prescriptions:create:patient:assigned"
    - "referrals:create:patient:assigned"
  constraints:
    department_access: ["cardiology", "general-medicine"]
    shift_hours: "06:00-18:00"  # Only during work hours
    requires_mfa: true
  compliance:
    hipaa_signed: true
    access_logging: "enhanced"
    data_retention: "7y"

# Nurse
registered_nurse:
  name: "registered_nurse"
  tenant: "regional-medical-center"
  description: "Registered nurse with patient care support"
  permissions:
    - "patient-notes:read:patient:assigned"
    - "vital-signs:record:patient:assigned"
    - "medications:administer:patient:assigned"
    - "care-plans:update:patient:assigned"
  constraints:
    department_access: ["cardiology"]
    supervisor_approval_required: ["medication-changes"]
  inheritance:
    - "healthcare_staff_base"

# Medical Records Administrator
medical_records_admin:
  name: "medical_records_administrator"
  tenant: "regional-medical-center"
  description: "Administrator for medical records management"
  permissions:
    - "patient-records:read:department:all"
    - "patient-records:archive:age:>7y"
    - "audit-logs:read:type:patient-access"
    - "compliance-reports:generate:department:all"
  constraints:
    purpose_limitation: ["administrative", "compliance"]
    no_clinical_access: true
    audit_trail: "comprehensive"
```

### Scenario 3: Financial Services Firm

#### Organization Structure
- **Firm**: Global Investment Partners
- **Divisions**: Trading, Research, Compliance, Risk Management, Client Services
- **Regulations**: SOX, Basel III, GDPR, local financial regulations

#### Role Implementation
```yaml
# Senior Trading Analyst
senior_trading_analyst:
  name: "senior_trading_analyst"
  tenant: "global-investment-partners"
  description: "Senior analyst with trading research capabilities"
  permissions:
    - "market-data:read:real-time:assigned-sectors"
    - "research-notes:create:sector:assigned-sectors"
    - "trading-models:read:team:trading-analytics"
    - "client-reports:create:type:sector-analysis"
  constraints:
    trading_hours: "09:00-16:00"  # Market hours
    sectors: ["technology", "healthcare"]
    max_position_size: 10000000  # $10M limit
  compliance:
    sox_compliance: true
    insider_trading_monitoring: true
    conflict_of_interest_check: true

# Compliance Officer
compliance_officer:
  name: "compliance_officer"
  tenant: "global-investment-partners"
  description: "Compliance monitoring and reporting"
  permissions:
    - "audit-logs:read:all"
    - "trading-records:read:compliance-review"
    - "violations:create:all"
    - "regulatory-reports:generate:all"
    - "user-permissions:review:all"
  constraints:
    read_only_enforcement: ["trading-data", "client-data"]
    retention_management: true
    independence_requirement: true
  separation_of_duties:
    cannot_combine_with: ["trader", "portfolio_manager"]

# Client Relationship Manager
client_relationship_manager:
  name: "client_relationship_manager"
  tenant: "global-investment-partners"
  description: "Manages client relationships and communications"
  permissions:
    - "client-profiles:read:assigned-clients"
    - "client-communications:create:assigned-clients"
    - "portfolio-performance:read:assigned-clients"
    - "meeting-notes:create:client:assigned-clients"
  constraints:
    client_assignment_required: true
    pii_access_limited: true
    communication_logging: true
```

## 🎓 Educational Institution Example

### Scenario 4: University Research Department

#### Organization Structure
- **Institution**: State University Research Division
- **Roles**: Faculty, Graduate Students, Undergrad Researchers, Lab Technicians, Administrators

#### Role Implementation
```yaml
# Principal Investigator (Faculty)
principal_investigator:
  name: "principal_investigator"
  tenant: "state-university-research"
  description: "Lead researcher with grant and lab management"
  permissions:
    - "research-data:read:lab:owned-labs"
    - "research-data:write:lab:owned-labs"
    - "grants:manage:project:assigned-grants"
    - "publications:author:lab:owned-labs"
    - "lab-equipment:reserve:lab:owned-labs"
    - "student-researchers:supervise:lab:owned-labs"
  constraints:
    labs: ["biotech-lab-1", "materials-lab-3"]
    grant_spending_limit: 500000  # $500K per year
    equipment_approval_required: true

# Graduate Research Assistant
graduate_research_assistant:
  name: "graduate_research_assistant"
  tenant: "state-university-research"
  description: "Graduate student conducting supervised research"
  permissions:
    - "research-data:read:project:assigned-projects"
    - "research-data:write:project:assigned-projects"
    - "lab-equipment:use:lab:assigned-labs"
    - "literature-database:access:unlimited"
    - "thesis-notes:create:student:own"
  constraints:
    supervisor_approval: ["data-publication", "equipment-reservation"]
    academic_year_only: true
    thesis_committee_oversight: true
  expiration:
    enabled: true
    duration: "4y"  # Typical PhD duration
    milestone_reviews: ["annual", "thesis-defense"]

# Undergraduate Researcher
undergraduate_researcher:
  name: "undergraduate_researcher"
  tenant: "state-university-research"
  description: "Undergraduate student in research program"
  permissions:
    - "research-data:read:project:assigned-tasks"
    - "lab-notebooks:write:student:own"
    - "safety-protocols:read:lab:assigned-labs"
    - "training-materials:access:level:undergraduate"
  constraints:
    supervision_required: true
    restricted_materials: ["hazardous", "controlled-substances"]
    semester_based: true
  expiration:
    enabled: true
    duration: "1-semester"
    renewable: true
```

## 🏭 Manufacturing Company Example

### Scenario 5: Automotive Parts Manufacturer

#### Organization Structure
- **Company**: PrecisionParts Manufacturing
- **Departments**: Production, Quality Control, Engineering, Supply Chain, Safety
- **Compliance**: ISO 9001, ISO 14001, OSHA, automotive industry standards

#### Role Implementation
```yaml
# Production Floor Supervisor
production_supervisor:
  name: "production_floor_supervisor"
  tenant: "precisionparts-manufacturing"
  description: "Supervisor overseeing production line operations"
  permissions:
    - "production-data:read:line:assigned-lines"
    - "work-orders:manage:line:assigned-lines"
    - "quality-reports:create:line:assigned-lines"
    - "safety-incidents:report:line:assigned-lines"
    - "staff-schedules:manage:department:production"
  constraints:
    production_lines: ["line-a", "line-b"]
    shift_coverage: ["day", "swing"]
    safety_certification_required: true
  inheritance:
    - "manufacturing_staff_base"

# Quality Control Inspector
quality_inspector:
  name: "quality_control_inspector"
  tenant: "precisionparts-manufacturing"
  description: "Inspector responsible for product quality validation"
  permissions:
    - "quality-data:create:product:all-products"
    - "inspection-reports:create:batch:assigned-batches"
    - "nonconformance:report:product:all-products"
    - "specifications:read:product:all-products"
    - "calibration-records:read:equipment:all-qc-equipment"
  constraints:
    independence_requirement: true  # Cannot inspect own production
    certification_required: ["ASQ-CQI", "ISO-9001-auditor"]
  separation_of_duties:
    cannot_combine_with: ["production_operator", "production_supervisor"]

# Supply Chain Analyst
supply_chain_analyst:
  name: "supply_chain_analyst"
  tenant: "precisionparts-manufacturing"
  description: "Analyst managing supplier relationships and logistics"
  permissions:
    - "supplier-data:read:category:assigned-categories"
    - "purchase-orders:create:supplier:approved-suppliers"
    - "inventory-reports:generate:category:assigned-categories"
    - "cost-analysis:create:category:assigned-categories"
  constraints:
    purchase_limit: 100000  # $100K per order
    supplier_categories: ["metals", "electronics", "fasteners"]
    approval_workflow: ["manager", "finance"]
```

## 🔧 Implementation Code Examples

### Role Definition Validator
```python
# utils/role_validator.py
from typing import Dict, List, Any
import re

class RoleValidator:
    def __init__(self):
        self.sensitive_permissions = [
            'admin', 'delete', 'system', 'user_management',
            'financial', 'pii', 'medical', 'confidential'
        ]
        
    def validate_role(self, role_definition: Dict[str, Any]) -> Dict[str, List[str]]:
        """Validate custom role definition against security policies."""
        errors = []
        warnings = []
        
        # Required fields validation
        required_fields = ['name', 'tenant', 'description', 'permissions']
        for field in required_fields:
            if field not in role_definition:
                errors.append(f"Required field '{field}' is missing")
        
        # Permission validation
        permissions = role_definition.get('permissions', [])
        self._validate_permissions(permissions, errors, warnings)
        
        # Constraint validation
        constraints = role_definition.get('constraints', {})
        self._validate_constraints(constraints, errors, warnings)
        
        # Expiration validation for high-privilege roles
        if self._is_high_privilege_role(permissions):
            self._validate_expiration(role_definition, errors, warnings)
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def _validate_permissions(self, permissions: List[str], errors: List[str], warnings: List[str]):
        """Validate individual permissions."""
        for permission in permissions:
            # Check for wildcard permissions
            if '*' in permission:
                errors.append(f"Wildcard permission not allowed: {permission}")
            
            # Check permission format
            if not re.match(r'^[a-zA-Z_-]+:[a-zA-Z_-]+:[a-zA-Z_-]+:[a-zA-Z_0-9-]*$', permission):
                warnings.append(f"Permission format may be invalid: {permission}")
            
            # Check for sensitive permissions
            for sensitive in self.sensitive_permissions:
                if sensitive in permission.lower():
                    warnings.append(f"Sensitive permission detected: {permission}")
    
    def _validate_constraints(self, constraints: Dict[str, Any], errors: List[str], warnings: List[str]):
        """Validate role constraints."""
        if not constraints:
            warnings.append("No constraints defined - consider adding security restrictions")
        
        # Validate IP restrictions format
        if 'ip_whitelist' in constraints:
            for ip in constraints['ip_whitelist']:
                if not re.match(r'^(\d{1,3}\.){3}\d{1,3}(/\d{1,2})?$', ip):
                    errors.append(f"Invalid IP address format: {ip}")
        
        # Validate time restrictions
        if 'allowed_hours' in constraints:
            time_pattern = r'^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$'
            if not re.match(time_pattern, constraints['allowed_hours']):
                errors.append("Invalid time format for allowed_hours (use HH:MM-HH:MM)")
```

### Role Assignment API
```javascript
// api/roles/assignment.js
const express = require('express');
const { validateRole, checkPermissions } = require('../middleware/auth');
const { RoleValidator } = require('../../utils/role_validator');

class RoleAssignmentAPI {
  constructor(dbConnection, auditLogger) {
    this.db = dbConnection;
    this.audit = auditLogger;
    this.validator = new RoleValidator();
  }

  async assignRole(userId, roleDefinition, assignedBy) {
    // Validate role definition
    const validation = this.validator.validate_role(roleDefinition);
    if (!validation.valid) {
      throw new Error(`Invalid role definition: ${validation.errors.join(', ')}`);
    }

    // Check if assigner has permission to grant this role
    const canAssign = await this.checkAssignmentPermission(assignedBy, roleDefinition);
    if (!canAssign) {
      throw new Error('Insufficient permissions to assign this role');
    }

    try {
      await this.db.transaction(async (trx) => {
        // Create role assignment
        await trx('user_roles').insert({
          user_id: userId,
          role_name: roleDefinition.name,
          tenant_id: roleDefinition.tenant,
          assigned_by: assignedBy,
          assigned_at: new Date(),
          expires_at: this.calculateExpiration(roleDefinition)
        });

        // Log assignment
        await this.audit.log({
          action: 'role_assigned',
          actor: assignedBy,
          target: userId,
          role: roleDefinition.name,
          tenant: roleDefinition.tenant,
          timestamp: new Date()
        });
      });

      return { success: true, message: 'Role assigned successfully' };
    } catch (error) {
      await this.audit.log({
        action: 'role_assignment_failed',
        actor: assignedBy,
        target: userId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  async revokeRole(userId, roleName, revokedBy, reason) {
    const canRevoke = await this.checkRevocationPermission(revokedBy, roleName);
    if (!canRevoke) {
      throw new Error('Insufficient permissions to revoke this role');
    }

    try {
      await this.db.transaction(async (trx) => {
        // Soft delete role assignment
        await trx('user_roles')
          .where({ user_id: userId, role_name: roleName })
          .update({
            revoked_by: revokedBy,
            revoked_at: new Date(),
            revocation_reason: reason,
            active: false
          });

        // Log revocation
        await this.audit.log({
          action: 'role_revoked',
          actor: revokedBy,
          target: userId,
          role: roleName,
          reason: reason,
          timestamp: new Date()
        });
      });

      return { success: true, message: 'Role revoked successfully' };
    } catch (error) {
      await this.audit.log({
        action: 'role_revocation_failed',
        actor: revokedBy,
        target: userId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  calculateExpiration(roleDefinition) {
    const expiration = roleDefinition.expiration;
    if (!expiration || !expiration.enabled) {
      return null;
    }

    const duration = expiration.duration;
    const match = duration.match(/^(\d+)([dwmy])$/);
    if (!match) {
      throw new Error('Invalid expiration duration format');
    }

    const [, amount, unit] = match;
    const now = new Date();
    
    switch (unit) {
      case 'd': return new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
      case 'w': return new Date(now.getTime() + amount * 7 * 24 * 60 * 60 * 1000);
      case 'm': return new Date(now.getFullYear(), now.getMonth() + parseInt(amount), now.getDate());
      case 'y': return new Date(now.getFullYear() + parseInt(amount), now.getMonth(), now.getDate());
      default: throw new Error('Invalid expiration unit');
    }
  }
}

module.exports = RoleAssignmentAPI;
```

These examples demonstrate how to implement the role matrix in real-world scenarios, providing practical guidance for various organizational structures and compliance requirements.
