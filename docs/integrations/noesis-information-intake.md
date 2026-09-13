# Modulo Information Intake ↔ Noesis

This is the initial signed-in bridge for [Modulo #474](https://github.com/Ikey168/Modulo/issues/474) and [Noesis #1569](https://github.com/Ikey168/Noesis/issues/1569). Install the **Information Intake** workspace plugin. The plugin calls Modulo's `/api/integrations/noesis/intake` facade, which opens a new authenticated Noesis Streamable HTTP MCP session per request. The browser never receives a Noesis token. The existing Noesis Daily Brief Blueprint plugin remains a separate, read-only input.

## Configuration and identity

Set `NOESIS_INTAKE_MCP_URL` to the Noesis Knowledge Engine `/mcp` endpoint and `NOESIS_INTAKE_CREDENTIALS_FILE` to a server-only JSON file. HTTPS is required except for a loopback HTTP endpoint. The bridge does not follow redirects or use environment proxies. Give the credentials file owner-only permissions on a POSIX filesystem (`chmod 600`). Its keys are Modulo's authenticated numeric user IDs:

```json
{"1":{"token":"the-per-user-noesis-bearer-token"}}
```

Configure Noesis's `NOESIS_MCP_AUTH_TOKENS_FILE` with the same token mapped to one unique `client_id` and the required `knowledge:intake:*` and `namespace:<name>:*` scopes. The Noesis `client_id` is the owner of Noesis intake sessions and feed items. Modulo selects a token only from its authenticated user ID, never from a request argument. A missing mapping, unavailable Noesis, or an unsupported tool produces an explicit preflight/bridge error. The bridge allowlists intake tools; Noesis enforces namespace and object access on every call. `knowledge:intake:fetch` is needed for feed refresh and live Exploration page acquisition.

## Current authority and mapping

| Modulo object or field | Noesis object or field | Authority |
| --- | --- | --- |
| Signed-in user and plugin installation | Per-user MCP token and Noesis intake owner | Modulo authenticates; Noesis authorizes its objects |
| Plugin preference `namespace` and `lastSessionId` | Session `namespace` and `session_id` | Modulo stores navigation preference; Noesis stores run state |
| Plugin-state `item.<feed-hash>` link record | Feed item ID/source version and `workspace_links` in a promoted session | Modulo owns the local link record; Noesis owns source and transition history |
| Feed inbox view and user-triggered triage | Feed item ID/version, unread/decision state, Awareness session revision | Noesis |
| Escalation navigation | `origin` session and source/annotation references in the new mode | Noesis |
| User-authored notes, tasks, calendar blocks, local planning | Optional versioned `workspace_links` on a Noesis handoff | Modulo for edits; Noesis stores only references |
| Acquired source text, publication time, corrections, citations | Versioned feed or Exploration source | Noesis |
| Browser-local `modulo-information-intake-v1` records | `legacy.<collection>.<id-hash>` plugin-state records and a `migration.<source-hash>` report | Modulo; raw user fields and IDs are retained |

The current plugin stores preferences and a versioned Modulo intake-item link when an Awareness item is promoted. It shows up to 50 feed items, supports subscriptions, explicit refresh, daily Awareness triage, and promotion into Exploration. The bridge also exposes the supported generic intake session tools to future plugin surfaces. It does not create Modulo item records for unpromoted feed entries or link projects and notes. The full cross-repo object map, stale-reference resolution, correction/retraction propagation, second-device acceptance, and all ten mode journeys remain open. A session export's SHA-256 digest checks integrity but does not authenticate the exporter.

## Migrating Modulo's own intake records

Open **Existing Modulo intake** on the device that holds the old `modulo-information-intake-v1` browser store. **Preview local intake** reads that key in the browser and refreshes the authenticated Information Intake plugin-state namespace. It counts all twelve version-1 collections, compares stable per-record IDs and content hashes with existing plugin state, flags duplicate URLs and missing local item/project references, and blocks unknown top-level collections, malformed IDs, oversized records, or conflicting remote versions before writing. Raw record objects are retained so user-specific fields are not normalized away. A 20 MB local store and 5,000-record budget bound this path.

**Import into plugin state** stages one record per original Modulo ID, then an import report with the source digest, counts, and record keys. The plugin-state client synchronizes those records across signed-in clients and queues writes if connectivity drops after preflight. Repeating the import skips matching records; a changed record requires conflict resolution and a fresh preview. The local browser store is never deleted. **Undo unchanged import** checks the report and rehashes every imported payload before tombstoning records, so it refuses to discard later edits. A later import can restore those tombstones. The UI distinguishes confirmed records from queued writes and conflicts. Noesis source/evidence objects are not created from these legacy records merely because they share a URL; linking them requires the native source workflows and an explicit mapping decision.

## Retry and failure behavior

The plugin saves an Awareness start request key in durable plugin state before calling Noesis, then reuses that key if the response is lost. Before promotion, it creates or updates an owner-scoped item-link record in Modulo plugin state, waits for synchronization, and passes its stable ID and object version to Noesis as a return link. It clears the pending key after storing the returned session ID. Item decisions use a command key and expected session revision; after an error the view reloads Noesis state to resolve a possible committed result or revision conflict. Modulo does not cache Noesis source content in plugin state. The backend caps request and response sizes and returns no Noesis credentials. Offline Modulo preference edits use the existing plugin-state queue; Noesis mutations require a live connection and are not queued by this initial plugin.
