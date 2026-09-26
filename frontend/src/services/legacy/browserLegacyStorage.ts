import { Capacitor } from '@capacitor/core';

/**
 * The only runtime accessor for the pre-sync browser profile.
 *
 * Before durable plugin state existed, workspace plugins persisted to the
 * browser origin's localStorage. Migration code in this directory reads that
 * profile once, imports it into the signed-in account and retires each key
 * after the server acknowledged and verified the copy. Nothing else may read
 * or write browser Storage for plugin data; the CI storage gate enforces it.
 *
 * Android never had a browser profile, so it has no legacy source.
 */
export function legacyBrowserStorage(): Storage | null {
  if (Capacitor.getPlatform() === 'android') return null;
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // Storage access can throw when site data is blocked.
  }
}

export function readLegacyValue(key: string, storage: Storage | null = legacyBrowserStorage()): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

/** Keys the browser profile currently holds, in stable order. */
export function legacyKeys(storage: Storage | null = legacyBrowserStorage()): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key !== null) keys.push(key);
    }
  } catch { return []; }
  return keys.sort();
}

/**
 * A Storage over plain values. Replays a recovery export through the same
 * importers after the original browser keys are gone, and backs tests.
 */
export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  constructor(initial: Record<string, string | null> = {}) {
    for (const [key, value] of Object.entries(initial)) if (value !== null) this.values.set(key, value);
  }
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}
