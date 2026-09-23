import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisArtifactIterationView } from '../NoesisArtifactIterationView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

const session = (revision: number, data: Record<string, unknown> = {}) => ({
  session_id: 'intake:artifact-cycle', mode: 'Iteration', status: 'active', revision,
  inputs: { iteration_contract: 'noesis-intake-iteration-decision-v1',
    decision: { kind: 'decision', id: 'decision:one', namespace: 'research', version: 1 },
    expected: 'Latency stays under five seconds', stability_criteria: 'Three measured runs' },
  data,
});

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.pointer = { namespace: 'research' };
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
});

it('records and accepts a measured decision revision with replay-safe writes', async () => {
  const original = { project: null, decision_context: { question: 'Change the refresh?',
    stakes: 'Stale results', required_confidence: 'Moderate', stop_condition: 'Latency checked',
    uncertainty: 'One run', missing_inputs: [], deadline_at_ms: null },
  options: [{ id: 'daily', description: 'Keep daily' }, { id: 'threshold', description: 'Use a threshold' }],
  constraints: [], assumptions: [], observations: [], preferences: [], selected_action: 'daily',
  rationale: 'Predictable', review_conditions: [] };
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'start_intake_decision_iteration') return session(1);
    if (tool === 'record_intake_iteration_outcome') return session(2, {
      outcome: { observed: 'Seven seconds', learning: 'Daily refresh lags' },
    });
    if (tool === 'propose_intake_decision_revision') return session(3, {
      outcome: { observed: 'Seven seconds', learning: 'Daily refresh lags' },
      proposal: { review_state: 'proposed', content: { selected_action: 'threshold' } },
    });
    if (tool === 'accept_intake_decision_revision') return session(4, {
      accepted_revision: { id: 'decision:one', revision: 2 },
    });
    return {};
  });
  render(<NoesisArtifactIterationView namespace="research" available />);
  fireEvent.change(screen.getByLabelText('Object ID'), { target: { value: 'decision:one' } });
  fireEvent.change(screen.getByLabelText('Expected outcome'), { target: { value: 'Latency stays under five seconds' } });
  fireEvent.change(screen.getByLabelText('Stability criteria'), { target: { value: 'Three measured runs' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start artifact iteration' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_decision_iteration',
    expect.objectContaining({ decision_id: 'decision:one', expected_revision: 1,
      request_key: expect.stringMatching(/^modulo-artifact-iteration-/) })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[0]);

  for (const [field, value] of [
    ['Observed outcome', 'Seven seconds'], ['Learning', 'Daily refresh lags'],
    ['Metric', 'latency'], ['Unit', 'seconds'], ['Expected value', '5'],
    ['Observed value', '7'], ['Uncertainty', 'One run'], ['Possible external causes', 'Index growth'],
  ]) fireEvent.change(screen.getByLabelText(field), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Record measured outcome' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('record_intake_iteration_outcome',
    expect.objectContaining({ expected_revision: 1, evidence: [],
      measurements: [{ metric: 'latency', expected: '5', observed: '7', unit: 'seconds' }] })));

  fireEvent.change(screen.getByLabelText('Proposed original-object content (JSON)'), {
    target: { value: JSON.stringify({ ...original, selected_action: 'threshold',
      rationale: 'Measured latency exceeded the limit' }) },
  });
  fireEvent.change(screen.getByLabelText('Before/after rationale'), {
    target: { value: 'Replace daily schedule with a measured threshold' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save proposal for review' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('propose_intake_decision_revision',
    expect.objectContaining({ expected_revision: 2, before_after_rationale: 'Replace daily schedule with a measured threshold' })));
  fireEvent.click(await screen.findByRole('button', { name: 'Accept proposed revision' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('accept_intake_decision_revision',
    expect.objectContaining({ expected_revision: 3, command_key: expect.stringMatching(/^modulo-artifact-iteration-/) })));
  expect(await screen.findByText(/original Noesis artifact history was updated/)).toBeInTheDocument();
});

it('pins a Modulo note by exact plugin identity and labels acceptance local-only', async () => {
  mock.call.mockImplementation(async (tool: string) => tool === 'start_intake_modulo_note_iteration' ? {
    ...session(1), inputs: { iteration_contract: 'noesis-intake-iteration-modulo-note-v1',
      modulo_note: { kind: 'modulo_note', id: 'note-2', namespace: 'research', version: 4 },
      expected: 'Expected', stability_criteria: 'Two checks' },
  } : {});
  render(<NoesisArtifactIterationView namespace="research" available />);
  fireEvent.change(screen.getByLabelText('Original object type'), { target: { value: 'modulo_note' } });
  fireEvent.change(screen.getByLabelText('Exact Modulo plugin link (JSON)'), { target: { value: JSON.stringify({
    workspace_id: 'workspace-2', account_id: 'account-3', plugin_id: 'notes-editor',
    collection: 'notes', record_id: 'note-2', authoritative_version: 4,
    representation: 'intentional_snapshot', authority: 'modulo',
  }) } });
  fireEvent.change(screen.getByLabelText('Pinned note source snapshot (JSON)'), {
    target: { value: JSON.stringify({ title: 'A note', body: 'Pinned content' }) },
  });
  fireEvent.change(screen.getByLabelText('Expected outcome'), { target: { value: 'Expected' } });
  fireEvent.change(screen.getByLabelText('Stability criteria'), { target: { value: 'Two checks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start artifact iteration' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_modulo_note_iteration',
    expect.objectContaining({ plugin_link: expect.objectContaining({ record_id: 'note-2', authoritative_version: 4 }),
      source_snapshot: { title: 'A note', body: 'Pinned content' } })));
});

it('does not abandon an uncertain change after the Noesis cycle advanced', async () => {
  mock.pointer = { namespace: 'research', sessionId: 'intake:artifact-cycle', pending: {
    tool: 'accept_intake_decision_revision', expectedRevision: 3,
    args: { namespace: 'research', session_id: 'intake:artifact-cycle',
      command_key: 'saved-key', expected_revision: 3 },
  } };
  mock.call.mockResolvedValueOnce(session(3)).mockResolvedValueOnce(session(4));
  render(<NoesisArtifactIterationView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abandon rejected change' }));
  expect(await screen.findByText(/cycle changed/)).toBeInTheDocument();
  expect(mock.set).not.toHaveBeenCalledWith({ namespace: 'research', sessionId: 'intake:artifact-cycle' });
});
