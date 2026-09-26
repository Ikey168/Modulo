import { Capacitor } from '@capacitor/core';

export type PlatformKind = 'web' | 'electron' | 'android';

/**
 * Device and service capabilities a plugin may need (#489). A plugin declares
 * the ones its workflows use; the platform says whether each is available here
 * and, if not, which route replaces it and which issue delivers it.
 */
export type Capability =
  | 'files.pick' | 'files.save' | 'files.share' | 'camera.capture'
  | 'notifications.local' | 'reminders.scheduled'
  | 'links.external' | 'credentials.secure' | 'sync.background'
  | 'remote.fetch' | 'remote.metadata'
  | 'device.folders' | 'documents.ocr' | 'pdf.tools' | 'backup.archive';

export interface CapabilityStatus {
  available: boolean;
  /** What the user can do instead, or how the capability is provided here. */
  message: string;
  /** Tracking issue that delivers this capability on this platform. */
  issue?: string;
}

const issue = (number: number) => `https://github.com/Ikey168/Modulo/issues/${number}`;
type Row = Record<PlatformKind, true | { message: string; issue?: string }>;

const TABLE: Record<Capability, Row> = {
  'files.pick': { web: true, electron: true, android: true },
  'files.save': { web: true, electron: true, android: true },
  'files.share': { web: true, electron: true, android: true },
  'camera.capture': { web: true, electron: true, android: true },
  'notifications.local': { web: true, electron: true, android: true },
  'reminders.scheduled': {
    web: { message: 'Scheduled reminders fire while Modulo is open in this browser; install the desktop or Android app for reminders when it is closed.' },
    electron: true, android: true,
  },
  'links.external': { web: true, electron: true, android: true },
  'credentials.secure': {
    web: { message: 'This browser does not keep service credentials; enter them for this session only.' },
    electron: true, android: true,
  },
  'sync.background': {
    web: { message: 'Changes synchronize while this tab is open.' },
    electron: true, android: true,
  },
  // Served by the Modulo server's /api/remote adapters off the desktop (#495).
  'remote.fetch': { web: true, electron: true, android: true },
  // Served by the Modulo server's /api/remote adapters off the desktop (#495).
  'remote.metadata': { web: true, electron: true, android: true },
  'device.folders': {
    web: { message: 'Local folder indexing needs the desktop app. Upload files as attachments instead.', issue: issue(495) },
    electron: true,
    android: { message: 'Pick files with the system file picker; they are stored as attachments on your server.', issue: issue(495) },
  },
  'documents.ocr': {
    web: { message: 'Documents are stored as attachments; text recognition runs in the desktop app.', issue: issue(495) },
    electron: true,
    android: { message: 'Documents are stored as attachments; text recognition runs in the desktop app.', issue: issue(495) },
  },
  // Served by the Modulo server's /api/remote adapters off the desktop (#495).
  'pdf.tools': { web: true, electron: true, android: true },
  'backup.archive': {
    web: { message: 'Use the JSON backup; ZIP archives with attachments and folder sync need the desktop app.' },
    electron: true,
    android: { message: 'Use the JSON backup and share it; ZIP archives with attachments need the desktop app.', issue: issue(493) },
  },
};

export const CAPABILITIES = Object.keys(TABLE) as Capability[];

export function platformKind(): PlatformKind {
  if (Capacitor.getPlatform() === 'android') return 'android';
  if (typeof window !== 'undefined' && window.moduloDesktop?.isDesktop === true) return 'electron';
  return 'web';
}

export function capabilityStatus(capability: Capability, kind: PlatformKind = platformKind()): CapabilityStatus {
  const row = TABLE[capability][kind];
  return row === true ? { available: true, message: 'Available.' } : { available: false, ...row };
}

/** Capabilities a plugin needs that this platform provides only through another route. */
export function capabilityGaps(capabilities: readonly Capability[] = [], kind: PlatformKind = platformKind()):
  Array<CapabilityStatus & { capability: Capability }> {
  return capabilities.map(capability => ({ capability, ...capabilityStatus(capability, kind) })).filter(item => !item.available);
}

/** Message for an action that cannot run here. */
export function capabilityMessage(capability: Capability): string {
  return capabilityStatus(capability).message;
}
