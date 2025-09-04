# Envoy + OPA External Authorization

This implementation provides centralized authorization using Envoy as a sidecar proxy with OPA (Open Policy Agent) for policy evaluation.

## Architecture

```
Client → Envoy (ext_authz) → OPA → Backend Service
```

- **Envoy**: Acts as a reverse proxy with external authorization filter
- **OPA**: Policy engine that evaluates authorization decisions
- **Backend**: Your application service (protected behind Envoy)

## Components

### Envoy Configuration (`infra/envoy/envoy.yaml`)
- Configured with `ext_authz` filter pointing to OPA gRPC service
- Routes all traffic through authorization checks
- Returns structured error responses (RFC 7807) for denials

### OPA Policies (`infra/opa/policy.rego`)
- JWT token extraction and validation
- Role-based access control (RBAC)
- Path-based authorization rules
- Structured deny responses with proper HTTP status codes

### Performance Benchmarking
- k6 tests to measure authorization overhead
- Target: p50 < 5ms, p95 < 20ms latency overhead

## Usage

### Start the Services
```bash
make envoy-opa-up
```

This will start:
- Envoy proxy on port 8080
- OPA on ports 8181 (REST) and 9191 (gRPC)
- Backend service on port 8081 (direct access)

### Test Policies
```bash
make opa-test
```

### Run Performance Benchmark
```bash
make authz-benchmark
```

### View Logs
```bash
make envoy-opa-logs
```

### Stop Services
```bash
make envoy-opa-down
```

## Access Patterns

### Health Endpoints (No Auth Required)
- `/health`
- `/actuator/health`
- `/ready`

### User Endpoints (Requires `user` role)
- `GET /api/me`
- `GET /api/notes`
- `POST /api/notes`

### Editor Endpoints (Requires `editor` role)
- All user endpoints
- Additional endpoints (future expansion)

### Admin Endpoints (Requires `admin` role)
- All editor/user endpoints
- `/api/admin/*`

## Error Responses

### 401 Unauthorized (Missing/Invalid Token)
```json
{
  "type": "https://example.com/probs/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication token is missing or invalid",
  "instance": "/api/resource"
}
```

### 403 Forbidden (Insufficient Permissions)
```json
{
  "type": "https://example.com/probs/forbidden",
  "title": "Forbidden",
  "status": 403,
  "detail": "Insufficient permissions for this resource",
  "instance": "/api/admin/users"
}
```

## Performance Metrics

The system is designed to meet these latency requirements:
- **p50**: < 5ms authorization overhead
- **p95**: < 20ms authorization overhead

Actual performance can be measured using:
```bash
make authz-benchmark
```

## Decision Logging

OPA logs all authorization decisions with metadata including:
- Request details (method, path, headers)
- User information (from JWT claims)
- Decision result (allow/deny)
- Trace IDs for correlation

## Future Enhancements

- Move ext_authz to API gateway level (Kong/Traefik)
- Implement JWT signature verification with JWKS
- Add rate limiting policies
- Implement fine-grained resource-based permissions
