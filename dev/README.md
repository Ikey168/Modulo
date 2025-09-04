# Keycloak Dev Setup

## Realm & Clients

- Realm: `modulo`
- Clients:
	- `modulo-web` (public)
		- Redirect URI: `http://localhost:5173/*`
	- `modulo-api` (confidential)
		- Redirect URI: `http://localhost:8080/*`
- Roles: `user`, `editor`, `admin`

## Admin Console

- URL: `http://localhost:8080/auth/admin/`
- Username: `admin`, Password: `admin`

## Test Users & Credentials

- **testuser** / `testpass` (role: user)
- **editor** / `editorpass` (role: editor)
- **admin** / `adminpass` (role: admin)

## Realm Import

The realm is bootstrapped from `infra/keycloak/realm/modulo-realm.json` via Helm ConfigMap.

## Makefile Targets

- `make keycloak-up` — deploy Keycloak with realm import
- `make keycloak-down` — remove Keycloak from cluster

## Health Check

- Liveness/readiness: `/auth/realms/master` on port 8080
- Smoke test: `curl http://localhost:8080/auth/`

## Notes

- No real secrets are stored; admin password is for dev only.
- Use SOPS for secret management in production.
