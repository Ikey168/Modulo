import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisProblemView } from '../NoesisProblemView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.pointer = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
});

it('saves a start key before opening an interrupting Noesis problem', async () => {
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'start_problem_session') return { session_id: 'intake:problem',
      mode: 'Problem-Solving', status: 'active', revision: 1,
      inputs: { symptom: 'Search is stale', success_check: 'New item appears' },
      data: {}, unmet_completion_checks: ['verified_fix'] };
    return {};
  });
  render(<NoesisProblemView namespace="research" available originSession={{
    session_id: 'intake:explore', mode: 'Exploration', status: 'active',
  }} />);
  fireEvent.change(screen.getByLabelText('Symptom'), { target: { value: 'Search is stale' } });
  fireEvent.change(screen.getByLabelText('Environment and version'), {
    target: { value: 'Desktop 2.7 on Linux' },
  });
  fireEvent.change(screen.getByLabelText('Urgency'), { target: { value: 'blocking' } });
  fireEvent.change(screen.getByLabelText('Observable success check'), {
    target: { value: 'New item appears' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Start troubleshooting' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_problem_session',
    expect.objectContaining({ namespace: 'research', symptom: 'Search is stale',
      request_key: expect.stringMatching(/^modulo-problem-/),
      origin: { session_id: 'intake:explore',
        reason: 'Troubleshooting interrupted the linked intake workflow' } })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[0]);
  expect(await screen.findByText(/intake:problem · v1 · active/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resolve verified problem' })).toBeDisabled();
});

it('retries a pending verification with its original command key and revision', async () => {
  mock.pointer = { namespace: 'research', sessionId: 'intake:problem', pendingStep: {
    key: 'step-1', expectedRevision: 2, kind: 'verification', summary: 'Search again',
    observation: 'New item appeared', nextAction: null, passed: true,
  } };
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'inspect_intake_mode') return { session_id: 'intake:problem',
      mode: 'Problem-Solving', status: 'active', revision: 3,
      inputs: { symptom: 'Search is stale', success_check: 'New item appears' },
      data: { problem_trail: [] }, unmet_completion_checks: [] };
    if (tool === 'record_problem_step') return { session_id: 'intake:problem',
      mode: 'Problem-Solving', status: 'active', revision: 3,
      inputs: { symptom: 'Search is stale', success_check: 'New item appears' },
      data: { problem_trail: [{ kind: 'verification', summary: 'Search again',
        observation: 'New item appeared', next_action: null, passed: true, at_ms: 1000 }] },
      unmet_completion_checks: [] };
    return {};
  });
  render(<NoesisProblemView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry pending step' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('record_problem_step',
    expect.objectContaining({ command_key: 'step-1', expected_revision: 2,
      kind: 'verification', passed: true, observation: 'New item appeared' })));
  expect(mock.set).toHaveBeenCalledWith({ namespace: 'research', sessionId: 'intake:problem' });
  expect(await screen.findByText('Check passed')).toBeInTheDocument();
});
