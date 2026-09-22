import { Capacitor, CapacitorHttp } from '@capacitor/core';

/** A server is a single HTTPS origin. Paths and user info are never accepted. */
export function normalizeAndroidServer(value: string): string {
  const candidate = value.trim();
  let url: URL;
  try { url = new URL(candidate); }
  catch { throw new Error('Enter the full HTTPS address of your Modulo server.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/'
      || url.search || url.hash || candidate !== url.origin && candidate !== `${url.origin}/`) {
    throw new Error('Use only a secure server address, such as https://modulo.example.com.');
  }
  return url.origin;
}

/** Reject generic HTTPS sites and unexpected identity providers before saving a server. */
export async function probeAndroidServer(origin: string): Promise<void> {
  const server = normalizeAndroidServer(origin);
  const health = await CapacitorHttp.get({ url: `${server}/api/simple-health`, disableRedirects: true,
    connectTimeout: 10_000, readTimeout: 10_000 });
  if (health.status !== 200 || health.data?.application !== 'modulo' || health.data?.status !== 'UP') {
    throw new Error('This address did not respond as a Modulo server.');
  }
  const issuer = `${server}/auth/realms/modulo`;
  const discovery = await CapacitorHttp.get({ url: `${issuer}/.well-known/openid-configuration`,
    disableRedirects: true, connectTimeout: 10_000, readTimeout: 10_000 });
  if (discovery.status !== 200 || discovery.data?.issuer !== issuer) {
    throw new Error('The server identity endpoint did not match its HTTPS address.');
  }
}

let routed = false;
/** Only Modulo API paths on the packaged origin are mapped to the selected server. */
export function installAndroidApiRouting(origin: string): void {
  if (Capacitor.getPlatform() !== 'android' || routed) return;
  const server = normalizeAndroidServer(origin);
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || (url.pathname !== '/api' && !url.pathname.startsWith('/api/'))) {
      return original(input, init);
    }
    const target = `${server}${url.pathname}${url.search}`;
    return original(input instanceof Request ? new Request(target, input) : target, init);
  };
  routed = true;
}

export function configureAndroidServer(origin: string): void {
  const server = normalizeAndroidServer(origin);
  window.__MODULO_CONFIG__ = { ...window.__MODULO_CONFIG__, serverOrigin: server,
    oidcIssuer: `${server}/auth/realms/modulo`, oidcClientId: 'modulo-frontend' };
  installAndroidApiRouting(server);
}
