# Modulo → Noesis browser capture

This is a small Manifest V3 WebExtension for the Desktop-tagged browsing
workflow. It adds a `Send to Noesis` context menu and a popup with explicit
actions:

- Save source
- Research page
- Verify claim
- Find original
- Find related work
- Find counterarguments
- Explain
- Deep research
- Monitor topic

The capture unit is always explicit: page, selected text, PDF URL, or selected
tabs. A capture is sent as the Noesis `document-ingest-v1` `web` document to
`POST /api/v1/documents/ingest`. The selected action and its bounded request
are retained in `metadata`, together with the bounded `information-intake`
return route; the extension does not invent a free-form command.

## Load locally

1. Start Noesis locally, or configure a reachable HTTPS Noesis endpoint.
2. Open Firefox `about:debugging#/runtime/this-firefox` (or the Chromium
   extensions page with developer mode enabled).
3. Load `desktop/browser-extension/manifest.json` as a temporary/unpacked
   extension.
4. Open the extension popup, set the endpoint and optional API key, and save.

The default endpoint is `http://127.0.0.1:8100/api/v1/documents/ingest`. Plain
HTTP is rejected for non-loopback hosts. A remote HTTPS origin requires an
explicit browser permission grant the first time it is used.

## Capture and privacy boundary

- Page text is read only after the user invokes the action. The `activeTab`
  permission avoids a permanent all-sites read permission.
- A selected tab group sends URL/title provenance for non-active tabs; only the
  active tab's visible text is read. This prevents a group capture from
  silently reading every open page.
- Private browsing, browser-internal pages, file URLs, URL credentials, and
  non-HTTP(S) sources are rejected. The manifest is not enabled in private
  windows.
- Requests use `credentials: omit`, `no-referrer`, and `no-store`. Cookies,
  authorization headers from the page, history, and unrelated tabs are never
  copied. The API key stays in extension storage and is not exposed to page
  JavaScript.
- A bounded local queue retains at most 50 explicitly captured documents. A
  failed request remains queued with an exponential retry delay; successful
  delivery removes it. Duplicate document IDs are not submitted twice.
- Context fields are optional metadata only (`projectId`, `areaId`, `noteId`,
  `taskId`, and a question). They let the eventual Noesis result route back to
  Modulo without putting private page content in a URL.

The extension is intentionally a capture and handoff surface. It does not
automatically browse, poll sources, capture authenticated sessions, or start a
research run without the user's selected action.
