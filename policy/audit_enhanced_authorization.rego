package envoy.authz

import rego.v1

# Enhanced authorization policy with comprehensive audit logging
default allow := {
    "allowed": false,
    "headers": {
        "x-decision-id": generate_decision_id(),
        "x-policy-version": "v1.2.0"
    },
    "body": "",
    "http_status": 403
}

# Main authorization decision with full audit trail
allow := decision if {
    # Extract and validate request context
    request_context := extract_request_context(input)
    user_context := extract_user_context(input)
    
    # Generate unique decision ID for this request
    decision_id := generate_decision_id()
    
    # Record decision start time for performance tracking
    start_time := time.now_ns()
    
    # Evaluate authorization
    authz_result := evaluate_authorization(request_context, user_context)
    
    # Calculate evaluation time
    evaluation_time_ms := (time.now_ns() - start_time) / 1000000
    
    # Build comprehensive decision response with audit data
    decision := build_decision_response(
        authz_result, 
        request_context, 
        user_context, 
        decision_id,
        evaluation_time_ms
    )
}

# Extract comprehensive request context for audit logging
extract_request_context(input) := context if {
    # Parse request path to determine resource type and action
    path_info := parse_request_path(input.attributes.request.http.path)
    
    context := {
        "method": input.attributes.request.http.method,
        "path": input.attributes.request.http.path,
        "headers": sanitize_headers(input.attributes.request.http.headers),
        "source_ip": input.attributes.source.address.socket_address.address,
        "destination": input.attributes.destination.address.socket_address.address,
        "request_id": get_header_value(input.attributes.request.http.headers, "x-request-id"),
        "trace_id": get_header_value(input.attributes.request.http.headers, "x-trace-id"),
        "span_id": get_header_value(input.attributes.request.http.headers, "x-span-id"),
        "correlation_id": get_header_value(input.attributes.request.http.headers, "x-correlation-id"),
        "user_agent": get_header_value(input.attributes.request.http.headers, "user-agent"),
        "resource_type": path_info.resource_type,
        "resource_id": path_info.resource_id,
        "action": determine_action(input.attributes.request.http.method, path_info),
        "workspace": extract_workspace_from_path(input.attributes.request.http.path)
    }
}

# Extract user context from JWT token with PII protection
extract_user_context(input) := context if {
    # Extract JWT from Authorization header
    auth_header := get_header_value(input.attributes.request.http.headers, "authorization")
    startswith(auth_header, "Bearer ")
    
    token := substring(auth_header, 7, -1) # Remove "Bearer "
    
    # Decode JWT payload (simplified - in practice use proper JWT library)
    [header, payload, signature] := split(token, ".")
    decoded_payload := json.unmarshal(base64url.decode(payload))
    
    context := {
        "user_id": decoded_payload.sub,
        "username": decoded_payload.preferred_username,
        "email": hash_pii(decoded_payload.email), # Hash email for privacy
        "tenant": decoded_payload.tenant,
        "roles": decoded_payload.realm_access.roles,
        "workspaces": decoded_payload.workspaces,
        "session_id": decoded_payload.sid,
        "issued_at": decoded_payload.iat,
        "expires_at": decoded_payload.exp
    }
}

# Main authorization evaluation with detailed rule tracking
evaluate_authorization(request_context, user_context) := result if {
    # Check if user token is valid and not expired
    token_valid := validate_token(user_context)
    
    # Determine authorization based on resource type and action
    authorization_result := check_resource_authorization(request_context, user_context)
    
    # Get the specific rule that matched (or denied)
    matched_rule := get_matched_rule(request_context, user_context, authorization_result.allowed)
    
    result := {
        "allowed": token_valid and authorization_result.allowed,
        "rule": matched_rule,
        "reason": authorization_result.reason,
        "policy_version": "v1.2.0",
        "token_valid": token_valid,
        "workspace_context": authorization_result.workspace_context
    }
}

# Build comprehensive decision response with full audit context
build_decision_response(authz_result, request_context, user_context, decision_id, evaluation_time_ms) := response if {
    # Determine HTTP status
    http_status := 200 if authz_result.allowed else 403
    
    # Build response headers
    response_headers := {
        "x-decision-id": decision_id,
        "x-policy-version": authz_result.policy_version,
        "x-trace-id": request_context.trace_id,
        "x-evaluation-time-ms": sprintf("%.2f", [evaluation_time_ms])
    }
    
    # Create audit context for decision logging
    audit_context := {
        "decision_id": decision_id,
        "timestamp": time.now_ns(),
        "trace_id": request_context.trace_id,
        "span_id": request_context.span_id,
        "request_id": request_context.request_id,
        "correlation_id": request_context.correlation_id,
        "user": {
            "id": user_context.user_id,
            "username": user_context.username,
            "email": user_context.email, # Already hashed
            "tenant": user_context.tenant,
            "roles": user_context.roles,
            "session_id": user_context.session_id
        },
        "request": {
            "method": request_context.method,
            "path": request_context.path,
            "resource_type": request_context.resource_type,
            "resource_id": request_context.resource_id,
            "action": request_context.action,
            "workspace": request_context.workspace,
            "source_ip": request_context.source_ip
        },
        "decision": {
            "allow": authz_result.allowed,
            "policy_id": "notes_authorization",
            "policy_version": authz_result.policy_version,
            "rule": authz_result.rule,
            "reason": authz_result.reason,
            "evaluation_time_ms": evaluation_time_ms,
            "token_valid": authz_result.token_valid
        },
        "metadata": {
            "client_ip": request_context.source_ip,
            "user_agent": hash_pii(request_context.user_agent),
            "workspace_context": authz_result.workspace_context
        }
    }
    
    response := {
        "allowed": authz_result.allowed,
        "headers": response_headers,
        "body": "",
        "http_status": http_status,
        "audit": audit_context
    }
}

# Resource-specific authorization logic
check_resource_authorization(request_context, user_context) := result if {
    request_context.resource_type == "notes"
    result := check_notes_authorization(request_context, user_context)
} else := result if {
    request_context.resource_type == "workspaces"  
    result := check_workspace_authorization(request_context, user_context)
} else := result if {
    request_context.resource_type == "users"
    result := check_user_authorization(request_context, user_context)
} else := {
    "allowed": false,
    "reason": sprintf("Unknown resource type: %s", [request_context.resource_type]),
    "workspace_context": {}
}

# Notes authorization with detailed audit trail
check_notes_authorization(request_context, user_context) := result if {
    request_context.action == "create"
    workspace := request_context.workspace
    workspace_role := user_context.workspaces[workspace]
    
    # Check if user has editor or higher role in workspace
    allowed := workspace_role in ["workspace_editor", "workspace_admin", "workspace_owner"]
    
    reason := sprintf("User %s with role %s %s create notes in workspace %s", [
        user_context.username,
        workspace_role,
        "can" if allowed else "cannot", 
        workspace
    ])
    
    result := {
        "allowed": allowed,
        "reason": reason,
        "workspace_context": {
            "workspace": workspace,
            "role": workspace_role,
            "permission": "create_notes"
        }
    }
} else := result if {
    request_context.action in ["read", "update", "delete"]
    note_id := request_context.resource_id
    
    # Check note ownership and workspace access
    note_access := check_note_access(note_id, user_context)
    
    result := {
        "allowed": note_access.allowed,
        "reason": note_access.reason,
        "workspace_context": note_access.context
    }
} else := {
    "allowed": false,
    "reason": sprintf("Unknown action %s for notes", [request_context.action]),
    "workspace_context": {}
}

# Workspace authorization logic
check_workspace_authorization(request_context, user_context) := result if {
    workspace_id := request_context.resource_id
    action := request_context.action
    
    # Check user's role in the requested workspace
    workspace_role := user_context.workspaces[workspace_id]
    
    # Define required roles for each action
    required_roles := {
        "read": ["workspace_viewer", "workspace_editor", "workspace_admin", "workspace_owner"],
        "update": ["workspace_admin", "workspace_owner"],
        "delete": ["workspace_owner"],
        "invite": ["workspace_admin", "workspace_owner"],
        "manage": ["workspace_owner"]
    }
    
    allowed := workspace_role in required_roles[action]
    
    reason := sprintf("User %s with role %s %s %s workspace %s", [
        user_context.username,
        workspace_role,
        "can" if allowed else "cannot",
        action,
        workspace_id
    ])
    
    result := {
        "allowed": allowed,
        "reason": reason,
        "workspace_context": {
            "workspace": workspace_id,
            "role": workspace_role,
            "action": action,
            "required_roles": required_roles[action]
        }
    }
}

# User authorization for profile and admin operations
check_user_authorization(request_context, user_context) := result if {
    target_user_id := request_context.resource_id
    action := request_context.action
    
    # Users can always access their own profile
    is_own_profile := user_context.user_id == target_user_id
    
    # Check for admin privileges
    is_admin := "system_admin" in user_context.roles
    is_tenant_admin := sprintf("tenant_admin_%s", [user_context.tenant]) in user_context.roles
    
    allowed := is_own_profile or is_admin or is_tenant_admin
    
    reason := sprintf("User %s %s access user %s profile (%s)", [
        user_context.username,
        "can" if allowed else "cannot",
        target_user_id,
        "own profile" if is_own_profile else "admin access" if (is_admin or is_tenant_admin) else "insufficient privileges"
    ])
    
    result := {
        "allowed": allowed,
        "reason": reason,
        "workspace_context": {
            "target_user": target_user_id,
            "is_own_profile": is_own_profile,
            "admin_access": is_admin or is_tenant_admin
        }
    }
}

# Utility Functions

# Parse request path to extract resource information
parse_request_path(path) := info if {
    # Remove API prefix and split path
    clean_path := trim_prefix(path, "/api/v1/")
    path_parts := split(clean_path, "/")
    count(path_parts) > 0
    
    info := {
        "resource_type": path_parts[0],
        "resource_id": path_parts[1] if count(path_parts) > 1 else "",
        "sub_resource": path_parts[2] if count(path_parts) > 2 else ""
    }
} else := {
    "resource_type": "unknown",
    "resource_id": "",
    "sub_resource": ""
}

# Determine action from HTTP method and path context
determine_action(method, path_info) := action if {
    method == "GET"
    path_info.resource_id == ""
    action := "list"
} else := "read" if {
    method == "GET"
} else := "create" if {
    method == "POST"
} else := "update" if {
    method in ["PUT", "PATCH"]
} else := "delete" if {
    method == "DELETE"
} else := "unknown"

# Extract workspace from path (for workspace-scoped resources)
extract_workspace_from_path(path) := workspace if {
    contains(path, "/workspaces/")
    parts := split(path, "/")
    workspace_index := array_index(parts, "workspaces")
    workspace_index >= 0
    count(parts) > workspace_index + 1
    workspace := parts[workspace_index + 1]
} else := ""

# Get rule name that matched the decision
get_matched_rule(request_context, user_context, allowed) := rule if {
    allowed == true
    request_context.action == "create"
    request_context.resource_type == "notes"
    rule := "allow_workspace_editor_create_notes"
} else := rule if {
    allowed == true
    request_context.action in ["read", "update", "delete"]
    request_context.resource_type == "notes"
    rule := "allow_note_owner_access"
} else := rule if {
    allowed == true
    request_context.resource_type == "workspaces"
    rule := sprintf("allow_workspace_%s_access", [request_context.action])
} else := rule if {
    allowed == false
    rule := "deny_insufficient_privileges"
} else := "unknown_rule"

# Validate JWT token (simplified)
validate_token(user_context) := valid if {
    # Check token expiration
    current_time := time.now_ns() / 1000000000 # Convert to seconds
    token_expired := current_time > user_context.expires_at
    
    # Check required fields
    has_required_fields := user_context.user_id != "" and user_context.tenant != ""
    
    valid := not token_expired and has_required_fields
}

# Check note access permissions
check_note_access(note_id, user_context) := access if {
    # This would typically query a database or external service
    # For now, implement basic workspace-based access control
    
    # Mock note ownership data (in practice this would be external data)
    note_workspaces := {
        "note_123": "workspace_alpha",
        "note_456": "workspace_beta"
    }
    
    note_workspace := note_workspaces[note_id]
    user_role := user_context.workspaces[note_workspace]
    
    allowed := user_role in ["workspace_viewer", "workspace_editor", "workspace_admin", "workspace_owner"]
    
    access := {
        "allowed": allowed,
        "reason": sprintf("User has role %s in workspace %s containing note %s", [
            user_role, note_workspace, note_id
        ]),
        "context": {
            "note_workspace": note_workspace,
            "user_role": user_role
        }
    }
}

# Utility functions for header processing
get_header_value(headers, key) := value if {
    headers[key] = value
} else := headers[lower(key)] if {
    headers[lower(key)]
} else := ""

# Sanitize headers to remove sensitive information  
sanitize_headers(headers) := sanitized if {
    sensitive_headers := {
        "authorization", "cookie", "x-api-key", "x-auth-token", 
        "x-secret", "x-password", "authentication"
    }
    
    sanitized := {k: v | 
        headers[k] = v
        not sensitive_headers[lower(k)]
    }
}

# Hash PII data for privacy protection
hash_pii(value) := hashed if {
    # Use crypto.sha256 to hash PII (email, user agent, etc.)
    hashed := crypto.sha256(value)
} else := ""

# Generate unique decision ID
generate_decision_id() := id if {
    # Generate UUID-like decision ID using timestamp and random component
    timestamp := time.now_ns()
    id := sprintf("dec_%d_%s", [timestamp, substring(crypto.sha256(sprintf("%d", [timestamp])), 0, 8)])
}

# Array utility to find index
array_index(arr, item) := i if {
    arr[i] == item
} else := -1
