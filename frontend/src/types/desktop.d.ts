/**
 * Surface exposed by the Electron desktop shell's preload script
 * (desktop/preload.cjs) via contextBridge. Absent in the browser build.
 */
export {};

interface DesktopAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  checksum?: string;
}

interface DesktopReminder {
  id: string;
  title: string;
  body: string;
  dueAt: string;
  recurrence: 'Once' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
}

declare global {
  interface Window {
    moduloDesktop?: {
      readonly isDesktop: true;
      readonly platform: string;
      readonly versions: {
        readonly electron: string;
        readonly chrome: string;
        readonly node: string;
      };
      readonly credentials: {
        status: () => Promise<{ available: boolean; configured: string[] }>;
        set: (key: string, value: string) => Promise<{ configured: string[] }>;
      };
      readonly providers: { search: (provider: string, query: string) => Promise<unknown[]> };
      readonly feeds: { sync: (options: { kind: 'Miniflux' | 'RSS'; url: string }) => Promise<Array<{ externalId: string; title: string; url: string; source: string; author: string; publishedAt: string; summary: string; feedUrl: string }>> };
      readonly archive: {
        capture: (url: string) => Promise<{ id: string; title: string; originalUrl: string; localPath: string; archivedAt: string; contentHash: string; mimeType: string; sourceProvider: string }>;
        import: (options: { provider: 'Karakeep' | 'ArchiveBox'; url: string }) => Promise<Array<{ externalId: string; title: string; url: string; summary: string; createdAt: string }>>;
        open: (path: string) => Promise<string>;
      };
      readonly webWatch: {
        sync: (items: Array<{ id: string; title: string; url: string; selector?: string; frequencyMinutes: number; lastHash?: string; previousHash?: string; lastChecked?: string; lastChanged?: string; changeSummary?: string; materiality?: 'Unknown' | 'Minor' | 'Material'; addedLines?: string[]; removedLines?: string[]; sourceUrl?: string; status: string }>) => Promise<number>;
        check: (ids?: string[]) => Promise<Array<{ id: string; title: string; url: string; status: string; lastHash?: string; previousHash?: string; lastChecked?: string; lastChanged?: string; changeSummary?: string; materiality?: 'Unknown' | 'Minor' | 'Material'; addedLines?: string[]; removedLines?: string[]; sourceUrl?: string; error?: string }>>;
        onChanged: (listener: (value: { id: string; lastHash: string; previousHash?: string; lastChecked: string; lastChanged: string; changeSummary?: string; materiality?: 'Unknown' | 'Minor' | 'Material'; addedLines?: string[]; removedLines?: string[]; sourceUrl?: string }) => void) => () => void;
      };
      readonly documents: {
        import: () => Promise<Array<{ id: string; title: string; location: string; mimeType: string; size: number; checksum: string; ocrText: string; ocrAvailable: boolean }>>;
        open: (path: string) => Promise<string>;
      };
      readonly pdf: {
        choose: () => Promise<string[]>;
        run: (operation: 'Merge' | 'Split' | 'Rotate' | 'Extract text', files: string[]) => Promise<{ outputPath: string; details: string } | null>;
      };
      readonly managedFiles: {
        chooseRoot: () => Promise<string | null>;
        index: (root: string) => Promise<{ root: string; truncated: boolean; files: Array<{ name: string; path: string; root: string; size: number; modifiedAt: string; extension: string; category: string }> }>;
        open: (path: string) => Promise<string>;
      };
      readonly caldav: { sync: (url: string) => Promise<Array<{ remoteId: string; title: string; startsAt: string; endsAt: string; location: string; description: string; calendarUrl: string }>> };
      readonly ntfy: { publish: (options: { endpoint: string; topic: string; title: string; message: string; priority: string; tags?: string; clickUrl?: string }) => Promise<{ id?: string; time?: number }> };
      readonly attachments: {
        choose: () => Promise<DesktopAttachment[]>;
        list: () => Promise<DesktopAttachment[]>;
        open: (path: string) => Promise<string>;
        remove: (path: string) => Promise<boolean>;
        onChanged: (listener: (value: unknown) => void) => () => void;
      };
      readonly reminders: {
        sync: (items: DesktopReminder[]) => Promise<number>;
        action: (id: string, action: 'done' | 'snooze' | 'open') => Promise<boolean>;
        onAction: (listener: (value: { id: string; action: 'done' | 'snooze' | 'open'; dueAt?: string }) => void) => () => void;
      };
      readonly backup: {
        exportZip: (payload: string) => Promise<string | null>;
        importZip: () => Promise<{ payload: string; attachments: number } | null>;
      };
      readonly sync: {
        chooseDirectory: () => Promise<string | null>;
        status: () => Promise<{ directory?: string }>;
        write: (payload: string, passphrase: string) => Promise<string>;
        read: (passphrase: string) => Promise<string>;
      };
    };
  }
}
