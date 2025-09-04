package envoy.authz

import rego.v1

default allow := false

# Allow health check endpoints without authentication
allow if {
    input.attributes.request.http.path in ["/actuator/health", "/health", "/ready"]
}

# Main authorization logic
allow if {
    # Extract JWT from Authorization header
    token := extract_jwt_token
    
    # Verify JWT is valid (simplified - in production should verify signature)
    claims := decode_jwt_claims(token)
    
    # Check if user has required permissions
    has_required_permission(claims)
}

# Extract JWT token from Authorization header
extract_jwt_token := token if {
    auth_header := input.attributes.request.http.headers.authorization
    startswith(auth_header, "Bearer ")
    token := substring(auth_header, 7, -1)
}

# Decode JWT claims (simplified - production should verify signature with JWKS)
decode_jwt_claims(token) := claims if {
    # Split token into parts
    parts := split(token, ".")
    count(parts) == 3
    
    # Decode payload (base64url decode)
    payload := base64url.decode(parts[1])
    claims := json.unmarshal(payload)
}

# Check if user has required permission based on request path and method
has_required_permission(claims) if {
    # Admin users can access everything
    "admin" in claims.realm_access.roles
}

has_required_permission(claims) if {
    # Editor users can access most endpoints
    "editor" in claims.realm_access.roles
    not restricted_admin_path
}

has_required_permission(claims) if {
    # Regular users can access basic endpoints
    "user" in claims.realm_access.roles
    allowed_user_path
}

# Define restricted admin paths
restricted_admin_path if {
    input.attributes.request.http.path == "/api/admin"
}

restricted_admin_path if {
    regex.match("^/api/admin/.*", input.attributes.request.http.path)
}

# Define allowed paths for regular users
allowed_user_path if {
    input.attributes.request.http.path == "/api/me"
}

allowed_user_path if {
    regex.match("^/api/notes.*", input.attributes.request.http.path)
    input.attributes.request.http.method in ["GET", "POST"]
}

# Response structure for denying requests
response := {
    "allowed": false,
    "headers": {
        "content-type": "application/problem+json"
    },
    "body": json.marshal({
        "type": "https://example.com/probs/unauthorized",
        "title": "Unauthorized",
        "status": 401,
        "detail": "Authentication token is missing or invalid",
        "instance": input.attributes.request.http.path
    })
} if {
    not extract_jwt_token
}

response := {
    "allowed": false,
    "headers": {
        "content-type": "application/problem+json"
    },
    "body": json.marshal({
        "type": "https://example.com/probs/forbidden",
        "title": "Forbidden", 
        "status": 403,
        "detail": "Insufficient permissions for this resource",
        "instance": input.attributes.request.http.path
    })
} if {
    extract_jwt_token
    not allow
}
