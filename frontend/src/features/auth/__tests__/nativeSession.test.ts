import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { SecureStore } from '../../../services/secureStore';
import { IndexedDbDeviceDocuments } from '../../../services/deviceDocuments';
import { DeviceOidcStateStore } from '../deviceOidcStateStore';
import { isNetworkFailure, loadNativeSession, nativeSessionKey, saveNativeSession } from '../nativeSession';
import { createStateTransport } from '../../../services/pluginStateTransport';
import { StateRequestError } from '../../../services/pluginStateClient';

const memorySecure = (): SecureStore & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return { values, get: async key => values.get(key) ?? null, set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); }, clear: async () => { values.clear(); } };
};
const record = { server: 'https://a.example', issuer: 'https://a.example/auth/realms/modulo', subject: 'alice', refreshToken: 'r1' };

describe('native session records', () => {
  it('round-trips one record per server', async () => {
    const store = memorySecure();
    await saveNativeSession(store, record);
    expect(await loadNativeSession(store, record.server, record.issuer)).toEqual(record);
    expect(await loadNativeSession(store, 'https://b.example', record.issuer)).toBeNull();
  });
  it('discards a record whose identity provider no longer matches the server', async () => {
    const store = memorySecure();
    await saveNativeSession(store, record);
    expect(await loadNativeSession(store, record.server, 'https://evil.example/realm')).toBeNull();
    expect(store.values.has(nativeSessionKey(record.server))).toBe(false);
  });
  it('discards corrupt records', async () => {
    const store = memorySecure();
    store.values.set(nativeSessionKey(record.server), '{not json');
    expect(await loadNativeSession(store, record.server, record.issuer)).toBeNull();
    expect(store.values.size).toBe(0);
  });
  it('keeps the session only for connectivity failures', () => {
    expect(isNetworkFailure(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(isNetworkFailure(new Error('anything'), false)).toBe(true);
    expect(isNetworkFailure(new Error('invalid_grant: Token is not active'), true)).toBe(false);
    expect(isNetworkFailure(new Error('network timeout'), true)).toBe(true);
  });
});

describe('native PKCE transaction store', () => {
  it('survives app recreation and is consumed on use', async () => {
    const factory = new IDBFactory();
    const first = new DeviceOidcStateStore(new IndexedDbDeviceDocuments(factory));
    await first.set('oidc.state-1', '{"code_verifier":"v"}');
    const afterRestart = new DeviceOidcStateStore(new IndexedDbDeviceDocuments(factory));
    expect(await afterRestart.getAllKeys()).toEqual(['oidc.state-1']);
    expect(await afterRestart.remove('oidc.state-1')).toBe('{"code_verifier":"v"}');
    expect(await afterRestart.get('oidc.state-1')).toBeNull();
    expect(await afterRestart.getAllKeys()).toEqual([]);
  });
});

describe('state transport without a renewed session', () => {
  const scope = { origin: 'https://a.example', issuer: record.issuer, subject: 'alice', workspace: 'personal', namespace: 'para', replica: 'r' };
  it('queues instead of failing when the same account has no token yet', async () => {
    const transport = createStateTransport(scope, async () => ({ issuer: record.issuer, subject: 'alice', accessToken: '' }),
      async () => { throw new Error('must not send without a token'); });
    const failure = await transport.get('data', new AbortController().signal).catch(error => error);
    expect(failure).toBeInstanceOf(TypeError);
  });
  it('still rejects another account', async () => {
    const transport = createStateTransport(scope, async () => ({ issuer: record.issuer, subject: 'bob', accessToken: 't' }));
    const failure = await transport.get('data', new AbortController().signal).catch(error => error);
    expect(failure).toBeInstanceOf(StateRequestError);
    expect(failure.code).toBe('STATE_SESSION_CHANGED');
  });
});
