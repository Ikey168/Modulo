import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const listeners = new Map<string, ((event: Record<string, unknown>) => void)[]>();
  const cache = { add: vi.fn(async (url: string) => { void url; }), addAll: vi.fn(async () => {}), put: vi.fn(async () => {}) };
  const caches = { open: vi.fn(async () => cache), match: vi.fn(async () => 'cached') };
  const self = { location: { origin: 'https://modulo.test' }, addEventListener: (type: string, fn: (event: Record<string, unknown>) => void) => listeners.set(type, [...listeners.get(type) ?? [], fn]), skipWaiting: vi.fn(async () => {}) };
  const fetch = vi.fn(async () => { throw new TypeError('Offline'); });
  new Function('self', 'caches', 'fetch', readFileSync('public/sw.js', 'utf8'))(self, caches, fetch);
  return { cache, caches, listeners, fetch };
}
describe('offline application shell', () => {
  it('never intercepts API responses or external URLs', () => {
    const env = worker(); const respondWith = vi.fn();
    for (const url of ['https://modulo.test/api/notes', 'https://identity.test/userinfo']) env.listeners.get('fetch')!.forEach(fn => fn({ request: { url, method: 'GET' }, respondWith }));
    expect(respondWith).not.toHaveBeenCalled();
  });
  it('retains runtime configuration for disconnected reloads', async () => {
    const env = worker(); let response: Promise<unknown> | undefined;
    env.listeners.get('fetch')!.forEach(fn => fn({ request: { url: 'https://modulo.test/runtime-config.js', method: 'GET' }, respondWith: (value: Promise<unknown>) => { response = value; } }));
    expect(await response).toBe('cached');
  });
  it('precaches only already-loaded same-origin application assets', async () => {
    const env = worker(); let work: Promise<unknown> | undefined;
    env.listeners.get('message')!.forEach(fn => fn({ data: { type: 'CACHE_LOADED_ASSETS', urls: ['https://modulo.test/assets/main.js', 'https://modulo.test/runtime-config.js', 'https://modulo.test/api/notes', 'https://other.test/assets/secret.js'] }, waitUntil: (value: Promise<unknown>) => { work = value; } }));
    await work;
    expect(env.cache.add.mock.calls.map(args => args[0])).toEqual(['https://modulo.test/assets/main.js', 'https://modulo.test/runtime-config.js']);
  });
});
