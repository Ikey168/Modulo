import {
  BellRing,
  CalendarSync,
  Eye,
  FileSearch,
  Files,
  Newspaper,
  ScanText,
  type LucideIcon,
} from 'lucide-react';
import type { LifePluginConfig } from './lifeConfigs';

export const FEEDS_READING_PLUGIN_ID = 'feeds-reading-inbox';
export const WEB_ARCHIVE_PLUGIN_ID = 'web-archive-read-later';
export const WEB_WATCH_PLUGIN_ID = 'web-watch';
export const DOCUMENT_INBOX_PLUGIN_ID = 'document-inbox-ocr';
export const PDF_TOOLKIT_PLUGIN_ID = 'pdf-toolkit';
export const MANAGED_FILES_PLUGIN_ID = 'managed-files';
export const CALDAV_SYNC_PLUGIN_ID = 'caldav-sync';
export const NOTIFICATION_GATEWAY_PLUGIN_ID = 'remote-notification-gateway';

export interface SelfHostedToolDefinition {
  pluginId: string;
  label: string;
  description: string;
  category: string;
  subcategory: string;
  mode: string;
  section: string;
  order: number;
  icon: LucideIcon;
  services: string[];
  config: LifePluginConfig;
}

const tool = (
  pluginId: string,
  label: string,
  description: string,
  category: string,
  subcategory: string,
  mode: string,
  section: string,
  order: number,
  services: string[],
  config: Omit<LifePluginConfig, 'id' | 'title' | 'description' | 'icon'>,
  icon: LucideIcon,
): SelfHostedToolDefinition => ({
  pluginId, label, description, category, subcategory, mode, section, order, icon, services,
  config: { ...config, id: pluginId, title: label, description, icon },
});

export const SELF_HOSTED_TOOL_DEFINITIONS: readonly SelfHostedToolDefinition[] = [
  tool(FEEDS_READING_PLUGIN_ID, 'Feeds & Reading Inbox', 'Read RSS and Atom feeds directly or pull the unread queue from Miniflux.', 'knowledge', 'Reading & Capture', 'knowledge', 'Reading & Capture', 70, ['Miniflux', 'RSSHub'], {
    singular: 'feed item', statuses: ['Unread', 'Reading', 'Saved', 'Archived'], categories: ['Article', 'Newsletter', 'Video', 'Podcast', 'Release'], completedStatuses: ['Archived'], calendarSource: 'Evidence', logLabel: 'Reading history',
    fields: [
      { key: 'url', label: 'Article URL', type: 'url' }, { key: 'feedUrl', label: 'Feed URL', type: 'url' },
      { key: 'source', label: 'Source', type: 'text' }, { key: 'author', label: 'Author', type: 'text' },
      { key: 'publishedAt', label: 'Published', type: 'text' }, { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'externalId', label: 'External ID', type: 'text' },
    ],
  }, Newspaper),
  tool(WEB_ARCHIVE_PLUGIN_ID, 'Web Archive & Read Later', 'Capture durable local snapshots and import saved links from Karakeep or ArchiveBox.', 'knowledge', 'Reading & Capture', 'knowledge', 'Reading & Capture', 71, ['Karakeep', 'ArchiveBox'], {
    singular: 'snapshot', statuses: ['Queued', 'Archived', 'Failed', 'Expired'], categories: ['Web page', 'Article', 'PDF', 'Media', 'Snapshot'], completedStatuses: ['Archived'], calendarSource: 'Evidence', logLabel: 'Archive history',
    fields: [
      { key: 'originalUrl', label: 'Original URL', type: 'url' }, { key: 'localPath', label: 'Local snapshot', type: 'text' },
      { key: 'archivedAt', label: 'Archived at', type: 'text' }, { key: 'contentHash', label: 'Content hash', type: 'text' },
      { key: 'mimeType', label: 'MIME type', type: 'text' }, { key: 'sourceProvider', label: 'Source provider', type: 'text' },
    ],
  }, FileSearch),
  tool(WEB_WATCH_PLUGIN_ID, 'Web Watch', 'Watch pages and endpoints locally, compare content hashes, and surface meaningful changes.', 'knowledge', 'Reading & Capture', 'knowledge', 'Reading & Capture', 72, ['changedetection.io'], {
    singular: 'watch', statuses: ['Active', 'Changed', 'Paused', 'Failed'], categories: ['Page', 'API', 'Feed', 'Document', 'Price'], completedStatuses: ['Paused'], calendarSource: 'Follow-up', schedule: true, dateLabel: 'Next check', logLabel: 'Change history',
    fields: [
      { key: 'url', label: 'URL', type: 'url' }, { key: 'selector', label: 'Text filter or selector', type: 'text' },
      { key: 'frequencyMinutes', label: 'Frequency in minutes', type: 'number' }, { key: 'lastHash', label: 'Last content hash', type: 'text' },
      { key: 'previousHash', label: 'Previous content hash', type: 'text' }, { key: 'lastChecked', label: 'Last checked', type: 'text' },
      { key: 'lastChanged', label: 'Last changed', type: 'text' }, { key: 'changeSummary', label: 'Change summary', type: 'text' },
      { key: 'materiality', label: 'Change materiality', type: 'text' }, { key: 'addedLines', label: 'Added evidence lines', type: 'textarea' },
      { key: 'removedLines', label: 'Removed evidence lines', type: 'textarea' }, { key: 'sourceUrl', label: 'Final source URL', type: 'url' },
    ],
  }, Eye),
  tool(DOCUMENT_INBOX_PLUGIN_ID, 'Document Inbox & OCR', 'Bring documents into a managed inbox, extract searchable text, and review the result.', 'knowledge', 'Reading & Capture', 'knowledge', 'Reading & Capture', 73, ['Paperless-ngx'], {
    singular: 'document', statuses: ['Inbox', 'Processing', 'Indexed', 'Needs review', 'Archived'], categories: ['Receipt', 'Invoice', 'Letter', 'Contract', 'Report', 'Other'], completedStatuses: ['Archived'], calendarSource: 'Evidence', logLabel: 'Document history',
    fields: [
      { key: 'location', label: 'Managed file', type: 'text' }, { key: 'mimeType', label: 'MIME type', type: 'text' },
      { key: 'checksum', label: 'Checksum', type: 'text' }, { key: 'ocrText', label: 'OCR text', type: 'textarea' },
      { key: 'correspondent', label: 'Correspondent', type: 'text' }, { key: 'documentDate', label: 'Document date', type: 'date' },
      { key: 'sourceProvider', label: 'Source provider', type: 'text' },
    ],
  }, ScanText),
  tool(PDF_TOOLKIT_PLUGIN_ID, 'PDF Toolkit', 'Merge, split, rotate, and extract text from PDFs with local desktop tools.', 'productivity', 'Files', 'tools', 'Tools', 81, ['Stirling PDF'], {
    singular: 'PDF job', statuses: ['Ready', 'Processing', 'Complete', 'Failed'], categories: ['Merge', 'Split', 'Rotate', 'Extract text'], completedStatuses: ['Complete'], calendarSource: 'Inventory', logLabel: 'Job history',
    fields: [
      { key: 'sourcePaths', label: 'Source files', type: 'textarea' }, { key: 'outputPath', label: 'Output', type: 'text' },
      { key: 'operation', label: 'Operation', type: 'text' }, { key: 'details', label: 'Details', type: 'textarea' },
    ],
  }, Files),
  tool(MANAGED_FILES_PLUGIN_ID, 'Managed Files', 'Index chosen folders, inspect file metadata, and open managed content from Modulo.', 'productivity', 'Files', 'tools', 'Tools', 82, ['File Browser'], {
    singular: 'managed file', statuses: ['Available', 'Missing', 'Watching', 'Archived'], categories: ['File', 'Folder', 'Image', 'Document', 'Media', 'Archive'], completedStatuses: ['Archived'], calendarSource: 'Inventory', logLabel: 'File history',
    fields: [
      { key: 'location', label: 'Location', type: 'text' }, { key: 'root', label: 'Managed root', type: 'text' },
      { key: 'size', label: 'Size in bytes', type: 'number' }, { key: 'modifiedAt', label: 'Modified', type: 'text' },
      { key: 'extension', label: 'Extension', type: 'text' },
    ],
  }, Files),
  tool(CALDAV_SYNC_PLUGIN_ID, 'CalDAV Sync', 'Synchronize calendar events from Radicale or another CalDAV collection.', 'productivity', 'Planning', 'productivity', 'Planning', 85, ['Radicale'], {
    singular: 'calendar item', statuses: ['Synced', 'Local changes', 'Conflict', 'Failed', 'Archived'], categories: ['Event', 'Task', 'Calendar'], completedStatuses: ['Archived'], calendarSource: 'Follow-up', schedule: true, dateLabel: 'Starts', endDateLabel: 'Ends', logLabel: 'Sync history',
    fields: [
      { key: 'remoteId', label: 'Remote UID', type: 'text' }, { key: 'calendarUrl', label: 'Calendar URL', type: 'url' },
      { key: 'etag', label: 'ETag', type: 'text' }, { key: 'location', label: 'Location', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' }, { key: 'lastSynced', label: 'Last synced', type: 'text' },
    ],
  }, CalendarSync),
  tool(NOTIFICATION_GATEWAY_PLUGIN_ID, 'Remote Notification Gateway', 'Publish alerts and reminders to ntfy topics from the desktop app.', 'productivity', 'Planning', 'productivity', 'Planning', 86, ['ntfy'], {
    singular: 'notification', statuses: ['Queued', 'Sent', 'Failed', 'Muted'], categories: ['Reminder', 'Alert', 'Update', 'Test'], completedStatuses: ['Sent', 'Muted'], calendarSource: 'Follow-up', logLabel: 'Delivery history',
    fields: [
      { key: 'topic', label: 'Topic', type: 'text' }, { key: 'message', label: 'Message', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['min', 'low', 'default', 'high', 'max'] },
      { key: 'tags', label: 'Tags', type: 'text' }, { key: 'clickUrl', label: 'Click URL', type: 'url' },
      { key: 'sentAt', label: 'Sent at', type: 'text' },
    ],
  }, BellRing),
] as const;

export const SELF_HOSTED_PLUGIN_IDS = SELF_HOSTED_TOOL_DEFINITIONS.map((definition) => definition.pluginId);

export function selfHostedToolDefinition(id: string): SelfHostedToolDefinition | undefined {
  return SELF_HOSTED_TOOL_DEFINITIONS.find((definition) => definition.pluginId === id);
}
