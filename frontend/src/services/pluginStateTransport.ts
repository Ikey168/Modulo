import {
  StateRequestError, type StatePersistence, type StateRecord, type StateScope,
  type StateSnapshot, type StateTransport,
} from './pluginStateClient';

/** Durable per-partition offline queue. The server remains authoritative for acknowledged state. */
export class IndexedDbStatePersistence implements StatePersistence {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open('modulo-plugin-state', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open plugin state cache.'));
      request.onblocked = () => reject(new Error('Plugin state cache upgrade is blocked by another tab.'));
    });
  }

  async load(partition: string): Promise<StateSnapshot | null> {
    const db = await this.open();
    try {
      return await new Promise<StateSnapshot | null>((resolve, reject) => {
        const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(partition);
        request.onsuccess = () => resolve(request.result === undefined ? null : request.result as StateSnapshot);
        request.onerror = () => reject(request.error ?? new Error('Could not read plugin state cache.'));
      });
    } finally { db.close(); }
  }

  async save(partition: string, snapshot: StateSnapshot): Promise<void> {
    if (snapshot.partition !== partition) throw new Error('Plugin state cache partition mismatch.');
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put(snapshot, partition);
        // Request success alone does not make the outbox durable; wait for commit.
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not save plugin state cache.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Plugin state cache write was aborted.'));
      });
    } finally { db.close(); }
  }
}

export interface StateSession { issuer: string; subject: string; accessToken: string }

export function createStateTransport(scope: StateScope,
  session: () => Promise<StateSession | null>, fetcher: typeof fetch = fetch): StateTransport {
  let generation: string | undefined;
  const base = `${scope.origin.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(scope.workspace)}`
    + `/plugin-state/${encodeURIComponent(scope.namespace)}`;
  const request = async (key: string | undefined, method: string, signal: AbortSignal, body?: unknown,
    expectedVersion?: number, cursor?: string, generationOnly = false): Promise<unknown> => {
    const current = await session();
    if (signal.aborted) throw new DOMException('State request aborted', 'AbortError');
    if (!current || current.issuer !== scope.issuer || current.subject !== scope.subject || !current.accessToken) {
      throw new StateRequestError(401, 'STATE_SESSION_CHANGED');
    }
    const url = generationOnly ? `${base}?generation`
      : key === undefined ? `${base}?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      : `${base}/${encodeURIComponent(key)}` + (expectedVersion === undefined ? '' : `?expectedVersion=${expectedVersion}`);
    const response = await fetcher(url, { method, signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${current.accessToken}`,
        ...(generation ? { 'X-Modulo-State-Generation': generation } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status === 404 && method === 'GET') return undefined;
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as {
        code?: string; current?: StateRecord | null;
      };
      throw new StateRequestError(response.status, error.code ?? `STATE_HTTP_${response.status}`, error.current ?? undefined);
    }
    return response.json();
  };
  return {
    generation: async signal => (await request(undefined, 'GET', signal, undefined, undefined, undefined, true) as
      { generation: string }).generation,
    useGeneration: value => { generation = value; },
    list: async (cursor, signal) => (await request(undefined, 'GET', signal, undefined, undefined, cursor)) as
      { records: StateRecord[]; nextCursor?: string },
    get: async (key, signal) => await request(key, 'GET', signal) as StateRecord | undefined,
    put: async (key, body, signal) => await request(key, 'PUT', signal, body) as StateRecord,
    delete: async (key, version, signal) => await request(key, 'DELETE', signal, undefined, version) as StateRecord,
  };
}
