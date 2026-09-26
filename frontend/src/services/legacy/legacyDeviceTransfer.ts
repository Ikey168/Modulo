import type { DeviceDocuments } from '../deviceDocuments';
import { legacyBrowserStorage } from './browserLegacyStorage';
import { retireLegacySource } from './legacyStateImport';

/**
 * Move a device-only value (an unsaved editor draft, a display preference)
 * from the older browser profile into device storage once. The browser copy
 * is retired only after the device write committed; an unreadable value is
 * left in place for the recovery export.
 */
export async function claimLegacyDeviceValue<T>(legacyKey: string, deviceKey: string, documents: DeviceDocuments,
  parse: (raw: string) => T | undefined): Promise<T | undefined> {
  const storage = legacyBrowserStorage();
  const raw = storage?.getItem(legacyKey) ?? null;
  if (!storage || raw === null) return undefined;
  let value: T | undefined;
  try { value = parse(raw); } catch { return undefined; }
  if (value === undefined) return undefined;
  await documents.set(deviceKey, value);
  retireLegacySource(storage, { [legacyKey]: raw });
  return value;
}

export function claimLegacyDraft(key: string, documents: DeviceDocuments): Promise<{ title: string; content: string } | undefined> {
  return claimLegacyDeviceValue(key, key, documents, raw => {
    const draft = JSON.parse(raw) as { title?: unknown; content?: unknown } | null;
    return draft && typeof draft.title === 'string' && typeof draft.content === 'string'
      ? { title: draft.title, content: draft.content } : undefined;
  });
}
