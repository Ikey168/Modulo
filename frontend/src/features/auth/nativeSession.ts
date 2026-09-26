import type { SecureStore } from '../../services/secureStore';

/** What survives a relaunch on Android: the refresh token and the identity it belongs to. */
export interface NativeSessionRecord {
  server: string;
  issuer: string;
  subject: string;
  refreshToken: string;
  /** Last ID token; refreshes are validated against its subject, azp and auth_time. */
  idToken?: string;
  name?: string;
  email?: string;
}

/** One record per server; switching servers never reads another server's credential. */
export const nativeSessionKey = (server: string) => `oidc.session:${server}`;

export async function saveNativeSession(store: SecureStore, record: NativeSessionRecord): Promise<void> {
  await store.set(nativeSessionKey(record.server), JSON.stringify(record));
}

export async function loadNativeSession(store: SecureStore, server: string, issuer: string): Promise<NativeSessionRecord | null> {
  const raw = await store.get(nativeSessionKey(server));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as Partial<NativeSessionRecord>;
    // A record for another server or identity provider is never used.
    if (record.server !== server || record.issuer !== issuer || typeof record.subject !== 'string' || !record.subject
      || typeof record.refreshToken !== 'string' || !record.refreshToken) {
      await store.remove(nativeSessionKey(server));
      return null;
    }
    return record as NativeSessionRecord;
  } catch {
    await store.remove(nativeSessionKey(server));
    return null;
  }
}

/**
 * A refresh that failed for lack of connectivity keeps the session for offline
 * use; a refresh the identity provider rejected ends it.
 */
export function isNetworkFailure(error: unknown, online = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  if (!online) return true;
  if (error instanceof TypeError) return true; // fetch() network failure
  const message = error instanceof Error ? error.message : String(error);
  return /network|failed to fetch|timeout|timed out|load failed/i.test(message)
    && !/invalid_grant|unauthorized|expired|revoked/i.test(message);
}
