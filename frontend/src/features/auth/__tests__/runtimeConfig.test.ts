import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { delete window.__MODULO_CONFIG__; vi.unstubAllEnvs(); vi.resetModules(); });
it('uses the container issuer consistently for discovery and every OIDC endpoint', async () => {
  window.__MODULO_CONFIG__ = { oidcIssuer: 'https://staging.example/auth/realms/modulo', oidcClientId: 'staging-client' };
  const { oidcConfig } = await import('../oidcConfig');
  expect(oidcConfig.authority).toBe(window.__MODULO_CONFIG__.oidcIssuer);
  expect(oidcConfig.client_id).toBe('staging-client');
  expect(oidcConfig.metadata?.issuer).toBe(oidcConfig.authority);
  for (const [key, value] of Object.entries(oidcConfig.metadata ?? {})) {
    if (key.endsWith('_endpoint') || key === 'jwks_uri' || key === 'check_session_iframe') {
      expect(value).toMatch(/^https:\/\/staging.example\/auth\/realms\/modulo\//);
    }
  }
});
it('retains Vite issuer configuration for local development', async () => {
  vi.stubEnv('VITE_KEYCLOAK_URL', 'http://localhost:8180/realms/development');
  const { oidcConfig } = await import('../oidcConfig');
  expect(oidcConfig.authority).toBe('http://localhost:8180/realms/development');
});
