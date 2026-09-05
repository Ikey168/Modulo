# Pack Studio

Open **Pack Studio** in the workspace to assemble a v2 pack. **New Audit draft** supplies the reference Audit resources; **New Knowledge Base draft** supplies the knowledge workspace. Set the pack ID and version, select each contribution, and edit its fields. The picker supports plugins, Blueprints, property schemas, templates, saved queries, views, dashboards, workspace modes, permission presets, and optional demo data.

For an Audit package, select **Human review** and replace the reviewer account ID. You can also import an owned saved Blueprint. The Blueprint editor opens in a separate tab; save there, refresh the Studio list, and import the graph. Imported graphs are copies in the draft. Plugin contributions identify an already provisioned image; authoring does not provision a runtime.

Validation reports the affected contribution and field, including missing or incorrectly typed references, query properties, prerequisites, and cycles. Preview shows dependency relationships, requested capabilities, navigation, and sample view/dashboard layouts. It does not install resources, query user notes, or enable workflows. The installation review remains a separate step under **Installed packs**.

**Save private draft** stores source under the current owner with optimistic revision checks. A stale save is rejected; reload the draft before editing again. Drafts may contain incomplete contributions, but preview and publication require a valid manifest. Import/export uses JSON files of at most 2 MiB.

The server preview returns deterministic source and its SHA-256 digest. **Export manifest source** downloads those exact bytes. Any edit invalidates the preview and publication consent. Publication requires explicit confirmation that the entire manifest, including Blueprint and plugin configuration, can become public on IPFS. Do not include credentials in public pack configuration.

Publication uploads, pins, retrieves, and compares the source digest before recording `PUBLISHED`. A failed transport, pin, or content check records `FAILED`; it never invents a CID or successful receipt. Retrying the same version and source is idempotent. A version already reserved for different source requires a new version. The publication history exports the exact recorded source. IPFS publication alone neither verifies the publisher nor anchors the package on a chain; the UI and receipt state this explicitly.

The frontend image has a standalone build context. Run `python3 scripts/sync-pack-assets.py` after editing the authoritative backend manifest schema or shared example packs. CI runs the same command with `--check` to detect stale frontend copies.

API: authenticated `/api/pack-studio/preview`, `/drafts`, `/drafts/{id}`, `/publish`, `/publications`, and `/publications/{id}/source`. Drafts and publication records are owner scoped. Preview has no storage side effects. Flyway V15 adds private drafts and immutable version/source publication records.
