import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ session: null as null | { issuer: string; subject: string; accessToken: string }, listeners: new Set<() => void>() }));
vi.mock('../../features/auth/authService', () => ({ authService: {
  stateSession: () => auth.session,
  subscribeSession: (listener: () => void) => { auth.listeners.add(listener); return () => auth.listeners.delete(listener); },
} }));
vi.mock('@stomp/stompjs', () => ({ Client: class {
  connectHeaders = {};
  beforeConnect = async () => {};
  activate = vi.fn();
  deactivate = vi.fn(async () => {});
  constructor(config: object) { Object.assign(this, config); }
} }));
import { authenticatedStomp } from '../authenticatedStomp';
const change = (subject: string, token: string) => {
  auth.session = { issuer: 'https://identity.test', subject, accessToken: token };
  for (const listener of auth.listeners) listener();
};
beforeEach(() => { auth.listeners.clear(); change('alice', 'first'); });
describe('authenticated collaboration sockets', () => {
  it('authenticates each reconnect and renews the socket with the new token', async () => {
    const client = authenticatedStomp({});
    await client.beforeConnect(client);
    expect(client.connectHeaders.Authorization).toBe('Bearer first');
    change('alice', 'renewed');
    await Promise.resolve();
    expect(client.activate).toHaveBeenCalledOnce();
    await client.beforeConnect(client);
    expect(client.connectHeaders.Authorization).toBe('Bearer renewed');
    await client.deactivate();
  });
  it('permanently stops old callbacks on account changes and removes its listener', async () => {
    const client = authenticatedStomp({});
    await client.beforeConnect(client);
    change('bob', 'other');
    expect(auth.listeners.size).toBe(0);
    await expect(client.beforeConnect(client)).rejects.toThrow('closed');
    expect(client.activate).not.toHaveBeenCalled();
  });
  it('does not reactivate after teardown races token renewal', async () => {
    const client = authenticatedStomp({});
    await client.beforeConnect(client);
    change('alice', 'renewed');
    await client.deactivate();
    expect(client.activate).not.toHaveBeenCalled();
  });
});
