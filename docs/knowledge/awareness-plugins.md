# Awareness plugins

Daily Briefing, Topic Watchlists, and Newsletter Inbox are independently installable Awareness tools. Knowledge packs include all three. Existing legacy research installations gain them through startup dependency repair.

## Daily Briefing

Combines synchronized feed items, Web Watch records marked Changed, and unarchived newsletter issues. It groups canonical article URLs after removing common tracking parameters; entries without URLs group by normalized exact title. It does not infer that differently titled articles describe the same event.

The 15-minute scan timer and reviewed-story markers are account-scoped. Changed story content or a new source revision resurfaces a reviewed story. Dismissal affects only the briefing and can be undone.

## Topic Watchlists

Matches any case-insensitive keyword or phrase in titles, bodies, and URLs; exclusion keywords take precedence. Each watchlist can link to a PARA main area or subarea. Watchlists can be edited or paused. Matches appear in the plugin and can filter the briefing.

Matching applies to information captured in Modulo, not autonomous web search or mailbox polling.

## Newsletter Inbox

Accepts pasted issues and exported `.eml` files. MIME parsing supports encoded headers and bodies and HTML-only email. Messages are displayed as text; attachments are not imported. Message IDs prevent repeated imports from resetting triage status. Pasted issues deduplicate by subject, sender, and body.

Import limits: 20 emails at once, 2 MB per source file, 200,000 characters per decoded issue. Each issue is a separate synchronized record. Users can read, save, archive, and restore issues.

Mailbox accounts and automatic forwarding are not configured. Existing feed and web-watch synchronization behavior is unchanged.

## Storage and checks

New state uses the account-scoped plugin-state service and durable replica, with no new localStorage/sessionStorage access. Newsletter records use schema `newsletter/1`; watchlists and briefing preferences use the established workspace-tool schema.

Tests cover persistence and account closure, email decoding, unsafe links, duplicate imports and stories, resurfacing changed content, watchlist exclusions and Area selection, newsletter triage, briefing dismissal, catalog membership, and existing-installation expansion.
