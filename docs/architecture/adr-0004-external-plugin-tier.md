# ADR 0004: External plugin tier — cluster workloads around the core

- **Status:** Accepted
- **Context:** [#389](https://github.com/Ikey168/Modulo/issues/389), first
  sub-issue of the external-plugins milestone
  [#388](https://github.com/Ikey168/Modulo/issues/388).
- **Decision drivers:** third-party code must never share the core JVM; the
  Pi/minimal path must keep working with zero extra services; reuse what
  exists (the gRPC plugin contract, the `endpoint` registry column, the
  helm/ArgoCD per-service pattern) instead of inventing parallel machinery.

## Context

`PluginType.EXTERNAL` has been declared but never implemented. Today:

- `PluginManager`/`PluginLoader` only load JARs into the core JVM;
  `RemotePluginLoader` *downloads* JARs but still runs them in-process.
- A gRPC plugin contract already exists (`backend/src/main/proto/`:
  `plugin_service.proto`, `note_plugin_service.proto`,
  `user_plugin_service.proto`) and the core already runs a gRPC **server**
  (`com.modulo.grpc.service.*`, port 9090) exposing plugin lifecycle and the
  Note/User callback APIs — but nothing dials *out*: there is no gRPC client,
  so an external process could call us, yet we could never manage it.
- `PluginEventBus` is in-JVM only; an external plugin cannot receive events.
- `PluginRegistryEntry` already has an `endpoint` column, written by
  `updatePluginRemoteInfo` and otherwise unused.
- The marketplace submission pipeline (`plugin/submission/*`) validates and
  stores JAR files; `PluginSecurityManager` scans JAR bytes. Both assume
  in-process execution of third-party code, which is the thing this milestone
  forbids.

## Decision

### 1. Three tiers

1. **Core** — notes, tags, graph, auth, blueprint interpreter. One
   deployable, the hub.
2. **INTERNAL plugins** — first-party, trusted, in-process (unchanged; this
   is why the Pi path keeps working).
3. **EXTERNAL plugins** — separate workloads with their own image,
   Deployment, ServiceAccount, NetworkPolicy, and resource limits, speaking
   the versioned gRPC plugin contract. Third-party/marketplace code lands
   here **by policy, never in-process** (#395 makes that mechanical). Heavy
   or risky first-party components may graduate here; the script sandbox is
   the pilot (#393).

### 2. Trust policy

The JAR path (`PluginSecurityManager` scanning, `PluginLoader` class
loading) is **not** a sufficient boundary for third-party code and stops
being offered one. The enforced boundary for non-first-party code is the pod:
dedicated ServiceAccount, deny-by-default NetworkPolicy (ingress from core
only; egress to core gRPC + broker only), CPU/memory limits, read-only root
filesystem, non-root user. The reference posture ships with the pilot and is
baked into the reusable chart (#394), not opted into per plugin.

### 3. Wire contract: the existing gRPC surface, versioned as v1

The existing protos **are** the contract; they are extracted from the
backend into a standalone Maven module (`plugin-contract`) that plugin
authors can depend on without the core, declared **v1**, and evolved
additively only (new fields/RPCs/services; never renumber, never repurpose —
same discipline as ADR 0003's envelope). Missing pieces added in #390:
an event-delivery service (server-streaming subscribe + publish), an
outbound client for core→plugin lifecycle calls, and per-call permission
gating on the Note/User callback surface backed by the persisted
`plugin_permissions` grants (closing the gap where `PluginSecurityManager`
grants lived only in memory).

REST is rejected for plugin control-plane traffic: the contract is verb-rich
and streaming-shaped (lifecycle, health, event streams), the gRPC server and
stubs already exist, and one wire surface is cheaper to secure than two.
mTLS between core and plugin workloads is delegated to the mesh/NetworkPolicy
layer in v1 and revisited when a real multi-tenant cluster demands it.

### 4. Eventing: NATS bridge, feature-flagged

A broker bridges `PluginEventBus` beyond the JVM. **NATS** over
Kafka/RabbitMQ:

| | NATS | Kafka | RabbitMQ |
|---|---|---|---|
| Footprint | single ~20 MB binary, arm64 image | JVM + controller quorum | Erlang runtime |
| Ops burden | none to start (core NATS) | partitions, retention, KRaft | exchanges/queues config |
| Fit | pub/sub fan-out of small JSON events — exactly our shape | replay/log semantics we don't need yet | routing semantics we don't need |

Kafka's durability/replay story is real but is not a v1 requirement; NATS
JetStream is the recorded upgrade path if durable delivery becomes one.
Delivery is **at-most-once** in v1 and documented as such — the in-JVM bus
has the same semantics today.

The bridge (`modulo.plugins.broker.enabled=false` by default) republishes
in-JVM events to `modulo.events.<type>` subjects and injects broker messages
back onto the in-JVM bus, with origin tagging so bridged events never
re-bridge. The envelope (JSON: type, schema version, timestamp, origin,
payload) is shared with the gRPC event stream so a plugin may choose either
transport.

### 5. Degradation guarantees

Every EXTERNAL capability is absent-able:

- Broker flag off (the default, and the Pi/minimal compose state): core
  behaves exactly as today. Flag on but NATS unreachable: log, degrade,
  never block the in-JVM publish path.
- No plugin workloads deployed: the manager simply has no EXTERNAL entries;
  nothing polls, nothing fails.
- An EXTERNAL plugin down: health polling marks it unhealthy and surfaces it
  in the existing status endpoints; the core never crashes or blocks on a
  plugin pod. Components with in-process fallbacks (the script sandbox
  pilot) route back to the in-process path automatically — the same pattern
  IPFS and anchoring degrade with today.

### 6. The pilot

#393 extracts sandboxed script execution as the first EXTERNAL workload —
it exists to run untrusted code, hides behind the one-method `ScriptSandbox`
seam (already extracted by the WASM milestone, #396/#397), and gains a
categorically better boundary from pod isolation. The extracted service runs
the WASM engine (`WasmScriptSandbox`); the core routes to it when healthy
and falls back in-process otherwise.

### 7. Non-goals

- No rewrite of INTERNAL plugins; the JAR path remains for first-party code.
- The frontend workspace plugin runtime (browser-side view contributions) is
  orthogonal and unchanged.
- No automated deploy-on-approve for marketplace submissions in this
  milestone (#395 documents it as follow-up); an operator applies the chart.
- No JetStream/durable delivery, no mTLS management, no plugin SDKs beyond
  the published contract stubs — all recorded as future work, not silently
  implied.

## Alternatives considered

- **Harden the in-JVM sandbox instead** (SecurityManager, classloader
  isolation): the JDK is deprecating the SecurityManager, JAR scanning is
  heuristic, and one escape owns the core. Rejected — this is the status quo
  the milestone exists to end.
- **REST control plane**: rejected above (§3).
- **Kafka / RabbitMQ**: rejected above (§4) on footprint vs. need.
- **Sidecar-per-plugin instead of standalone Deployments**: couples plugin
  lifecycle to core rollouts and shares the pod boundary; rejected.

## Consequences

- The backend gains its first outbound gRPC client and its first
  broker dependency (optional, flagged).
- The protos move out of `backend/` into a published contract module —
  backend code keeps the same generated packages, plugin authors get a
  dependency without the core.
- The submission pipeline's JAR orientation becomes a policy violation for
  third-party code; #395 replaces it with image-reference submissions and
  makes in-process loading of non-first-party origins a mechanical refusal.
- `k8s/plugins/` + `argocd/apps/plugins/` become the standing pattern for
  every future plugin workload (#394); the audit-collector precedent
  (in-repo service with its own Dockerfile) extends to plugin services.
