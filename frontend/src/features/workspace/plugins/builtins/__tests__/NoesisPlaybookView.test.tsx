import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisPlaybookView } from '../NoesisPlaybookView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

const playbook = (revision: number) => ({
  playbook_id: 'playbook:one', namespace: 'research', revision, title: 'Repair search',
  prerequisites: [], environment: 'Desktop', verification: 'New item appears',
  source_rationale: 'Verified problem', trust_state: 'draft', origin: {
    session_id: 'intake:problem', revision: 4 },
  steps: [{ id: 'step-1', action: `Rebuild index v${revision}`,
    expected_result: 'New item appears', recovery: 'Check logs' }],
});

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.pointer = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
});

it('promotes a verified fix after saving a durable request key', async () => {
  mock.call.mockResolvedValue(playbook(1));
  render(<NoesisPlaybookView namespace="research" available problemSession={{
    session_id: 'intake:problem', mode: 'Problem-Solving', status: 'completed', revision: 4,
    inputs: { symptom: 'Repair search', environment: 'Desktop',
      success_check: 'New item appears' },
  }} />);
  fireEvent.change(screen.getByLabelText('Action'), {
    target: { value: 'Rebuild index' },
  });
  fireEvent.change(screen.getByLabelText('Expected result'), {
    target: { value: 'New item appears' },
  });
  fireEvent.change(screen.getByLabelText('If it fails'), {
    target: { value: 'Check logs' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Promote verified fix' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('promote_problem_playbook',
    expect.objectContaining({ problem_session_id: 'intake:problem',
      request_key: expect.stringMatching(/^modulo-playbook-/),
      title: 'Repair search', steps: [{ action: 'Rebuild index',
        expected_result: 'New item appears', recovery: 'Check logs' }] })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[0]);
  expect(await screen.findByText(/playbook:one · v1 · draft/)).toBeInTheDocument();
});

it('uses the pinned historical procedure when a guided run predates an edit', async () => {
  mock.pointer = { namespace: 'research', playbookId: 'playbook:one', runId: 'run:one' };
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'inspect_intake_playbook') return playbook(args.revision === 1 ? 1 : 2);
    if (tool === 'inspect_guided_playbook_run') return {
      run_id: 'run:one', playbook_id: 'playbook:one', playbook_revision: 1,
      revision: 3, status: 'active', next_step: 0, observations: [], verification: null,
    };
    if (tool === 'command_guided_playbook_run') return {
      run_id: 'run:one', playbook_id: 'playbook:one', playbook_revision: 1,
      revision: 4, status: 'active', next_step: 1, observations: [], verification: null,
    };
    return {};
  });
  render(<NoesisPlaybookView namespace="research" available />);
  expect(await screen.findByText('Next: Rebuild index v1')).toBeInTheDocument();
  expect(mock.call).toHaveBeenCalledWith('inspect_intake_playbook', {
    namespace: 'research', playbook_id: 'playbook:one', revision: 1,
  });
  fireEvent.change(screen.getByLabelText('Observed result'), {
    target: { value: 'New item appeared' },
  });
  fireEvent.click(screen.getByLabelText('Step passed'));
  fireEvent.click(screen.getByRole('button', { name: 'Record observed result' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_guided_playbook_run',
    expect.objectContaining({ action: 'step', expected_revision: 3,
      payload: { step_id: 'step-1', passed: true, observation: 'New item appeared' } })));
});

it('replays a pending final result even if the server already completed the run', async () => {
  mock.pointer = { namespace: 'research', playbookId: 'playbook:one', runId: 'run:one',
    pendingCommand: { key: 'command:one', expectedRevision: 2, action: 'verify',
      payload: { passed: true, observation: 'New item appeared' } } };
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'inspect_intake_playbook') return playbook(1);
    if (tool === 'inspect_guided_playbook_run' || tool === 'command_guided_playbook_run')
      return { run_id: 'run:one', playbook_id: 'playbook:one', playbook_revision: 1,
        revision: 3, status: 'completed', next_step: 1, observations: [],
        verification: { passed: true, observation: 'New item appeared', at_ms: 1 } };
    return {};
  });
  render(<NoesisPlaybookView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry pending result' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_guided_playbook_run',
    expect.objectContaining({ command_key: 'command:one', expected_revision: 2,
      action: 'verify', payload: { passed: true, observation: 'New item appeared' } })));
  expect(mock.set).toHaveBeenCalledWith({ namespace: 'research',
    playbookId: 'playbook:one', runId: 'run:one' });
});
