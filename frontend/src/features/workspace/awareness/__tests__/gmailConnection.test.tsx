import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GmailConnection } from '../GmailConnection';
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../workspaceTools/shared', async importOriginal => ({ ...await importOriginal<object>(), request }));
vi.mock('../../plugins/PluginProvider', () => ({ usePlugins: () => ({ stateSessionKey: 'account-one' }) }));
const initial = { configured: true, connected: false, email: '', searchQuery: 'label:newsletters newer_than:30d', enabled: false, lastSync: '', error: '', importedCount: 0, connectionId: '' };
beforeEach(() => { request.mockReset(); }); afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Gmail account connection', () => {
  it('explains missing server configuration without a nonfunctional connect button', async () => {
    request.mockResolvedValue({ ...initial, configured: false }); render(<GmailConnection onSynced={vi.fn()}/>);
    await screen.findByText(/Google sign-in needs to be configured/);
    expect(screen.queryByRole('button', { name: 'Connect Google account' })).toBeNull();
  });
  it('starts an authenticated connection and opens only Google consent', async () => {
    const popup = { location: { href: '' }, close: vi.fn() }; vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    request.mockImplementation(async (path: string) => path.endsWith('/connect') ? { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=opaque' } : initial);
    render(<GmailConnection onSynced={vi.fn()}/>); fireEvent.click(await screen.findByRole('button', { name: 'Connect Google account' }));
    await waitFor(() => expect(popup.location.href).toContain('https://accounts.google.com/'));
    expect(request).toHaveBeenCalledWith('/api/newsletters/gmail/connect', {});
  });
  it('requires an explicit search before syncing and refreshes stored issues', async () => {
    request.mockResolvedValue({ ...initial, connected: true, email: 'reader@example.org', connectionId: 'one' }); const onSynced = vi.fn().mockResolvedValue(undefined);
    render(<GmailConnection onSynced={onSynced}/>); const input = await screen.findByLabelText('Gmail search');
    expect(request).not.toHaveBeenCalledWith('/api/newsletters/gmail/sync', {});
    fireEvent.change(input, { target: { value: 'category:promotions newer_than:7d' } }); fireEvent.click(screen.getByRole('button', { name: 'Save search and sync' }));
    await waitFor(() => expect(onSynced).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('/api/newsletters/gmail', { query: 'category:promotions newer_than:7d', enabled: true }, 'PUT');
  });
  it('disconnects through DELETE rather than altering newsletter records', async () => {
    request.mockResolvedValue({ ...initial, connected: true, email: 'reader@example.org', connectionId: 'one' }); render(<GmailConnection onSynced={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/newsletters/gmail', {}, 'DELETE'));
  });
});
