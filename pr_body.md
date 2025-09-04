## Summary

This PR implements a complete Keycloak setup for local development and testing OIDC flows as requested in issue #142.

## Changes Made

✅ **Helm Chart & Values**
- Added Bitnami Keycloak Helm chart with persistent storage
- Configured `values.dev.yaml` with development settings
- Added ConfigMap template for realm import

✅ **Realm Bootstrap** 
- Stored realm export JSON in `infra/keycloak/realm/modulo-realm.json`
- Configured realm import via Helm ConfigMap volume mount

✅ **Clients & Roles**
- Created `modulo-web` client (public) with redirect URI `http://localhost:5173/*`
- Created `modulo-api` client (confidential) with redirect URI `http://localhost:8080/*`  
- Defined default roles: `user`, `editor`, `admin`

✅ **Test Users**
- Configured test users with role mappings
- Documented credentials in `dev/README.md`
- No real secrets stored (dev-only admin credentials)

✅ **Makefile Targets**
- Added `make keycloak-up` for deployment
- Added `make keycloak-down` for cleanup

✅ **Health Checks**
- Configured liveness/readiness probes at `/auth` endpoint
- Added smoke test documentation with `curl` commands

## Testing

The setup provides:
- Admin console at `http://localhost:8080/auth/admin/` (admin/admin)
- Health endpoint at `http://localhost:8080/auth/`
- Ready for OIDC flow testing with frontend and backend

## Coverage

This implementation provides 100% coverage of the acceptance criteria:
- ✅ Keycloak runs in dev with persistent storage  
- ✅ Realm export stored in repo under `infra/keycloak/realm/`
- ✅ Clients for `modulo-web` and `modulo-api` with proper redirect URIs
- ✅ Default roles defined: `user`, `editor`, `admin`
- ✅ All tasks completed as specified

Closes #142
