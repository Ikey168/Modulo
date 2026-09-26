import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrustCenterView } from '../TrustCenterView';
import { authenticatedRequest } from '../../../services/authenticatedRequest';
vi.mock('../../../services/authenticatedRequest', () => ({ authenticatedRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const release = { id: 'release-1', version: '2.0', image_digest: 'sha256:abc', publisher: 'Acme', verification_level: 'DOMAIN', trustStatus: 'VERIFIED', permissions: ['notes:write'], evidence: [{ evidence_type: 'SIGNATURE', status: 'VERIFIED', source: 'fixture', summary: 'checked', evaluated_at: '2026-09-08' }] };
function setup(status = 'VERIFIED') {
  vi.mocked(authenticatedRequest).mockImplementation(async path => {
    const value = path.endsWith('/trust') ? [{ plugin: 'acme', trustStatus: status, release }]
      : path.endsWith('/health') ? { releases: [release], history: [], runtime: { status: 'ACTIVE', endpoint: 'plugin:9090' }, recentRuns: [{ id: 'run-1', state: 'FAILED', created_at: '2026-09-08' }] }
        : path.endsWith('/install') ? { operation: 'op-1' } : { ...release, trustStatus: status };
    return new Response(JSON.stringify(value));
  });
  render(<MemoryRouter><TrustCenterView /></MemoryRouter>);
}
test('missing evidence blocks approval and cannot be labelled bundled', async () => {
  setup('UNKNOWN'); fireEvent.click(await screen.findByRole('button', { name: 'Review acme' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Approval is blocked');
  expect(screen.getByRole('button', { name: 'Approve pinned release' })).toBeDisabled();
  expect(screen.queryByText(/Bundled with Modulo/)).not.toBeInTheDocument();
});
test('declining runtime removal confirmation leaves the plugin untouched', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Review acme' }));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(await screen.findByRole('button', { name: 'Uninstall runtime' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(vi.mocked(authenticatedRequest).mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  confirm.mockRestore();
});
test('keyboard-accessible consent submits the exact reviewed release', async () => {
  setup(); fireEvent.click(await screen.findByRole('button', { name: 'Review acme' }));
  const consent = await screen.findByRole('checkbox'); consent.focus(); expect(consent).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Approve pinned release' })).toBeDisabled();
  expect(screen.getByText(/Can change your data/)).toBeVisible();
  fireEvent.click(consent); fireEvent.click(screen.getByRole('button', { name: 'Approve pinned release' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Release approved and pinned'));
  const call = vi.mocked(authenticatedRequest).mock.calls.find(([path]) => path.endsWith('/install'))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ release: 'release-1', consented: true });
  expect(screen.getByRole('link', { name: /execution failures/ })).toHaveAttribute('href', '/app/executions');
  expect(screen.getByRole('link', { name: /FAILED/ })).toHaveAttribute('href', '/app/executions?run=run-1');
});
