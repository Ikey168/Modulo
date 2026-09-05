import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ session: { issuer: 'issuer', subject: 'alice', accessToken: 'token' } as null | { issuer: string; subject: string; accessToken: string } }));
vi.mock('../../features/auth/authService', () => ({ authService: { stateSession: () => auth.session } }));
import { authenticatedRequest } from '../authenticatedRequest';
beforeEach(() => { auth.session = { issuer: 'issuer', subject: 'alice', accessToken: 'token' }; vi.stubGlobal('fetch', vi.fn()); });
describe('private API transport', () => {
  it('never sends tokens to external content URLs or redirects', async () => {
    await expect(authenticatedRequest('https://outside.test/api/files/1/x')).rejects.toThrow('local API');
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue(new Response('bytes'));
    await authenticatedRequest('/api/files/1/x');
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer token');
    expect(options.redirect).toBe('error');
    expect(options.cache).toBe('no-store');
  });
  it('rejects a response belonging to the previous account', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      auth.session = { issuer: 'issuer', subject: 'bob', accessToken: 'other' };
      return new Response('private');
    });
    await expect(authenticatedRequest('/api/files/1/x')).rejects.toThrow('Account changed');
  });
  it('does not issue an anonymous request', async () => {
    auth.session = null;
    await expect(authenticatedRequest('/api/files/1/x')).rejects.toThrow('Sign in');
    expect(fetch).not.toHaveBeenCalled();
  });
});
