# Gmail newsletter connection

Modulo connects one Gmail or Google Workspace mailbox per user using the Gmail API's read-only scope. A web OAuth client is required; this connector is separate from signing in to Modulo.

## Google Cloud setup

1. Enable the Gmail API in the OAuth client's Google Cloud project.
2. Add the Gmail read-only scope (`https://www.googleapis.com/auth/gmail.readonly`) to the consent configuration. If the app is in testing, add the connecting Google account as a test user. Workspace administrators may need to allow the app.
3. Add this exact authorized redirect URI to the **Web application** OAuth client:

   `https://modulo.141.147.5.114.sslip.io/api/public/gmail/callback`

4. Configure Oracle with `MODULO_GMAIL_CLIENT_ID` and `MODULO_GMAIL_CLIENT_SECRET`. The existing `MODULO_SECURITY_ENCRYPTION_KEY` protects stored refresh tokens. The Compose configuration sets the callback URI from `MODULO_URL`.
5. Recreate the backend after changing those environment values.

Google may limit or expire authorizations for apps in testing; the UI reports when reconnection is needed. Gmail read access is a restricted scope, so public distribution may require Google's verification process. See [Google's scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes) and [web OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## Connect and choose messages

In the Modulo website, open Knowledge → Awareness → Newsletter Inbox → Connect Google account. Complete consent in the popup. Choose a Gmail search and click Save search and sync.

Examples:
- `label:newsletters newer_than:30d` (create the label in Gmail if it does not exist)
- `category:promotions newer_than:7d`
- `from:newsletter@example.com newer_than:30d`

A new or reconnected account starts with syncing paused. Saving the search explicitly enables it. Oracle checks approximately every 15 minutes, continuing large result sets in smaller batches. It imports readable text into separately synchronized Newsletter Inbox records; the other Awareness plugins consume those records normally. Mobile apps receive the imported issues too; initial Google consent is completed on the Modulo website.

Saved and archived states in Modulo do not modify Gmail. Imported Gmail IDs are stable per mailbox and existing issue records are preserved. Pausing stops polling. Disconnecting deletes local credentials and attempts to revoke Google's grant; imported newsletters remain available.

## Implementation and checks

OAuth state is single-use, expires after ten minutes, and is bound to an HttpOnly browser cookie and the initiating Modulo owner. Authorization codes use PKCE. Refresh tokens are encrypted with AES-GCM and owner-bound authenticated data, and never enter plugin-state or frontend storage. Requests use fixed Google endpoints, bounded response sizes, and timeouts.

PostgreSQL integration tests cover callback cookie binding, replay rejection, tenant isolation, source import, preservation of archived issues, and disconnection. Unit tests cover token encryption, owner binding, scope/PKCE settings, and safe readable text extraction. Frontend tests cover configuration, consent launch, explicit search selection, and disconnect.
