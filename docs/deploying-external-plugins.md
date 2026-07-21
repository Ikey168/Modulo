# Deploying an external plugin

How a plugin goes from container image to attached workload
([ADR 0004](architecture/adr-0004-external-plugin-tier.md); machinery from
#392–#394). The running example is the first real plugin, the script
sandbox (#393).

## 1. Build the image

An external plugin is any container serving the
[v1 plugin contract](../plugin-contract/README.md) (`PluginService`) on a
gRPC port, ideally also exposing `grpc.health.v1` so Kubernetes' native gRPC
probes work. For the pilot:

```sh
# repo-root context — the service compiles shared sources from backend/
docker build -f services/script-sandbox-plugin/Dockerfile -t modulo-script-sandbox:latest .
```

## 2. Deploy via the plugin base + ArgoCD

Every plugin workload is an instance of the reusable chart `helm/plugin`,
which renders the enforced security posture by default: dedicated
ServiceAccount (no token automount), non-root + read-only root filesystem,
resource limits, gRPC health probes, and a deny-by-default NetworkPolicy
(ingress from the core only; egress to core gRPC + NATS + DNS only).

Add one Application file under `argocd/apps/plugins/` — the app-of-apps
picks the directory up automatically:

```yaml
# argocd/apps/plugins/my-plugin.yaml — a new plugin is exactly this much
spec:
  source:
    path: helm/plugin
    helm:
      values: |
        pluginName: my-plugin
        image:
          repository: acme/my-plugin
          tag: "1.0.0"
```

(See `argocd/apps/plugins/script-sandbox.yaml` for the complete file.)
Verify locally with `helm template x helm/plugin --set pluginName=my-plugin
--set image.repository=acme/my-plugin`.

## 3. Register the endpoint with the core

The chart names the in-cluster Service `modulo-plugin-<pluginName>`, so the
pilot's endpoint is `modulo-plugin-script-sandbox:9090`. Attach it (admin
role):

```sh
curl -X POST https://<modulo>/api/plugins/install-external \
  -H 'Content-Type: application/json' \
  -d '{"endpoint": "modulo-plugin-script-sandbox:9090", "config": {}}'
```

The core fetches the plugin's identity and declared permissions over the
contract, records the endpoint in the plugin registry, grants the declared
permissions, issues the plugin its host token (delivered in `Initialize`
config as `modulo.plugin.token` — required for any `PluginHostService`
callback), and drives `Initialize`/`Start`. From then on:

- the health monitor polls the workload (3 consecutive failures → `ERROR`
  in `/api/plugins/{id}/status`, recovery → `ACTIVE`);
- the registry survives core restarts — the endpoint is re-attached on
  startup, and a down pod yields `ERROR`, never a failed boot;
- for the sandbox pilot specifically, `action.code.execute` now routes to
  the workload whenever it is healthy and falls back in-process otherwise.

Automated register-on-sync (ArgoCD hook → `install-external`) is a
documented follow-up, deliberately not part of this milestone.

## Removing a plugin

`DELETE /api/plugins/{pluginId}` stops the remote workload and unregisters
it; delete the Application file to tear down the deployment (ArgoCD prunes).

## The event bridge

If the plugin consumes or emits events over NATS instead of the gRPC
stream, enable the broker on the core (`modulo.plugins.broker.enabled=true`;
the `modulo-nats` app deploys the broker) — envelope and semantics in
`plugin-contract/README.md`.
