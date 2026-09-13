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
| Feed inbox view and user-triggered triage | Feed item ID/version, unread/decision state, Awareness session revision | Noesis |
| Escalation navigation | `origin` session and source/annotation references in the new mode | Noesis |
| User-authored notes, tasks, calendar blocks, local planning | Optional versioned `workspace_links` on a Noesis handoff | Modulo for edits; Noesis stores only references |
| Acquired source text, publication time, corrections, citations | Versioned feed or Exploration source | Noesis |

The current plugin stores only preferences in Modulo plugin state. It shows up to 50 feed items, supports subscriptions, explicit refresh, daily Awareness triage, and promotion into Exploration. The bridge also exposes the supported generic intake session tools to future plugin surfaces. It does not yet migrate `modulo-information-intake-v1` browser-local items, sessions, artifacts, projects, or transitions; it does not create authoritative Modulo item/project/note IDs for every feed item. The full cross-repo object map, stale-reference resolution, correction/retraction propagation, second-device migration, and all ten mode journeys remain open. A session export's SHA-256 digest checks integrity but does not authenticate the exporter.

## Retry and failure behavior

The plugin saves an Awareness start request key in durable plugin state before calling Noesis, then reuses that key if the response is lost. It clears the pending key after storing the returned session ID. Item decisions use a command key and expected session revision; after an error the view reloads Noesis state to resolve a possible committed result or revision conflict. Modulo does not cache Noesis source content in plugin state. The backend caps request and response sizes and returns no Noesis credentials. Offline Modulo preference edits use the existing plugin-state queue; Noesis mutations require a live connection and are not queued by this initial plugin.
