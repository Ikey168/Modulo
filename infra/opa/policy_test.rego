package envoy.authz

import rego.v1

# Test health endpoints are always allowed
test_health_endpoint_allowed if {
    allow with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/actuator/health",
                    "method": "GET"
                }
            }
        }
    }
}

test_ready_endpoint_allowed if {
    allow with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/ready",
                    "method": "GET"
                }
            }
        }
    }
}

# Test unauthenticated requests are denied
test_unauthenticated_request_denied if {
    not allow with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/me",
                    "method": "GET"
                }
            }
        }
    }
}

# Test JWT extraction
test_jwt_extraction if {
    token := extract_jwt_token with input as {
        "attributes": {
            "request": {
                "http": {
                    "headers": {
                        "authorization": "Bearer test-token-123"
                    }
                }
            }
        }
    }
    token == "test-token-123"
}

# Test restricted admin path detection
test_admin_path_detection if {
    restricted_admin_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/admin/users"
                }
            }
        }
    }
}

test_admin_root_path_detection if {
    restricted_admin_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/admin"
                }
            }
        }
    }
}

# Test allowed user paths
test_me_endpoint_user_path if {
    allowed_user_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/me"
                }
            }
        }
    }
}

test_notes_get_user_path if {
    allowed_user_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/notes",
                    "method": "GET"
                }
            }
        }
    }
}

test_notes_post_user_path if {
    allowed_user_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/notes",
                    "method": "POST"
                }
            }
        }
    }
}

# Test notes path with invalid method is not allowed for users
test_notes_put_not_user_path if {
    not allowed_user_path with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/notes",
                    "method": "PUT"
                }
            }
        }
    }
}

# Test response structure for missing token
test_unauthorized_response_structure if {
    resp := response with input as {
        "attributes": {
            "request": {
                "http": {
                    "path": "/api/me",
                    "method": "GET"
                }
            }
        }
    }
    
    resp.allowed == false
    resp.headers["content-type"] == "application/problem+json"
    
    # Validate the response body is valid JSON
    body := json.unmarshal(resp.body)
    body.status == 401
    body.title == "Unauthorized"
}
