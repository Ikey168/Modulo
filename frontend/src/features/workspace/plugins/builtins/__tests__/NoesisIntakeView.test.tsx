import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisIntakeView } from '../NoesisIntakeView';

const mock = vi.hoisted(() => ({
  call: vi.fn(),
  preflight: vi.fn(),
  set: vi.fn(),
}));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call, intakePreflight: mock.preflight }));
vi.mock('../../usePluginState', () => ({
  usePluginState: () => ({
    value: { namespace: 'research' }, ready: true, set: mock.set,
    error: undefined,
  }),
}));

beforeEach(() => {
  mock.call.mockReset(); mock.preflight.mockReset(); mock.set.mockReset();
  mock.preflight.mockResolvedValue({ available: true });
  mock.set.mockResolvedValue(undefined);
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'list_intake_feed_inbox') return {
      remaining_unprocessed: 1,
      items: [{ item_id: 'feed:one', title: 'A source', original_url: 'https://example.org/a',
        source_version: 2, decision: null, read_at_ms: null }],
    };
    if (tool === 'start_awareness_from_inbox') return {
      session_id: 'intake:today', mode: 'Awareness', status: 'active', revision: 1,
      duration_minutes: 15, inputs: { feed_item_ids: ['feed:one'] }, data: {},
    };
    if (tool === 'triage_awareness_item') return {
      session_id: 'intake:today', mode: 'Awareness', status: 'active', revision: 2,
      duration_minutes: 15, inputs: { feed_item_ids: ['feed:one'] },
      data: { decisions: { 'feed:one': 'discard' } },
    };
    return {};
  });
});

it('starts a durable daily queue and triages through the Noesis session', async () => {
  render(<NoesisIntakeView />);
  expect(await screen.findByText('A source')).toHaveAttribute('href', 'https://example.org/a');
  fireEvent.click(screen.getByRole('button', { name: 'Start daily triage' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_awareness_from_inbox',
    expect.objectContaining({ namespace: 'research', request_key: expect.stringMatching(/^modulo-awareness-/) })));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith(
    expect.objectContaining({ lastSessionId: 'intake:today' })));
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('triage_awareness_item',
    expect.objectContaining({ session_id: 'intake:today', item_id: 'feed:one', decision: 'discard' })));
  expect(mock.call).not.toHaveBeenCalledWith('decide_intake_feed_item', expect.anything());
});
