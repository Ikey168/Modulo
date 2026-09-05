# Pack Manifest v2

Version 2 describes a complete workspace pack. The executable JSON Schema is
[`pack-manifest-v2.schema.json`](../../backend/src/main/resources/pack-manifest-v2.schema.json).
The same schema drives the backend and frontend structural validators; semantic
validation additionally checks references, capability declarations, compatibility,
and dependency order.

Examples:

- [Knowledge Base](../../shared/packs/knowledge-base.v2.json): schema, template,
  saved query, table, board, dashboard, workspace mode, and optional demo records.
- [Security Audit](../../shared/packs/security-audit.v2.json): those contributions
  plus the approval Blueprint and an explicit review permission preset.

## Identity and compatibility

`manifestVersion: 2` selects this contract. `id` is a lowercase namespaced pack ID,
`version` is a bounded three-component semantic version, and `name` is the display
name. `minIrVersion` and `minCatalogVersion` must be supported before planning.
Dependencies name another pack and its minimum version. Installation checks their
presence and versions; self-dependencies and duplicate dependencies are invalid.

A resource ID is a stable lowercase local identifier, unique within its pack.
The logical identity is `(installation owner, pack ID, resource ID)`. Display
names may change; resource IDs should remain stable across releases. Resource
IDs must not embed database IDs, foreign owner IDs, or credentials.

Each resource declares `kind`, `title`, `requires`, `capabilities`, and `spec`.
`requires` lists local resource IDs that must exist before it can be installed.
References must resolve to the expected kind, appear in `requires`, and form an
acyclic graph. The validator returns a deterministic dependency-first order.
Cross-pack resources must be accessed through an installed dependency's public
interface; raw cross-owner or cross-pack database references are not accepted.

## Contributions and capabilities

| Kind | Required capability | Specification |
| --- | --- | --- |
| `plugin` | `plugins:install` | Immutable digest-pinned image, runtime, optional configuration |
| `blueprint` | `blueprints:write` | Versioned Blueprint IR; action capabilities must also be declared |
| `propertySchema` | `properties:schema` | Unique typed fields, with explicit options for select fields |
| `template` | `templates:write` | Title, Markdown, optional property-schema reference |
| `savedQuery` | `queries:write` | Property-schema reference and filters on existing fields |
| `view` | `workspace:configure` | Query reference and table/list/card/board layout |
| `dashboard` | `dashboard:configure` | References to contributed views |
| `workspaceMode` | `workspace:configure` | View references and optional dashboard reference |
| `permissionPreset` | `permissions:request` | Requested capabilities, never automatic grants |
| `demoData` | `notes:write` | Template reference and bounded explicitly identified demo records |

Every resource capability must appear in the root capability list. Permission
presets must declare every requested permission both locally and at the root.
Blueprint actions are checked against the runtime's capability map. A declaration
is a request for consent, not an authorization grant. Plugin image references
are pinned by SHA-256; image trust and provisioning still require install checks.

Unknown resource kinds, unknown v2 fields, duplicate identifiers, malformed
specifications, unresolved references, cycles, undeclared capabilities, and
incompatible versions fail validation before mutation. Limits include 256
resources, 2 MiB total serialized manifest data, and nesting depth 32.

## Ownership, upgrades, and removal

Version 2 requires these policies:

```json
{
  "upgrade": "preserve-user-content",
  "removal": "preserve-user-content",
  "demoData": "opt-in"
}
```

Pack-owned configuration can be replaced by a new release or restored by
rollback. User-created content and edited demo content remain user-owned and are
not overwritten or deleted by configuration replacement. Installation records
must distinguish contributed configuration, created demo records, and later
user-owned content. Removing a resource removes its pack contribution, not
unrelated notes or private operational state. Demo creation requires explicit
install-time opt-in; a manifest cannot opt the user in.

An upgrade plan must explain removed IDs and changed capabilities before apply.
Replacing a resource with a different kind under the same ID is incompatible;
author a new ID and an explicit migration instead. Permission presets never
silently widen grants on upgrade. Uninstall and rollback preserve user content.

## v1 migration and author validation

An omitted `manifestVersion` still selects v1. Existing `contributes.nodes` and
`contributes.blueprints` manifests continue through the existing installer.
Resources require v2; they are never silently ignored under v1. V2 uses the
`resources` collection and does not mix in legacy node/Blueprint contribution
arrays. Empty `contributes` remains accepted for compatibility with existing
frontend manifest containers.

To migrate, give each contribution a stable resource ID, move Blueprint IR into
`spec.ir`, declare reference dependencies and capabilities, and add the required
preservation policies. Plugin registration/provisioning is represented explicitly
by a plugin resource; arbitrary executable node descriptors cannot be smuggled
through the v2 legacy arrays.

`POST /api/packs/validate` returns `ok`, a classified failure reason, and the
resource order. It performs no mutation. The legacy installer rejects v2 with `V2_REQUIRES_WORKSPACE_INSTALL_PLAN`
instead of installing only a subset. Use the workspace pack plan/apply API
documented in [transactional installation](../operations/workspace-packs.md).

The backend and frontend tests load the same examples, reject malformed and
unknown fields (including prototype-named properties), test missing/cyclic
references and capability omissions, and retain v1 install coverage. The schema
uses a deliberately bounded subset of JSON Schema draft-07: type, enum, object
properties/required/additionalProperties, arrays/items/uniqueness/bounds,
string patterns/bounds, and oneOf. The validators do not fetch remote schemas.
