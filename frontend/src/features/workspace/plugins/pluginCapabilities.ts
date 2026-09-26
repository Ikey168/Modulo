import type { Capability } from '../../../platform/capabilities';

/**
 * Device and service capabilities each plugin's workflows need (#489). The
 * Android inventory check fails when a plugin module uses a device feature
 * that none of its plugins declares, so a new plugin must add its entry here.
 * Capabilities every platform provides without a permission (clipboard) are
 * not declared.
 */
const SAVE: Capability[] = ['files.save'];
const SAVE_AND_LINKS: Capability[] = ['files.save', 'links.external'];
const PICK: Capability[] = ['files.pick'];
const WORKSPACE_TOOL: Capability[] = ['files.pick', 'files.save', 'camera.capture'];
const AWARENESS: Capability[] = ['files.pick', 'files.save', 'links.external'];
const LIFE_OS: Capability[] = ['files.pick', 'files.save', 'backup.archive'];

export const PLUGIN_CAPABILITIES: Readonly<Record<string, readonly Capability[]>> = {
  // Self-hosted integrations that call remote services
  'feeds-reading-inbox': ['remote.fetch'],
  'web-archive-read-later': ['remote.fetch', 'links.external'],
  'web-watch': ['remote.fetch', 'notifications.local'],
  'caldav-sync': ['remote.fetch'],
  'remote-notification-gateway': ['remote.fetch', 'credentials.secure'],
  'document-inbox-ocr': ['files.pick', 'documents.ocr'],
  'pdf-toolkit': ['files.pick', 'files.save', 'pdf.tools'],
  'managed-files': ['device.folders'],
  // Foundation tools
  'reminders-notifications': ['reminders.scheduled', 'notifications.local'],
  'universal-attachments': ['files.pick', 'files.save', 'links.external'],
  'metadata-artwork-resolver': ['remote.metadata', 'credentials.secure'],
  'media-diary-reviews': SAVE_AND_LINKS,
  'lists-rankings': SAVE,
  'reading-annotations': SAVE_AND_LINKS,
  'bookmark-read-later': SAVE_AND_LINKS,
  'citation-manager': SAVE_AND_LINKS,
  'learning-goals': SAVE,
  'flashcards-spaced-repetition': SAVE,
  // Life OS: every Life OS view module imports the shared LifeOsViews surface,
  // which offers backup export/import alongside the explorer and dashboard.
  'life-os-dashboard': LIFE_OS,
  'life-os-explorer': LIFE_OS,
  'life-os-relations': LIFE_OS,
  'life-os-review': LIFE_OS,
  'life-os-portability': LIFE_OS,
  // Workspace tools
  'executable-runbooks': WORKSPACE_TOOL,
  'living-documents': WORKSPACE_TOOL,
  'project-workspaces': WORKSPACE_TOOL,
  'universal-inbox': WORKSPACE_TOOL,
  'workspace-briefings': WORKSPACE_TOOL,
  'workspace-capsules': WORKSPACE_TOOL,
  'workspace-time-machine': WORKSPACE_TOOL,
  'local-folder-bridge': ['device.folders', 'files.pick', 'files.save'],
  // Awareness
  'daily-briefing': AWARENESS,
  'newsletter-inbox': AWARENESS,
  'topic-watchlists': AWARENESS,
  // Advanced note tools
  'ai-summary': SAVE_AND_LINKS,
  'auto-linker': SAVE,
  'focus': SAVE,
  'github-sync': SAVE_AND_LINKS,
  'graph-stats': SAVE,
  'ipfs-attach': SAVE_AND_LINKS,
  'latex': SAVE,
  'mermaid': SAVE,
  'pdf-export': SAVE,
  'semantic-search': SAVE,
  'timestamp-proofs': SAVE,
  'web3-id': SAVE_AND_LINKS,
  // Imports, exports and reports
  'para-notion-migration': ['files.pick', 'files.save'],
  'audit-reports': SAVE_AND_LINKS,
  'audit-core-browser': PICK,
  'audit-core-findings': PICK,
  'audit-core-overview': PICK,
  'audit-core-remediation': PICK,
  'audit-core-report': PICK,
  'audit-core-scope': PICK,
  'audit-core-tests': PICK,
  'audit-core-threats': PICK,
  'canvas-board': SAVE,
  'decision-journal': SAVE,
  'skill-tree': SAVE,
  'euer-datev': SAVE,
  'rechnung': SAVE,
  'notes-editor': SAVE,
  'todo-lists': SAVE,
  'zeiterfassung': SAVE,
};
