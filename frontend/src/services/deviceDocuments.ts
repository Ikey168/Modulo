import { Capacitor } from '@capacitor/core';
import { nativeStateCache, type NativeStateCacheBridge } from './nativeStateCacheBridge';

/**
 * Small device-local documents that are not server records: unsaved editor
 * drafts (until the server accepts the save) and device preferences such as
 * the theme. IndexedDB on web/Electron, the native SQLite cache on Android.
 * Writes resolve only after the transaction committed, so a caller can tell
 * the user truthfully whether a draft is safe on this device.
 */
export interface DeviceDocuments {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Remove only when the stored document still equals `expected` (compared as JSON). */
  removeIfEqual(key: string, expected: unknown): Promise<boolean>;
}

const DATABASE = 'modulo-device-documents';

export class IndexedDbDeviceDocuments implements DeviceDocuments {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('documents'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open device storage.'));
      request.onblocked = () => reject(new Error('Device storage upgrade is blocked by another tab.'));
    });
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
    const db = await this.open();
    try {
      return await new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction('documents', mode);
        const request = work(transaction.objectStore('documents'));
        transaction.oncomplete = () => resolve(request ? request.result as T | undefined : undefined);
        transaction.onerror = () => reject(transaction.error ?? new Error('Device storage request failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Device storage write was aborted.'));
      });
    } finally { db.close(); }
  }

  get<T>(key: string): Promise<T | undefined> { return this.run<T>('readonly', store => store.get(key)); }
  async set(key: string, value: unknown): Promise<void> { await this.run('readwrite', store => { store.put(value, key); }); }
  async remove(key: string): Promise<void> { await this.run('readwrite', store => { store.delete(key); }); }
  async removeIfEqual(key: string, expected: unknown): Promise<boolean> {
    let removed = false;
    await this.run('readwrite', store => {
      const current = store.get(key);
      current.onsuccess = () => {
        if (JSON.stringify(current.result) === JSON.stringify(expected)) { store.delete(key); removed = true; }
      };
    });
    return removed;
  }
}

/** Android stores each document as its own partition in the native SQLite cache. */
export class AndroidDeviceDocuments implements DeviceDocuments {
  constructor(private readonly cache: Pick<NativeStateCacheBridge, 'load' | 'save'> = nativeStateCache) {}
  private partition(key: string) { return JSON.stringify(['device-document', key]); }

  async get<T>(key: string): Promise<T | undefined> {
    const { snapshot } = await this.cache.load({ partition: this.partition(key) });
    if (snapshot === null) return undefined;
    const envelope = JSON.parse(snapshot) as { format: 1; deleted?: boolean; value?: T };
    return envelope.deleted ? undefined : envelope.value;
  }
  set(key: string, value: unknown): Promise<void> {
    return this.cache.save({ partition: this.partition(key), snapshot: JSON.stringify({ format: 1, value }) });
  }
  remove(key: string): Promise<void> {
    return this.cache.save({ partition: this.partition(key), snapshot: JSON.stringify({ format: 1, deleted: true }) });
  }
  async removeIfEqual(key: string, expected: unknown): Promise<boolean> {
    // One WebView owns this store, so a read followed by a write cannot interleave with another writer.
    if (JSON.stringify(await this.get(key)) !== JSON.stringify(expected)) return false;
    await this.remove(key);
    return true;
  }
}

let shared: DeviceDocuments | undefined;
export function deviceDocuments(): DeviceDocuments {
  shared ??= Capacitor.getPlatform() === 'android' ? new AndroidDeviceDocuments() : new IndexedDbDeviceDocuments();
  return shared;
}
/** Tests substitute an isolated store. */
export function setDeviceDocuments(store: DeviceDocuments | undefined): void { shared = store; }
