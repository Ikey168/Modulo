package modulo.authorization

import rego.v1

# Test data setup
admin_user := {
    "id": "admin-user-123",
    "roles": ["admin", "editor", "user"],
    "claims": {
        "sub": "admin-user-123",
        "email": "admin@example.com",
        "scopes": ["read", "write", "admin"],
        "capabilities": {
            "allowed_plugins": ["plugin-1", "plugin-2"]
        }
    }
}

editor_user := {
    "id": "editor-user-456", 
    "roles": ["editor", "user"],
    "claims": {
        "sub": "editor-user-456",
        "email": "editor@example.com",
        "scopes": ["read", "write"],
        "capabilities": {
            "allowed_plugins": ["plugin-1"]
        }
    }
}

regular_user := {
    "id": "user-789",
    "roles": ["user"],
    "claims": {
        "sub": "user-789", 
        "email": "user@example.com",
        "scopes": ["read"],
        "capabilities": {
            "allowed_plugins": []
        }
    }
}

other_user := {
    "id": "other-user-999",
    "roles": ["user"],
    "claims": {
        "sub": "other-user-999",
        "email": "other@example.com",
        "scopes": ["read"],
        "capabilities": {
            "allowed_plugins": []
        }
    }
}

note_owned_by_user := {
    "type": "note",
    "id": "note-123",
    "owner_id": "user-789", 
    "shared_with": ["editor-user-456"],
    "scopes": ["read", "write"]
}

note_shared_with_user := {
    "type": "note",
    "id": "note-456",
    "owner_id": "other-user-999",
    "shared_with": ["user-789"],
    "scopes": ["read"]
}

private_note := {
    "type": "note", 
    "id": "note-private",
    "owner_id": "other-user-999",
    "shared_with": [],
    "scopes": ["read", "write"]
}

public_tag := {
    "type": "tag",
    "id": "tag-public",
    "owner_id": "other-user-999",
    "shared_with": [],
    "public": true
}

private_tag := {
    "type": "tag",
    "id": "tag-private", 
    "owner_id": "other-user-999",
    "shared_with": ["user-789"],
    "public": false
}

graph_link := {
    "type": "graph_link",
    "id": "link-123",
    "source_owner_id": "user-789",
    "target_owner_id": "user-789",
    "source_shared_with": [],
    "target_shared_with": []
}

plugin_with_scopes := {
    "type": "plugin",
    "id": "plugin-1",
    "required_scopes": ["read", "write"]
}

# ============================================================================
# NOTES AUTHORIZATION TESTS
# ============================================================================

# Test notes.read permissions
test_owner_can_read_own_note if {
    allow with input as {
        "user": regular_user,
        "resource": note_owned_by_user,
        "action": "read"
    }
}

test_shared_user_can_read_note if {
    allow with input as {
        "user": regular_user,
        "resource": note_shared_with_user, 
        "action": "read"
    }
}

test_admin_can_read_any_note if {
    allow with input as {
        "user": admin_user,
        "resource": private_note,
        "action": "read"
    }
}

test_other_user_cannot_read_private_note if {
    not allow with input as {
        "user": other_user,
        "resource": note_owned_by_user,
        "action": "read"
    }
}

# Test notes.write permissions
test_owner_can_write_own_note if {
    allow with input as {
        "user": regular_user,
        "resource": note_owned_by_user,
        "action": "write"
    }
}

test_editor_can_write_any_note if {
    allow with input as {
        "user": editor_user,
        "resource": private_note,
        "action": "write"
    }
}

test_admin_can_write_any_note if {
    allow with input as {
        "user": admin_user,
        "resource": private_note,
        "action": "write"
    }
}

test_shared_user_cannot_write_note if {
    not allow with input as {
        "user": regular_user,
        "resource": note_shared_with_user,
        "action": "write"
    }
}

# Test notes.admin permissions
test_admin_can_admin_notes if {
    allow with input as {
        "user": admin_user,
        "resource": note_owned_by_user,
        "action": "admin"
    }
}

test_editor_cannot_admin_notes if {
    not allow with input as {
        "user": editor_user,
        "resource": note_owned_by_user,
        "action": "admin"
    }
}

test_owner_cannot_admin_own_note if {
    not allow with input as {
        "user": regular_user,
        "resource": note_owned_by_user,
        "action": "admin"
    }
}

# Test notes.create permissions
test_user_can_create_note if {
    allow with input as {
        "user": regular_user,
        "resource": {"type": "note"},
        "action": "create"
    }
}

# Test notes.delete permissions
test_owner_can_delete_own_note if {
    allow with input as {
        "user": regular_user,
        "resource": note_owned_by_user,
        "action": "delete"
    }
}

test_admin_can_delete_any_note if {
    allow with input as {
        "user": admin_user,
        "resource": private_note,
        "action": "delete"
    }
}

test_editor_cannot_delete_note if {
    not allow with input as {
        "user": editor_user,
        "resource": private_note,
        "action": "delete"
    }
}

# ============================================================================
# TAG AUTHORIZATION TESTS
# ============================================================================

# Test tags.read permissions
test_user_can_read_public_tag if {
    allow with input as {
        "user": regular_user,
        "resource": public_tag,
        "action": "read"
    }
}

test_user_can_read_shared_private_tag if {
    allow with input as {
        "user": regular_user,
        "resource": private_tag,
        "action": "read"
    }
}

test_admin_can_read_any_tag if {
    allow with input as {
        "user": admin_user,
        "resource": private_tag,
        "action": "read"
    }
}

# Test tags.write permissions
test_editor_can_write_any_tag if {
    allow with input as {
        "user": editor_user,
        "resource": private_tag,
        "action": "write"
    }
}

test_admin_can_write_any_tag if {
    allow with input as {
        "user": admin_user,
        "resource": private_tag,
        "action": "write"
    }
}

test_regular_user_cannot_write_others_tag if {
    not allow with input as {
        "user": regular_user,
        "resource": private_tag,
        "action": "write"
    }
}

# Test tags.admin permissions
test_admin_can_admin_tags if {
    allow with input as {
        "user": admin_user,
        "resource": private_tag,
        "action": "admin"
    }
}

test_editor_cannot_admin_tags if {
    not allow with input as {
        "user": editor_user,
        "resource": private_tag,
        "action": "admin"
    }
}

# ============================================================================
# GRAPH LINK AUTHORIZATION TESTS
# ============================================================================

# Test graph_links.read permissions
test_admin_can_read_any_graph_link if {
    allow with input as {
        "user": admin_user,
        "resource": graph_link,
        "action": "read"
    }
}

test_user_can_read_own_graph_link if {
    allow with input as {
        "user": regular_user,
        "resource": graph_link,
        "action": "read"
    }
}

# Test graph_links.write permissions
test_admin_can_write_any_graph_link if {
    allow with input as {
        "user": admin_user,
        "resource": graph_link,
        "action": "write"
    }
}

test_editor_can_write_any_graph_link if {
    allow with input as {
        "user": editor_user,
        "resource": graph_link,
        "action": "write"
    }
}

test_user_can_write_own_graph_link if {
    allow with input as {
        "user": regular_user,
        "resource": graph_link,
        "action": "write"
    }
}

# ============================================================================
# PLUGIN AUTHORIZATION TESTS
# ============================================================================

# Test plugin.execute permissions
test_admin_can_execute_any_plugin if {
    allow with input as {
        "user": admin_user,
        "resource": plugin_with_scopes,
        "action": "execute"
    }
}

test_user_with_scopes_can_execute_plugin if {
    allow with input as {
        "user": editor_user,
        "resource": plugin_with_scopes,
        "action": "execute"
    }
}

test_user_without_scopes_cannot_execute_plugin if {
    not allow with input as {
        "user": regular_user,
        "resource": plugin_with_scopes,
        "action": "execute"
    }
}

test_user_with_capability_can_execute_plugin if {
    allow with input as {
        "user": editor_user,
        "resource": {"type": "plugin", "id": "plugin-1"},
        "action": "execute"
    }
}

# Test plugin.install permissions
test_editor_can_install_plugin if {
    allow with input as {
        "user": editor_user,
        "resource": {"type": "plugin"},
        "action": "install"
    }
}

test_admin_can_install_plugin if {
    allow with input as {
        "user": admin_user,
        "resource": {"type": "plugin"},
        "action": "install"
    }
}

test_regular_user_cannot_install_plugin if {
    not allow with input as {
        "user": regular_user,
        "resource": {"type": "plugin"},
        "action": "install"
    }
}

# Test plugin.admin permissions
test_admin_can_admin_plugin if {
    allow with input as {
        "user": admin_user,
        "resource": {"type": "plugin"},
        "action": "admin"
    }
}

test_editor_cannot_admin_plugin if {
    not allow with input as {
        "user": editor_user,
        "resource": {"type": "plugin"},
        "action": "admin"
    }
}

# ============================================================================
# DEFAULT DENY TESTS
# ============================================================================

# Default deny tests
test_default_deny_unknown_resource_type if {
    not allow with input as {
        "user": admin_user,
        "resource": {"type": "unknown"},
        "action": "read"
    }
}

test_default_deny_unknown_action if {
    not allow with input as {
        "user": admin_user,
        "resource": note_owned_by_user,
        "action": "unknown"
    }
}

test_default_deny_no_user if {
    not allow with input as {
        "resource": note_owned_by_user,
        "action": "read"
    }
}

test_default_deny_no_resource if {
    not allow with input as {
        "user": admin_user,
        "action": "read"
    }
}
