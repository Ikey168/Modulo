package modulo.authorization

import rego.v1

# Default deny
default allow := false

# Input schema:
# {
#   "user": {
#     "id": "user-123",
#     "roles": ["user", "editor", "admin"],
#     "claims": {
#       "sub": "user-123",
#       "email": "user@example.com",
#       "realm_access": {
#         "roles": ["user"]
#       }
#     }
#   },
#   "resource": {
#     "type": "note|tag|plugin",
#     "id": "resource-456",
#     "owner_id": "user-123",
#     "shared_with": ["user-789"],
#     "scopes": ["read", "write", "admin"]
#   },
#   "action": "read|write|admin|create|delete"
# }

# ============================================================================
# NOTES AUTHORIZATION RULES
# ============================================================================

# notes.read: owner or shared-with role
allow if {
    input.resource.type == "note"
    input.action == "read"
    notes_read_allowed
}

notes_read_allowed if {
    # Owner can always read their own notes
    input.user.id == input.resource.owner_id
}

notes_read_allowed if {
    # User is in the shared_with list
    input.user.id in input.resource.shared_with
}

notes_read_allowed if {
    # Admin role can read any note
    "admin" in input.user.roles
}

# notes.write: owner or editor role
allow if {
    input.resource.type == "note"
    input.action == "write"
    notes_write_allowed
}

notes_write_allowed if {
    # Owner can always write their own notes
    input.user.id == input.resource.owner_id
}

notes_write_allowed if {
    # Editor role can write any note
    "editor" in input.user.roles
}

notes_write_allowed if {
    # Admin role can write any note
    "admin" in input.user.roles
}

# notes.admin: admin role only
allow if {
    input.resource.type == "note"
    input.action == "admin"
    notes_admin_allowed
}

notes_admin_allowed if {
    # Only admin role can perform admin actions on notes
    "admin" in input.user.roles
}

# notes.create: any authenticated user
allow if {
    input.resource.type == "note"
    input.action == "create"
    notes_create_allowed
}

notes_create_allowed if {
    # Any authenticated user with user role can create notes
    "user" in input.user.roles
}

# notes.delete: owner or admin
allow if {
    input.resource.type == "note"
    input.action == "delete"
    notes_delete_allowed
}

notes_delete_allowed if {
    # Owner can delete their own notes
    input.user.id == input.resource.owner_id
}

notes_delete_allowed if {
    # Admin role can delete any note
    "admin" in input.user.roles
}

# ============================================================================
# TAG AUTHORIZATION RULES
# ============================================================================

# tags.read: owner, shared-with, or public tags
allow if {
    input.resource.type == "tag"
    input.action == "read"
    tags_read_allowed
}

tags_read_allowed if {
    # Owner can read their own tags
    input.user.id == input.resource.owner_id
}

tags_read_allowed if {
    # User is in the shared_with list
    input.user.id in input.resource.shared_with
}

tags_read_allowed if {
    # Admin role can read any tag
    "admin" in input.user.roles
}

tags_read_allowed if {
    # Public tags can be read by anyone with user role
    input.resource.public == true
    "user" in input.user.roles
}

# tags.write: owner or editor
allow if {
    input.resource.type == "tag"
    input.action == "write"
    tags_write_allowed
}

tags_write_allowed if {
    # Owner can write their own tags
    input.user.id == input.resource.owner_id
}

tags_write_allowed if {
    # Editor role can write any tag
    "editor" in input.user.roles
}

tags_write_allowed if {
    # Admin role can write any tag
    "admin" in input.user.roles
}

# tags.admin: admin role only
allow if {
    input.resource.type == "tag"
    input.action == "admin"
    tags_admin_allowed
}

tags_admin_allowed if {
    # Only admin role can perform admin actions on tags
    "admin" in input.user.roles
}

# ============================================================================
# GRAPH LINK AUTHORIZATION RULES
# ============================================================================

# graph_links.read: if user can read both connected resources
allow if {
    input.resource.type == "graph_link"
    input.action == "read"
    graph_links_read_allowed
}

graph_links_read_allowed if {
    # Admin can read any graph link
    "admin" in input.user.roles
}

graph_links_read_allowed if {
    # User can read link if they can read both connected resources
    can_read_source_resource
    can_read_target_resource
}

can_read_source_resource if {
    # Check if user can read the source resource of the link
    input.user.id == input.resource.source_owner_id
}

can_read_source_resource if {
    input.user.id in input.resource.source_shared_with
}

can_read_target_resource if {
    # Check if user can read the target resource of the link
    input.user.id == input.resource.target_owner_id
}

can_read_target_resource if {
    input.user.id in input.resource.target_shared_with
}

# graph_links.write: if user can write to both connected resources
allow if {
    input.resource.type == "graph_link"
    input.action == "write"
    graph_links_write_allowed
}

graph_links_write_allowed if {
    # Admin can write any graph link
    "admin" in input.user.roles
}

graph_links_write_allowed if {
    # Editor can write any graph link
    "editor" in input.user.roles
}

graph_links_write_allowed if {
    # User can write link if they own both connected resources
    input.user.id == input.resource.source_owner_id
    input.user.id == input.resource.target_owner_id
}

# ============================================================================
# PLUGIN ACTION AUTHORIZATION RULES (Capability-based)
# ============================================================================

# plugin.execute: based on scopes and claims
allow if {
    input.resource.type == "plugin"
    input.action == "execute"
    plugin_execute_allowed
}

plugin_execute_allowed if {
    # Admin can execute any plugin
    "admin" in input.user.roles
}

plugin_execute_allowed if {
    # Check if user has required scopes for plugin execution
    has_required_plugin_scopes
}

has_required_plugin_scopes if {
    # All required scopes must be present in user's scopes
    required_scopes := input.resource.required_scopes
    user_scopes := input.user.claims.scopes
    every scope in required_scopes {
        scope in user_scopes
    }
}

plugin_execute_allowed if {
    # Check capability-based access via claims
    has_plugin_capability
}

has_plugin_capability if {
    # Plugin allows execution based on specific claims
    plugin_id := input.resource.id
    capabilities := input.user.claims.capabilities
    plugin_id in capabilities.allowed_plugins
}

# plugin.install: editor or admin role
allow if {
    input.resource.type == "plugin"
    input.action == "install"
    plugin_install_allowed
}

plugin_install_allowed if {
    "editor" in input.user.roles
}

plugin_install_allowed if {
    "admin" in input.user.roles
}

# plugin.admin: admin role only
allow if {
    input.resource.type == "plugin"
    input.action == "admin"
    plugin_admin_allowed
}

plugin_admin_allowed if {
    "admin" in input.user.roles
}
