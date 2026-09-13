import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisMaintenanceView } from '../NoesisMaintenanceView';

const finding = { id: 'finding:one', reason: 'old_draft_playbook',
  detail: 'Draft procedure has not been revised', suggested_action: 'rehearse_or_archive',
  target: { kind: 'playbook', id: 'playbook:one', namespace: 'research', version: 1 } };
const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as Record<string, unknown> }));
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

it('saves a start key, reviews a finding, assesses health, and completes', async () => {
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'scan_intake_maintenance') return { findings: [finding], coverage: ['old_draft_playbook'],
      limitations: [], as_of_ms: 1000 };
    if (tool === 'start_intake_maintenance') return { session_id: 'intake:maintenance', mode: 'Maintenance',
      status: 'active', revision: 1, duration_minutes: 45, inputs: { findings: [finding] }, data: {} };
    if (tool === 'record_maintenance_finding') return { session_id: 'intake:maintenance', mode: 'Maintenance',
      status: 'active', revision: 2, duration_minutes: 45, inputs: { findings: [finding] },
      data: { maintenance_reviews: { [finding.id]: { action: args.action, observation: args.observation,
        basis: 'caller_reported' } } } };
    if (tool === 'assess_maintenance_health') return { session_id: 'intake:maintenance', mode: 'Maintenance',
      status: 'active', revision: 3, duration_minutes: 45, inputs: { findings: [finding] },
      data: { maintenance_reviews: { [finding.id]: { action: 'defer', observation: 'Next month',
        basis: 'caller_reported' } }, health_assessment: { acceptable: true,
          criteria: args.criteria, observation: args.observation, basis: 'caller_reported' } } };
    if (tool === 'command_intake_mode') return { session_id: 'intake:maintenance', mode: 'Maintenance',
      status: 'completed', revision: 4, duration_minutes: 45, inputs: { findings: [finding] },
      data: { maintenance_reviews: { [finding.id]: { action: 'defer', observation: 'Next month',
        basis: 'caller_reported' } }, health_assessment: { acceptable: true,
          criteria: 'No unresolved blocking failures', observation: 'All clear', basis: 'caller_reported' } } };
    return {};
  });
  render(<NoesisMaintenanceView namespace="research" available />);
  fireEvent.click(screen.getByRole('button', { name: 'Start monthly review' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_maintenance',
    expect.objectContaining({ request_key: expect.stringMatching(/^modulo-maintenance-/),
      duration_minutes: 45 })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[1]);
  expect(await screen.findByText(/intake:maintenance · v1 · active/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Observation', { selector: 'input' }),
    { target: { value: 'Next month' } });
  fireEvent.change(screen.getByLabelText('Disposition'), { target: { value: 'defer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('record_maintenance_finding',
    expect.objectContaining({ finding_id: finding.id, action: 'defer', expected_revision: 1 })));
  fireEvent.change(screen.getByLabelText('Observation', { selector: 'textarea' }),
    { target: { value: 'All clear' } });
  fireEvent.click(screen.getByLabelText('Criteria acceptable'));
  fireEvent.click(screen.getByRole('button', { name: 'Record health' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('assess_maintenance_health',
    expect.objectContaining({ expected_revision: 2, acceptable: true, observation: 'All clear' })));
  fireEvent.click(screen.getByRole('button', { name: 'Complete review' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_intake_mode',
    expect.objectContaining({ action: 'complete', expected_revision: 3 })));
  expect(await screen.findByText(/Review completed/)).toBeInTheDocument();
});

it('retries a saved write with its exact payload', async () => {
  mock.pointer = { namespace: 'research', sessionId: 'intake:maintenance', pending: {
    tool: 'record_maintenance_finding', args: { namespace: 'research',
      session_id: 'intake:maintenance', command_key: 'saved-key', expected_revision: 1,
      finding_id: finding.id, action: 'defer', observation: 'Next month' },
  } };
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'scan_intake_maintenance') return { findings: [finding], coverage: [], limitations: [], as_of_ms: 1000 };
    return { session_id: 'intake:maintenance', mode: 'Maintenance', status: 'active', revision: 2,
      duration_minutes: 45, inputs: { findings: [finding] }, data: {} };
  });
  render(<NoesisMaintenanceView namespace="research" available />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry Maintenance change' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('record_maintenance_finding',
    expect.objectContaining({ command_key: 'saved-key', expected_revision: 1,
      action: 'defer', observation: 'Next month' })));
  expect(mock.set).toHaveBeenCalledWith({ namespace: 'research', sessionId: 'intake:maintenance' });
});
