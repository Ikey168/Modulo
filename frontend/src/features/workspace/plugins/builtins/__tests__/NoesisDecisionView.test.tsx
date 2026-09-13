import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisDecisionView } from '../NoesisDecisionView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as { namespace: string; decisionId?: string; revision?: number; pendingKey?: string } }));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call }));
vi.mock('../../usePluginState', () => ({ usePluginState: () => ({
  value: mock.pointer, ready: true, pending: false, error: undefined, conflict: undefined,
  set: mock.set, retry: mock.retry,
}) }));

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  mock.call.mockReset(); mock.set.mockReset(); mock.retry.mockReset();
  mock.pointer = { namespace: 'research' };
  mock.set.mockResolvedValue(undefined); mock.retry.mockResolvedValue(undefined);
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
      decision_id: 'decision:one', namespace: 'research', revision: 1,
      contract: 'noesis-decision-v2', content: args.content, decided_at_ms: 1,
    };
    return {};
  });
  render(<NoesisDecisionView namespace="research" available />);
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
  await waitFor(() => expect(mock.set).toHaveBeenLastCalledWith({
    namespace: 'research', decisionId: 'decision:one', revision: 1,
  }));
  expect(screen.getByText(/decision:one · v1/)).toBeInTheDocument();
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
  mock.pointer = { namespace: 'research', decisionId: 'decision:one', revision: 1 };
  const content = { project: null, decision_context: {
    question: 'Renew?', stakes: 'One month', required_confidence: 'Moderate',
    stop_condition: 'Usage known', uncertainty: 'Future use unknown',
    missing_inputs: [], deadline_at_ms: null },
    options: [{ id: 'yes', description: 'Renew' }, { id: 'no', description: 'Cancel' }],
    constraints: [], assumptions: [], observations: [], preferences: [],
    selected_action: 'no', rationale: 'No current use', review_conditions: [] };
  let revisedContent: unknown;
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'inspect_research_decision') return { decision_id: 'decision:one',
      namespace: 'research', revision: revisedContent ? 2 : 1,
      contract: 'noesis-decision-v2', content: revisedContent ?? content, decided_at_ms: 1 };
    if (tool === 'revise_research_decision') { revisedContent = args.content;
      throw new Error('Response lost'); }
    return {};
  });
  render(<NoesisDecisionView namespace="research" available />);
  expect(await screen.findByText(/decision:one · v1/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Rationale'), { target: { value: 'Usage resumed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save decision revision' }));
  await waitFor(() => expect(screen.getByText(/decision:one · v2/)).toBeInTheDocument());
  expect(mock.set).toHaveBeenLastCalledWith({ namespace: 'research',
    decisionId: 'decision:one', revision: 2 });
  expect(screen.queryByText('Response lost')).not.toBeInTheDocument();
});
