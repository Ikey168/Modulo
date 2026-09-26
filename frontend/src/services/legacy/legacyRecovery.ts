import { MemoryStorage } from './browserLegacyStorage';

/**
 * Durable, account-scoped copies of legacy browser values, written before a
 * migration changes anything. A copy outlives the retired browser key, so an
 * interrupted or regretted migration can be exported and replayed without the
 * original localStorage entries.
 */
export interface LegacyRecoveryCopy {
  /** JSON [origin, issuer, subject] of the account the copy was claimed for. */
  account: string;
  key: string;
  value: string;
  sha256: string;
  preservedAt: string;
}

export interface LegacyRecoveryFile {
  format: 'modulo-legacy-recovery';
  version: 1;
  account: string;
  exportedAt: string;
  values: Record<string, string>;
  copies: LegacyRecoveryCopy[];
}

export interface LegacyRecoveryStore {
  preserve(account: string, values: Record<string, string | null>): Promise<void>;
  list(account: string): Promise<LegacyRecoveryCopy[]>;
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

const DATABASE = 'modulo-legacy-recovery';

export class IndexedDbLegacyRecovery implements LegacyRecoveryStore {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('copies', { keyPath: ['account', 'key', 'sha256'] });
        store.createIndex('account', 'account');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open the legacy recovery store.'));
      request.onblocked = () => reject(new Error('The legacy recovery store upgrade is blocked by another tab.'));
    });
  }

  async preserve(account: string, values: Record<string, string | null>): Promise<void> {
    const copies: LegacyRecoveryCopy[] = [];
    const preservedAt = new Date().toISOString();
    for (const [key, value] of Object.entries(values)) {
      if (value !== null) copies.push({ account, key, value, sha256: await digest(value), preservedAt });
    }
    if (copies.length === 0) return;
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('copies', 'readwrite');
        const store = transaction.objectStore('copies');
        // Identical bytes are kept once; the first preservation time wins.
        for (const copy of copies) {
          const existing = store.get([copy.account, copy.key, copy.sha256]);
          existing.onsuccess = () => { if (existing.result === undefined) store.put(copy); };
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not preserve legacy data before migration.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Legacy data preservation was aborted.'));
      });
    } finally { db.close(); }
  }

  async list(account: string): Promise<LegacyRecoveryCopy[]> {
    const db = await this.open();
    try {
      return await new Promise<LegacyRecoveryCopy[]>((resolve, reject) => {
        const request = db.transaction('copies', 'readonly').objectStore('copies').index('account').getAll(account);
        request.onsuccess = () => resolve((request.result as LegacyRecoveryCopy[])
          .sort((a, b) => a.key.localeCompare(b.key) || a.preservedAt.localeCompare(b.preservedAt)));
        request.onerror = () => reject(request.error ?? new Error('Could not read legacy recovery copies.'));
      });
    } finally { db.close(); }
  }
}

let defaultStore: LegacyRecoveryStore | undefined;
/** Process-wide store; tests replace it with their own IDBFactory. */
export function legacyRecoveryStore(): LegacyRecoveryStore {
  defaultStore ??= new IndexedDbLegacyRecovery();
  return defaultStore;
}
export function setLegacyRecoveryStore(store: LegacyRecoveryStore | undefined): void { defaultStore = store; }

/** Account identity of a state client partition: [origin, issuer, subject]. */
export function accountOfPartition(partition: string): string {
  const parts = JSON.parse(partition) as unknown[];
  if (!Array.isArray(parts) || parts.length < 3) throw new Error('Invalid state partition');
  return JSON.stringify(parts.slice(0, 3));
}

export async function legacyRecoveryFile(account: string, store = legacyRecoveryStore()): Promise<LegacyRecoveryFile> {
  const copies = await store.list(account);
  // The newest preserved copy of each key is what a replay restores.
  const values: Record<string, string> = {};
  for (const copy of [...copies].sort((a, b) => a.preservedAt.localeCompare(b.preservedAt))) values[copy.key] = copy.value;
  return { format: 'modulo-legacy-recovery', version: 1, account, exportedAt: new Date().toISOString(), values, copies };
}

/** A Storage over a recovery export, for replaying importers after local keys were retired. */
export function storageFromRecoveryFile(file: unknown, account: string): MemoryStorage {
  const parsed = file as Partial<LegacyRecoveryFile> | null;
  if (!parsed || parsed.format !== 'modulo-legacy-recovery' || parsed.version !== 1
    || !parsed.values || typeof parsed.values !== 'object') throw new Error('This is not a Modulo legacy recovery export.');
  if (parsed.account !== account) {
    throw new Error('This recovery export belongs to another account or server. Sign in to that account to replay it.');
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.values)) {
    if (typeof value !== 'string') throw new Error(`Recovery value for ${key} is not text.`);
    values[key] = value;
  }
  return new MemoryStorage(values);
}
