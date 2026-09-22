import { Client, type StompConfig } from '@stomp/stompjs';
import { authService } from '../features/auth/authService';

/** Every reconnect authenticates afresh; account changes permanently close the old client's callbacks. */
export function authenticatedStomp(config: StompConfig): Client {
  let closed = false;
  let identity = '';
  const client = new Client(config);
  const deactivate = client.deactivate.bind(client);
  const key = () => {
    const session = authService.stateSession();
    return session ? JSON.stringify([session.issuer, session.subject]) : '';
  };
  client.beforeConnect = async () => {
    if (closed) throw new Error('WebSocket account session is closed');
    const session = authService.stateSession();
    if (!session) throw new Error('Sign in to connect');
    const current = key();
    if (identity && identity !== current) throw new Error('WebSocket account changed');
    identity = current;
    client.connectHeaders = { ...client.connectHeaders, Authorization: `Bearer ${session.accessToken}` };
  };
  const stop = authService.subscribeSession(() => {
    if (!identity || closed) return;
    const next = key();
    if (next !== identity) { void client.deactivate(); return; }
    // Renew the authenticated socket before the old server-side token expires.
    void deactivate().then(() => { if (!closed && key() === identity) client.activate(); });
  });
  client.deactivate = options => { closed = true; stop(); return deactivate(options); };
  return client;
}
