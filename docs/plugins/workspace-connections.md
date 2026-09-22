# Search, document capture, references and offline notes

The existing plugins now share more of their content. No new plugin installation is required for search or note references.

## Search

Open **Search and commands** with Ctrl/Cmd+K. Results include notes, existing Life OS collections, Project Workspaces, Decision Journal records and executable runbook receipts. Search matches nested record text such as OCR output, checklists and review history; title matches rank first, and results show excerpts. Project, decision and receipt results open their exact record. Enabled account-scoped plugin stores are loaded even before their views are visited and update as their records change.

**Semantic Search & Ask Modulo** also shows workspace matches. Browser record text is split into bounded batches and ranked by the existing local embedding provider through `/api/knowledge/workspace-search`. This endpoint does not persist the submitted corpus or send it to remote providers. Keyword matches remain available when it cannot be reached. Existing note semantic retrieval and cited answers continue to use the note index; workspace record matches are not presented as note citations. Credential fields are excluded from record search text.

## Document capture

In **Document Inbox & OCR**, choose **Import file** to import text, Markdown, email text, PDF, PNG, JPEG or WebP from the browser. The flow extracts text, creates a source note, uploads the original attachment and links the inbox record to the note. Source notes retain the document name, checksum and provenance marker. Retrying reuses the marked source note and checks for an already uploaded original.

Desktop-imported documents also have **Create source note**. Their original desktop file stays in place, and the source note retains its location and checksum.

In a note's **Document text** panel, choose **Extract text**, review or correct the result, then choose **Add reviewed text to note**. The original attachment remains unchanged. A provenance marker prevents inserting the same attachment extraction twice. Added text participates in normal note search, semantic indexing and cited answers. Changes made to the note after review cause the insertion to stop for another review.

Extraction runs locally on the Modulo server. Plain text needs no additional tools. PDF extraction uses Poppler's `pdftotext`; image OCR uses Tesseract. The backend Dockerfile installs both. Native server installations need those commands on PATH. Uploaded files are limited to 10 MB; extracted text is limited to 500,000 characters. Extraction jobs have a 20-second timeout and a concurrency limit. Empty, unsupported, encrypted or unreadable documents produce an error; scanned PDFs need OCR before import. OCR output should be reviewed for accuracy. No deployment or host package installation is performed by this code change.

## References

The Notes **Referenced by** panel lists project membership, procedure receipts, decisions, flashcards and other indexed records with explicit note references. It follows numeric note IDs, `sourceNoteId`, `note:<id>` sources and serialized evidence references. Arbitrary numbers and prose mentions are not interpreted as relationships. Links open the source record. Existing note-to-note backlinks remain available beside it.

## Offline notes

After a signed-in account loads its notes online, the workspace caches notes, tags and links on that device. Existing note edits are durably queued with their reviewed server version, survive reload and replay on reconnect or with **Retry note sync**. The synchronization notice distinguishes device-saved edits from acknowledged server saves.

If another client changed a note, synchronization preserves both copies for review. **Keep local edit** writes against the displayed remote version; another intervening edit requires a new review. **Use server copy** discards the queued local edit. **Export local edits** downloads the recovery cache. An uncertain successful update is recognized by its resulting content to avoid writing it twice.

Caches and editor drafts are scoped to the account. Requests reject account changes, and another account cannot replay a previous account's draft queue. Browser Web Locks serialize cache writes across tabs. Storage failures reject durable edits rather than reporting them saved.

This covers reading cached notes and editing existing notes. Creating server-backed notes, uploading attachments, changing links/tags and executing workflows still require connectivity. Offline access requires an available authenticated session and previously loaded application assets; it does not bypass login. The service worker caches application assets, never API responses. Legacy unscoped editor drafts remain untouched in browser storage and are not automatically claimed by an account.
