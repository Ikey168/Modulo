import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisDecisionView } from '../NoesisDecisionView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  state: vi.fn(),
  pointer: { namespace: 'research' } as { namespace: string; decisionId?: string; revision?: number;
    pendingKey?: string; pendingContent?: Record<string, unknown> } }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../PluginProvider', () => ({ usePlugins: () => ({ state: mock.state }) }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.state.mockReset();
  mock.pointer = { namespace: 'research' };
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
  const records = new Map<string, { value: Record<string, unknown>; pending: boolean;
    deleted: boolean; conflict?: unknown }>();
  mock.state.mockResolvedValue({
    get: (key: string) => records.get(key),
    create: async (key: string, value: Record<string, unknown>) => {
      records.set(key, { value, pending: true, deleted: false });
    },
    set: async (key: string, value: Record<string, unknown>) => {
      records.set(key, { value, pending: true, deleted: false });
    },
    synchronize: async () => { for (const record of records.values()) record.pending = false; },
  });
});

function fillChoice() {
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Renew?' } });
  fireEvent.change(screen.getByLabelText('Yes option'), { target: { value: 'Renew' } });
  fireEvent.change(screen.getByLabelText('No option'), { target: { value: 'Cancel' } });
  fireEvent.change(screen.getByLabelText('Stakes'), { target: { value: 'One month of cost' } });
  fireEvent.change(screen.getByLabelText('Required confidence'), { target: { value: 'Moderate' } });
  fireEvent.change(screen.getByLabelText('Stop condition'), { target: { value: 'Current usage known' } });
  fireEvent.change(screen.getByLabelText('Uncertainty'), { target: { value: 'Future use unknown' } });
  fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'No current use' } });
  fireEvent.change(screen.getByLabelText('Choose'), { target: { value: 'no' } });
}

it('persists an idempotency key before recording a standalone Noesis choice', async () => {
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'create_research_decision') return {
      decision_id: `decision:${'a'.repeat(32)}`, namespace: 'research', revision: 1,
      contract: 'noesis-decision-v2', content: args.content, decided_at_ms: 1,
    };
    if (tool === 'start_intake_mode') return { session_id: 'intake:choice', mode: 'Decision Support',
      status: 'active', revision: 1 };
    if (tool === 'command_intake_mode') return { session_id: 'intake:choice', mode: 'Decision Support',
      status: args.action === 'complete' ? 'completed' : 'active',
      revision: args.action === 'complete' ? 3 : 2 };
    return {};
  });
  render(<NoesisDecisionView namespace="research" available originSession={{
    session_id: 'intake:explore', mode: 'Exploration', references: [
      { kind: 'exploration_source', id: 'explore:source', namespace: 'research', version: 2 },
    ],
  }} />);
  fillChoice();
  fireEvent.click(screen.getByRole('button', { name: 'Record choice' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('create_research_decision',
    expect.objectContaining({ namespace: 'research',
      request_key: expect.stringMatching(/^modulo-decision-/),
      content: expect.objectContaining({ project: null, selected_action: 'no',
        decision_context: expect.objectContaining({ question: 'Renew?' }) }),
    })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[0]);
  expect(mock.set).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'research',
    pendingContent: expect.objectContaining({ selected_action: 'no',
      decision_context: expect.objectContaining({ question: 'Renew?' }) }) }));
  await waitFor(() => expect(mock.set).toHaveBeenLastCalledWith({
    namespace: 'research', decisionId: `decision:${'a'.repeat(32)}`, revision: 1,
  }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_mode',
    expect.objectContaining({ mode: 'Decision Support',
      origin: { session_id: 'intake:explore',
        reason: 'Decision recorded from the linked research context' },
      references: [
        { kind: 'exploration_source', id: 'explore:source', namespace: 'research', version: 2 },
        { kind: 'decision', id: `decision:${'a'.repeat(32)}`,
          namespace: 'research', version: 1 },
      ],
      workspace_links: [{ system: 'modulo', workspace_id: 'personal', kind: 'artifact',
        id: `decision.${'a'.repeat(32)}`, version: 1 }],
    })));
  expect(await screen.findByText(/Decision Support session intake:choice · completed/)).toBeInTheDocument();
});

it('can abandon a rejected create key without another remote mutation', async () => {
  mock.pointer = { namespace: 'research', pendingKey: 'rejected-key' };
  render(<NoesisDecisionView namespace="research" available />);
  fireEvent.click(screen.getByRole('button', { name: 'Abandon pending choice' }));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith({ namespace: 'research' }));
  expect(mock.call).not.toHaveBeenCalled();
});

it('does not replay a pending create key with a changed choice', async () => {
  mock.pointer = { namespace: 'research', pendingKey: 'saved-key', pendingContent: {
    project: null, decision_context: { question: 'Renew?', stakes: 'One month',
      required_confidence: 'Moderate', stop_condition: 'Usage known',
      uncertainty: 'Future use unknown', missing_inputs: [], deadline_at_ms: null },
    options: [{ id: 'yes', description: 'Renew' }, { id: 'no', description: 'Cancel' }],
    constraints: [], assumptions: [], observations: [], preferences: [],
    selected_action: 'no', rationale: 'No current use', review_conditions: [],
  } };
  render(<NoesisDecisionView namespace="research" available />);
  expect(await screen.findByDisplayValue('No current use')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'A different reason' } });
  fireEvent.click(screen.getByRole('button', { name: 'Retry saved choice' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The choice changed after its key was saved');
  expect(mock.call).not.toHaveBeenCalled();
});

it('keeps a denied decision read out of the workspace', async () => {
  mock.pointer = { namespace: 'research', decisionId: 'decision:revoked', revision: 1 };
  mock.call.mockRejectedValue(new Error('Current decision access is required'));
  render(<NoesisDecisionView namespace="research" available />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Current decision access is required');
  expect(screen.queryByText(/decision:revoked · v1/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Record choice' })).toBeDisabled();
});

it('re-inspects an uncertain revision before allowing another edit', async () => {
  mock.pointer = { namespace: 'research', decisionId: `decision:${'a'.repeat(32)}`, revision: 1 };
  const content = { project: null, decision_context: {
    question: 'Renew?', stakes: 'One month', required_confidence: 'Moderate',
    stop_condition: 'Usage known', uncertainty: 'Future use unknown',
    missing_inputs: [], deadline_at_ms: null },
    options: [{ id: 'yes', description: 'Renew' }, { id: 'no', description: 'Cancel' }],
    constraints: [], assumptions: [], observations: [], preferences: [],
    selected_action: 'no', rationale: 'No current use', review_conditions: [] };
  let revisedContent: unknown;
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'inspect_research_decision') return { decision_id: `decision:${'a'.repeat(32)}`,
      namespace: 'research', revision: revisedContent ? 2 : 1,
      contract: 'noesis-decision-v2', content: revisedContent ?? content, decided_at_ms: 1 };
    if (tool === 'revise_research_decision') { revisedContent = args.content;
      throw new Error('Response lost'); }
    if (tool === 'start_intake_mode') return { session_id: 'intake:choice', mode: 'Decision Support',
      status: 'active', revision: 1 };
    if (tool === 'command_intake_mode') return { session_id: 'intake:choice', mode: 'Decision Support',
      status: args.action === 'complete' ? 'completed' : 'active',
      revision: args.action === 'complete' ? 3 : 2 };
    if (tool === 'calculate_decision_sensitivity') return { receipt_id: 'sensitivity:one',
      decision_revision: 2,
      baseline: { scores: { yes: '0', no: '1' }, missing_inputs: {},
        ordering_with_ties: [['no'], ['yes']] },
      scenarios: [{ assumption: 'Cost matters less', scores: { yes: '1', no: '0' },
        missing_inputs: {}, ordering_with_ties: [['yes'], ['no']], ordering_changed: true }] };
    return {};
  });
  render(<NoesisDecisionView namespace="research" available />);
  expect(await screen.findByText(new RegExp(`decision:${'a'.repeat(32)} · v1`))).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Usage resumed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save decision revision' }));
  await waitFor(() => expect(screen.getByText(new RegExp(`decision:${'a'.repeat(32)} · v2`))).toBeInTheDocument());
  expect(mock.set).toHaveBeenLastCalledWith({ namespace: 'research',
    decisionId: `decision:${'a'.repeat(32)}`, revision: 2 });
  expect(screen.queryByText('Response lost')).not.toBeInTheDocument();
  expect(await screen.findByText(/Decision Support session intake:choice · completed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
  fireEvent.change(screen.getByLabelText('Criterion 1'), { target: { value: 'cost' } });
  fireEvent.change(screen.getByLabelText('Weight 1'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Yes utility 1'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('No utility 1'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Scenario weight 1'), { target: { value: '0.5' } });
  fireEvent.change(screen.getByLabelText('Alternative weight assumption'),
    { target: { value: 'Cost matters less' } });
  fireEvent.change(screen.getByLabelText('Utility provenance and scale'),
    { target: { value: 'Author utilities on a 0–1 scale' } });
  fireEvent.click(screen.getByRole('button', { name: 'Calculate comparison' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('calculate_decision_sensitivity',
    expect.objectContaining({ decision_id: `decision:${'a'.repeat(32)}`, revision: 2,
      weights: { cost: '1' }, inputs: { yes: { cost: '0' }, no: { cost: '1' } },
      scenarios: [{ assumption: 'Cost matters less', weights: { cost: '0.5' } }],
    })));
  expect(await screen.findByText('Baseline: no → yes')).toBeInTheDocument();
  expect(screen.getByText(/Ordering changed/)).toBeInTheDocument();
});
