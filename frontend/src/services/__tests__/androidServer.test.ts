import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  CapacitorHttp: { get },
}));

describe('Android server selection and API boundary', () => {
  const originalFetch = window.fetch;
  beforeEach(() => { get.mockReset(); vi.resetModules(); });
  afterEach(() => { window.fetch = originalFetch; delete window.__MODULO_CONFIG__; });

  it('accepts only a canonical HTTPS origin without credentials or paths', async () => {
    const { normalizeAndroidServer } = await import('../androidServer');
    expect(normalizeAndroidServer(' https://modulo.example.com/ ')).toBe('https://modulo.example.com');
    for (const address of ['http://modulo.example.com', 'https://user:pass@modulo.example.com',
      'https://modulo.example.com/notes', 'https://modulo.example.com/?token=bad',
      'https://modulo.example.com/#part', 'javascript:alert(1)']) {
      expect(() => normalizeAndroidServer(address)).toThrow();
    }
  });

  it('verifies the Modulo endpoint and exact OIDC issuer before saving', async () => {
    const { probeAndroidServer } = await import('../androidServer');
    get.mockResolvedValueOnce({ status: 200, data: { application: 'modulo', status: 'UP' } })
      .mockResolvedValueOnce({ status: 200, data: { issuer: 'https://modulo.example.com/auth/realms/modulo' } });
    await expect(probeAndroidServer('https://modulo.example.com')).resolves.toBeUndefined();
    expect(get.mock.calls.map(([options]) => options.url)).toEqual([
      'https://modulo.example.com/api/simple-health',
      'https://modulo.example.com/auth/realms/modulo/.well-known/openid-configuration',
    ]);
    get.mockReset().mockResolvedValueOnce({ status: 200, data: { application: 'modulo', status: 'UP' } })
      .mockResolvedValueOnce({ status: 200, data: { issuer: 'https://other.example/auth/realms/modulo' } });
    await expect(probeAndroidServer('https://modulo.example.com')).rejects.toThrow('identity endpoint');
  });

  it('routes only packaged Modulo API requests to the chosen origin', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    window.fetch = fetcher;
    const { installAndroidApiRouting } = await import('../androidServer');
    installAndroidApiRouting('https://modulo.example.com');
    const request = new Request(`${location.origin}/api/notes?limit=2`,
      { headers: { Authorization: 'Bearer test-token' } });
    await window.fetch(request);
    const forwarded = fetcher.mock.calls[0][0] as Request;
    expect(forwarded.url).toBe('https://modulo.example.com/api/notes?limit=2');
    expect(forwarded.headers.get('Authorization')).toBe('Bearer test-token');
    await window.fetch('/manifest.json');
    await window.fetch('https://elsewhere.example/api/notes');
    expect(fetcher.mock.calls[1][0]).toBe('/manifest.json');
    expect(fetcher.mock.calls[2][0]).toBe('https://elsewhere.example/api/notes');
  });
});
