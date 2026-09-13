import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisIterationView } from '../NoesisIterationView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: (_plugin: string, key: string) => ({
  value: key === 'playbook.last' ? { namespace: 'research', playbookId: 'playbook:one' } : mock.pointer,
  ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

const playbook = { playbook_id: 'playbook:one', revision: 1, title: 'Repair search',
  prerequisites: [], environment: 'Desktop',
  steps: [{ action: 'Restart worker', expected_result: 'Item visible', recovery: 'Inspect logs' }],
  verification: 'New item visible', source_rationale: 'Observed repair' };
const session = (revision: number, data: Record<string, unknown> = {}, status = 'active') => ({
  session_id: 'intake:cycle', mode: 'Iteration', status, revision, duration_minutes: 45,
  inputs: { playbook: { id: 'playbook:one', version: 1 },
    expected: 'Search under two seconds', stability_criteria: 'Three clean runs' },
  data, unmet_completion_checks: status === 'completed' ? [] : ['stability_review'],
});

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.pointer = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
});

it('pins a linked playbook and keeps measured outcome and proposal writes retryable', async () => {
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'inspect_intake_playbook') return playbook;
    if (tool === 'start_intake_iteration') return session(1);
    if (tool === 'record_intake_iteration_outcome') return session(2, {
      outcome: { observed: 'Five seconds', learning: 'Wait for sync' },
    });
    if (tool === 'propose_intake_playbook_revision') return session(3, {
      outcome: { observed: 'Five seconds', learning: 'Wait for sync' },
      proposal: { content: { title: 'Repair search' },
        before_after_rationale: 'Wait for sync before checking', review_state: 'proposed' },
    });
    return {};
  });
  render(<NoesisIterationView namespace="research" available />);
  expect(await screen.findByText(/Linked playbook:one · v1/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Expected outcome'),
    { target: { value: 'Search under two seconds' } });
  fireEvent.change(screen.getByLabelText('Stability criteria'),
    { target: { value: 'Three clean runs' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start playbook iteration' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_iteration',
    expect.objectContaining({ playbook_id: 'playbook:one', expected_revision: 1,
      request_key: expect.stringMatching(/^modulo-iteration-/) })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[1]);
  expect(await screen.findByText(/intake:cycle · v1 · active/)).toBeInTheDocument();
  for (const [field, value] of [
    ['Observed outcome', 'Five seconds'], ['Learning', 'Wait for sync'],
    ['Metric', 'latency'], ['Unit', 'seconds'], ['Expected value', '2'],
    ['Observed value', '5'], ['Uncertainty', 'One run'],
    ['Possible external causes', 'Heavy sync'],
  ]) fireEvent.change(screen.getByLabelText(field), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Record measured outcome' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('record_intake_iteration_outcome',
    expect.objectContaining({ expected_revision: 1, measurements: [{ metric: 'latency',
      expected: '2', observed: '5', unit: 'seconds' }], external_causes: 'Heavy sync' })));
  expect(await screen.findByText(/Observed: Five seconds/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Before/after rationale'),
    { target: { value: 'Wait for sync before checking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save proposal for review' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('propose_intake_playbook_revision',
    expect.objectContaining({ expected_revision: 2, before_after_rationale: 'Wait for sync before checking' })));
  expect(await screen.findByRole('button', { name: 'Accept into playbook history' })).toBeInTheDocument();
});

it('retries an uncertain acceptance with the exact saved key and revision', async () => {
  mock.pointer = { namespace: 'research', sessionId: 'intake:cycle', pending: {
    tool: 'accept_intake_playbook_revision', expectedRevision: 3,
    args: { namespace: 'research', session_id: 'intake:cycle',
      command_key: 'saved-key', expected_revision: 3 },
  } };
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'inspect_intake_playbook') return playbook;
    if (tool === 'accept_intake_playbook_revision') return session(4, {
      accepted_revision: { id: 'playbook:one', revision: 2 },
    });
    return session(3, {});
  });
  render(<NoesisIterationView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry Iteration change' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('accept_intake_playbook_revision', {
    namespace: 'research', session_id: 'intake:cycle',
    command_key: 'saved-key', expected_revision: 3,
  }));
  expect(mock.set).toHaveBeenCalledWith({ namespace: 'research', sessionId: 'intake:cycle' });
});

it('clears a rejected acceptance only while the playbook and cycle are unchanged', async () => {
  mock.pointer = { namespace: 'research', sessionId: 'intake:cycle', pending: {
    tool: 'accept_intake_playbook_revision', expectedRevision: 3,
    args: { namespace: 'research', session_id: 'intake:cycle',
      command_key: 'rejected-key', expected_revision: 3 },
  } };
  mock.call.mockImplementation(async (tool: string) =>
    tool === 'inspect_intake_playbook' ? playbook : session(3));
  render(<NoesisIterationView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abandon rejected change' }));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith({
    namespace: 'research', sessionId: 'intake:cycle',
  }));
  expect(mock.call).not.toHaveBeenCalledWith('accept_intake_playbook_revision', expect.anything());
});
