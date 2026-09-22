import { authService } from '../features/auth/authService';

const DEV_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

/** Same-origin API requests only: never forward credentials to a content-provided URL. */
export async function authenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new Error('Authenticated requests require a local API URL');
  }
  const session = authService.stateSession();
  // The protected-route dev bypass is also used by bounded Playwright API
  // fixtures. It never exists in production builds; a real backend still
  // enforces authentication independently.
  if (!session && DEV_BYPASS) {
    return fetch(url.href, { ...options, redirect: 'error', cache: 'no-store' });
  }
  if (!session) throw new Error('Sign in to continue');
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  const response = await fetch(url.href, { ...options, headers, redirect: 'error', cache: 'no-store' });
  const current = authService.stateSession();
  if (!current || current.issuer !== session.issuer || current.subject !== session.subject) {
    throw new Error('Account changed during request');
  }
  return response;
}
