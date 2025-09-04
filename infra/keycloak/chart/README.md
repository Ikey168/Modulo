# Keycloak Helm Chart for Modulo

This chart deploys Keycloak for local development and testing OIDC flows.

- Uses Bitnami Keycloak chart
- Persistent storage enabled
- Realm imported from `/realm/modulo-realm.json`
- Admin credentials: `admin` / `admin` (for dev only)

## Usage

```sh
helm dependency update
helm install modulo-keycloak . -f values.dev.yaml
```

## Realm Import

The realm is imported from the ConfigMap `modulo-realm` containing `modulo-realm.json`.
