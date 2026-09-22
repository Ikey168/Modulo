import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));

afterEach(() => { delete window.__MODULO_CONFIG__; vi.resetModules(); });

it('uses the selected server callback without browser token storage', async () => {
  window.__MODULO_CONFIG__ = { serverOrigin: 'https://modulo.example.com',
    oidcIssuer: 'https://modulo.example.com/auth/realms/modulo', oidcClientId: 'modulo-frontend' };
  const { oidcConfig } = await import('../oidcConfig');
  expect(oidcConfig.authority).toBe('https://modulo.example.com/auth/realms/modulo');
  expect(oidcConfig.redirect_uri).toBe('https://modulo.example.com/auth/callback');
  expect(oidcConfig.post_logout_redirect_uri).toBe('com.modulo:/logout');
  expect(oidcConfig.automaticSilentRenew).toBe(false);
  expect(oidcConfig.silent_redirect_uri).toBeUndefined();
  const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
  await oidcConfig.userStore?.set('test-key', 'test-value');
  expect(await oidcConfig.userStore?.get('test-key')).toBe('test-value');
  expect(storageWrite).not.toHaveBeenCalled();
  storageWrite.mockRestore();
});
