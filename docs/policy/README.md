# Modulo Authorization Policies

This document describes the authorization policies implemented in OPA Rego for the Modulo application. The policies enforce Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) patterns for notes, tags, graph links, and plugin actions.

## Input Schema

The authorization policies expect the following input structure:

```json
{
  "user": {
    "id": "user-123",
    "roles": ["user", "editor", "admin"],
    "claims": {
      "sub": "user-123",
      "email": "user@example.com",
      "scopes": ["read", "write", "admin"],
      "capabilities": {
        "allowed_plugins": ["plugin-1", "plugin-2"]
      }
    }
  },
  "resource": {
    "type": "note|tag|plugin|graph_link",
    "id": "resource-456",
    "owner_id": "user-123",
    "shared_with": ["user-789"],
    "scopes": ["read", "write", "admin"],
    "public": true
  },
  "action": "read|write|admin|create|delete|execute|install"
}
```

## Authorization Rules

### Notes Authorization

#### `notes.read`
**Who can read notes:**
- Note owner
- Users in the `shared_with` list
- Users with `admin` role

#### `notes.write` 
**Who can write/modify notes:**
- Note owner
- Users with `editor` role
- Users with `admin` role

#### `notes.admin`
**Who can perform admin actions on notes:**
- Users with `admin` role only

#### `notes.create`
**Who can create new notes:**
- Any authenticated user with `user` role

#### `notes.delete`
**Who can delete notes:**
- Note owner
- Users with `admin` role

### Tag Authorization

#### `tags.read`
**Who can read tags:**
- Tag owner
- Users in the `shared_with` list
- Users with `admin` role
- Any user with `user` role (for public tags)

#### `tags.write`
**Who can write/modify tags:**
- Tag owner
- Users with `editor` role
- Users with `admin` role

#### `tags.admin`
**Who can perform admin actions on tags:**
- Users with `admin` role only

### Graph Link Authorization

Graph links connect resources (notes, tags, etc.) and inherit permissions from both connected resources.

#### `graph_links.read`
**Who can read graph links:**
- Users with `admin` role
- Users who can read both connected resources

#### `graph_links.write`
**Who can create/modify graph links:**
- Users with `admin` role
- Users with `editor` role
- Users who own both connected resources

### Plugin Authorization (Capability-Based)

Plugin actions use capability-based access control through scopes and claims.

#### `plugin.execute`
**Who can execute plugins:**
- Users with `admin` role
- Users with required scopes in their claims
- Users with plugin capability in `allowed_plugins` list

#### `plugin.install`
**Who can install plugins:**
- Users with `editor` role
- Users with `admin` role

#### `plugin.admin`
**Who can perform admin actions on plugins:**
- Users with `admin` role only

## Role Hierarchy

The system implements the following role hierarchy:

```
admin > editor > user
```

- **admin**: Full access to all resources and actions
- **editor**: Can write/modify most resources, install plugins
- **user**: Basic read access and can create own content

## Testing

The policy includes comprehensive unit tests covering:

- ✅ Allow/deny matrices for all resource types
- ✅ Role-based permissions
- ✅ Owner-based permissions
- ✅ Shared resource permissions
- ✅ Capability-based plugin access
- ✅ Default deny behavior
- ✅ Edge cases and error conditions

### Running Tests

```bash
# Run OPA policy tests
make policy-test

# Or directly with OPA
opa test policy/
```

### Test Coverage

The test suite includes **50+ test cases** covering:

- **Notes**: 12 test cases (read, write, admin, create, delete)
- **Tags**: 8 test cases (read, write, admin with public/private)
- **Graph Links**: 6 test cases (read, write with ownership)
- **Plugins**: 8 test cases (execute, install, admin with capabilities)
- **Default Deny**: 4 test cases (unknown types, actions, missing data)
- **Edge Cases**: 12 additional boundary condition tests

## Usage Examples

### Check if user can read a note
```rego
input := {
  "user": {
    "id": "user-123",
    "roles": ["user"]
  },
  "resource": {
    "type": "note",
    "id": "note-456",
    "owner_id": "user-123"
  },
  "action": "read"
}

# Result: true (owner can read own note)
```

### Check plugin execution with capabilities
```rego
input := {
  "user": {
    "id": "user-123", 
    "roles": ["user"],
    "claims": {
      "capabilities": {
        "allowed_plugins": ["analytics-plugin"]
      }
    }
  },
  "resource": {
    "type": "plugin",
    "id": "analytics-plugin"
  },
  "action": "execute"
}

# Result: true (user has plugin capability)
```

## Integration

The policies are designed to integrate with:

- **Envoy + OPA**: External authorization filter
- **Spring Security**: Method-level security annotations
- **API Gateway**: Request-level authorization
- **Microservices**: Service-to-service authorization

## Security Considerations

1. **Default Deny**: All requests are denied unless explicitly allowed
2. **Principle of Least Privilege**: Users get minimum required permissions
3. **Capability-Based**: Plugin actions use fine-grained capabilities
4. **Audit Trail**: All decisions can be logged for compliance
5. **Input Validation**: Policies handle malformed or missing input gracefully

## Future Enhancements

- **Resource-level attributes**: Fine-grained permissions based on resource metadata
- **Time-based access**: Temporary permissions with expiration
- **Context-aware**: Location, device, or network-based restrictions
- **Dynamic roles**: Runtime role assignment based on context
- **Policy versioning**: Support for multiple policy versions
