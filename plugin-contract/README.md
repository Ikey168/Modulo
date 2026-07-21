# Modulo plugin contract (v1)

The versioned gRPC contract between the Modulo core and EXTERNAL plugin
workloads ([ADR 0004](../docs/architecture/adr-0004-external-plugin-tier.md),
issue #390). This module publishes the generated Java stubs so a plugin
author can implement or call the contract **without depending on the core**:

```xml
<dependency>
  <groupId>com.modulo</groupId>
  <artifactId>plugin-contract</artifactId>
  <version>1.0-SNAPSHOT</version>
</dependency>
```

## What's in the contract

Proto sources live in `backend/src/main/proto/` (single source of truth —
this module generates from that directory, so core and contract cannot
drift). Package `com.modulo.plugin.grpc`:

| Proto | Service | Implemented by | Purpose |
|-------|---------|----------------|---------|
| `plugin_service.proto` | `PluginService` | **the plugin** | lifecycle (Initialize/Start/Stop/Shutdown), status, health, info, capabilities, configuration, execute |
| `plugin_host_service.proto` | `PluginHostService` | **the core** | permission-gated note operations + event publish/subscribe — what a plugin may call back into |
| `note_plugin_service.proto` | `NotePluginService` | the plugin (optional) | note-processing hooks a note-oriented plugin can expose |
| `user_plugin_service.proto` | `UserPluginService` | the plugin (optional) | user-oriented hooks |

### Authentication on the host surface

Every `PluginHostService` call carries two ASCII metadata headers:
`plugin-id` and `plugin-token` (the token is issued by the core at
registration). Calls without them fail `UNAUTHENTICATED`; calls whose plugin
lacks the RPC's permission fail `PERMISSION_DENIED`:

| RPC | Required permission |
|-----|--------------------|
| `GetNote`, `SearchNotes` | `notes.read` |
| `SaveNote`, `AddNoteMetadata` | `notes.write` |
| `DeleteNote` | `notes.delete` |
| `PublishEvent` | `system.events.publish` |
| `SubscribeEvents` | `system.events.subscribe` |

### The event envelope

`EventEnvelope` (id, type, schema_version, timestamp, origin, json_payload)
is shared with the NATS bridge (#391): the same JSON body flows on either
transport, so a plugin may choose gRPC streaming or the broker. `origin` is
asserted by the core (`core`, `plugin:<id>`) and drives loop protection —
never trust or forge it. Payloads are shallow (entity identity + event
metadata); fetch full entities through the gated host API.

## Evolution rules (binding)

1. **Additive only.** New fields, new RPCs, new services are fine. Existing
   field numbers are never renumbered, repurposed, or type-changed.
2. **No semantic re-use.** A field that changes meaning is a new field.
3. **Breaking change ⇒ new name.** A genuinely incompatible surface arrives
   as `PluginHostServiceV2` (etc.) alongside the old one, never by mutating
   v1. Removal of v1 needs a deprecation cycle across a released version.
4. **Envelope payloads follow the same rule**, governed by
   `schema_version` — bump it only with a new additive shape, keep parsing
   lenient.
