import {
  StateRequestError, type StatePersistence, type StateRecord, type StateScope,
  type StateSnapshot, type StateTransport,
} from './pluginStateClient';

/** Local recovery cache only; acknowledged server state remains the durable system of record. */
export class BrowserStatePersistence implements StatePersistence {
  constructor(private readonly storage: Storage) {}
  async load(partition: string): Promise<StateSnapshot | null> {
    const raw = this.storage.getItem(`modulo.plugin-state.v1:${partition}`);
    return raw === null ? null : JSON.parse(raw) as StateSnapshot;
  }
  async save(partition: string, snapshot: StateSnapshot): Promise<void> {
    // Storage failure must reject the edit, never masquerade as a successful local save.
    this.storage.setItem(`modulo.plugin-state.v1:${partition}`, JSON.stringify(snapshot));
  }
}

export interface StateSession { issuer: string; subject: string; accessToken: string }

export function createStateTransport(scope: StateScope,
  session: () => Promise<StateSession | null>, fetcher: typeof fetch = fetch): StateTransport {
  const base = `${scope.origin.replace(/\/$/, '')}/api/workspaces/${encodeURIComponent(scope.workspace)}`
    + `/plugin-state/${encodeURIComponent(scope.namespace)}`;
  const request = async (key: string, method: string, signal: AbortSignal, body?: unknown,
    expectedVersion?: number): Promise<StateRecord | undefined> => {
    const current = await session();
    if (signal.aborted) throw new DOMException('State request aborted', 'AbortError');
    if (!current || current.issuer !== scope.issuer || current.subject !== scope.subject || !current.accessToken) {
      throw new StateRequestError(401, 'STATE_SESSION_CHANGED');
    }
    const url = `${base}/${encodeURIComponent(key)}`
      + (expectedVersion === undefined ? '' : `?expectedVersion=${expectedVersion}`);
    const response = await fetcher(url, { method, signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json',
        Authorization: `Bearer ${current.accessToken}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status === 404 && method === 'GET') return undefined;
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as {
        code?: string; current?: StateRecord | null;
      };
      throw new StateRequestError(response.status, error.code ?? `STATE_HTTP_${response.status}`, error.current ?? undefined);
    }
    return response.json() as Promise<StateRecord>;
  };
  return {
    get: (key, signal) => request(key, 'GET', signal),
    put: async (key, body, signal) => (await request(key, 'PUT', signal, body))!,
    delete: async (key, version, signal) => (await request(key, 'DELETE', signal, undefined, version))!,
  };
}
