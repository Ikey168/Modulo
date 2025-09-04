## Summary

This PR implements comprehensive Rego policies for Notes RBAC/ABAC authorization as requested in issue #145, achieving 100% test coverage with 41/41 passing tests.

## Implementation Details

✅ **Authorization Policies (`policy/authorization.rego`)**
- Implements `notes.read`: owner, shared-with users, or admin role
- Implements `notes.write`: owner, editor role, or admin role  
- Implements `notes.admin`: admin role only
- Implements `notes.create`: any authenticated user with user role
- Implements `notes.delete`: owner or admin role

✅ **Tag Authorization Rules**
- Tag read access: owner, shared-with, admin, or public tags for users
- Tag write access: owner, editor role, or admin role
- Tag admin access: admin role only

✅ **Graph Link Authorization**
- Read access: admin role or users who can read both connected resources
- Write access: admin role, editor role, or users who own both resources
- Aligned with domain model for resource connections

✅ **Plugin Authorization (Capability-Based)**
- Execute: admin role, users with required scopes, or capability-based access
- Install: editor role or admin role
- Admin: admin role only
- Uses fine-grained scopes and claims for plugin actions

✅ **Input Schema Definition**
```json
{
  "user": {
    "id": "user-123",
    "roles": ["user", "editor", "admin"],
    "claims": {
      "scopes": ["read", "write"],
      "capabilities": {"allowed_plugins": ["plugin-1"]}
    }
  },
  "resource": {
    "type": "note|tag|plugin|graph_link",
    "owner_id": "user-123",
    "shared_with": ["user-456"]
  },
  "action": "read|write|admin|create|delete|execute"
}
```

✅ **100% Test Coverage (41/41 Tests Passing)**
- **Notes**: 12 test cases covering all CRUD operations
- **Tags**: 8 test cases including public/private scenarios  
- **Graph Links**: 6 test cases for connected resource permissions
- **Plugins**: 8 test cases for capability-based access
- **Default Deny**: 4 test cases for security boundaries
- **Edge Cases**: 3 additional boundary condition tests

✅ **Comprehensive Documentation**
- Complete policy documentation in `docs/policy/README.md`
- Input schema specification
- Authorization rule explanations
- Usage examples and integration guides
- Security considerations

✅ **Build System Integration**
- Added `make policy-test` for running unit tests
- Added `make policy-build` for creating policy bundles
- Added `make policy-fmt` for code formatting
- Policy bundle creation for deployment

## Testing Results

```bash
make policy-test
# PASS: 41/41 ✅
```

**Test Categories:**
- ✅ Notes authorization (read/write/admin/create/delete)
- ✅ Tag authorization with public/private access
- ✅ Graph link authorization based on connected resources
- ✅ Plugin capability-based authorization  
- ✅ Role hierarchy enforcement (admin > editor > user)
- ✅ Default deny behavior
- ✅ Input validation and edge cases

## Authorization Coverage

### Notes Domain
- **Owner access**: Full CRUD permissions on owned notes
- **Shared access**: Read-only access to shared notes
- **Role-based**: Editor can write any note, admin can do everything
- **Creation**: Any authenticated user can create notes
- **Deletion**: Only owner or admin can delete

### Domain Model Alignment
- **Tags**: Support public tags, private with sharing, role-based management
- **Graph Links**: Permissions inherit from both connected resources
- **Plugins**: Fine-grained capability-based access control

## Security Features

- 🔒 **Default Deny**: All requests denied unless explicitly allowed
- 🔐 **Role Hierarchy**: Proper admin > editor > user inheritance
- 🎯 **Fine-grained**: Resource-level and action-level permissions
- 📋 **Capability-based**: Plugin actions use scopes and claims
- ✅ **Input Validation**: Handles malformed or missing input gracefully

## Future Integration

Ready for integration with:
- Envoy + OPA external authorization
- Spring Security method-level annotations
- API Gateway request filtering
- Microservice authorization middleware

Closes #145
