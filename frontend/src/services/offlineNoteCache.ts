import { Capacitor } from '@capacitor/core';
import type { NoteCachePersistence, OfflineNoteSnapshot } from './offlineNotes';
import { nativeStateCache, type NativeStateCacheBridge } from './nativeStateCacheBridge';

/** Separate local cache for the Notes HTTP workflow; transactions resolve only after commit. */
export class IndexedDbNoteCache implements NoteCachePersistence {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open('modulo-offline-notes', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open the offline note cache.'));
      request.onblocked = () => reject(new Error('Offline note cache upgrade is blocked by another tab.'));
    });
  }

  async load(key: string): Promise<OfflineNoteSnapshot | null> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(key);
        request.onsuccess = () => resolve(request.result === undefined ? null : request.result as OfflineNoteSnapshot);
        request.onerror = () => reject(request.error ?? new Error('Could not read offline notes.'));
      });
    } finally { db.close(); }
  }

  async save(key: string, snapshot: OfflineNoteSnapshot): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put(snapshot, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not save offline notes.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Offline note write was aborted.'));
      });
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('modulo-offline-notes');
        channel.postMessage(key); channel.close();
      }
    } finally { db.close(); }
  }
}

/** The same Android SQLite transaction also stores note snapshots under distinct keys. */
export class AndroidNoteCache implements NoteCachePersistence {
  constructor(private readonly cache: Pick<NativeStateCacheBridge, 'load' | 'save'> = nativeStateCache) {}

  async load(key: string): Promise<OfflineNoteSnapshot | null> {
    const { snapshot } = await this.cache.load({ partition: key });
    if (snapshot === null) return null;
    const envelope = JSON.parse(snapshot) as { format: number; partition: string; document: OfflineNoteSnapshot };
    if (envelope.format !== 1 || envelope.partition !== key) throw new Error('Offline note cache partition mismatch.');
    return envelope.document;
  }

  save(key: string, snapshot: OfflineNoteSnapshot): Promise<void> {
    return this.cache.save({ partition: key, snapshot: JSON.stringify({ format: 1, partition: key, document: snapshot }) });
  }
}

export function createNoteCachePersistence(): NoteCachePersistence {
  return Capacitor.getPlatform() === 'android' ? new AndroidNoteCache() : new IndexedDbNoteCache();
}
