import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisCreationView } from '../NoesisCreationView';

const mock = vi.hoisted(() => ({ call: vi.fn(), set: vi.fn(), retry: vi.fn(),
  pointer: { namespace: 'research' } as { namespace: string; projectId?: string;
    pendingStart?: Record<string, unknown>; pendingCommand?: Record<string, unknown> } }));
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

it('saves a retryable project start and reviews an existing report before export', async () => {
  mock.call.mockImplementation(async (tool: string, args: Record<string, unknown>) => {
    if (tool === 'start_intake_creation') return { project_id: 'creation:one', revision: 1,
      status: 'draft', title: 'Repair guide', audience: 'Operators',
      purpose: 'Explain recovery', artifact_type: 'documentation',
      criteria: ['Steps work'], report: null, review: null };
    if (tool === 'command_intake_creation') {
      if (args.action === 'attach_report') return { project_id: 'creation:one', revision: 2,
        status: 'draft', title: 'Repair guide', audience: 'Operators',
        purpose: 'Explain recovery', artifact_type: 'documentation',
        criteria: ['Steps work'], report: { id: 'report:one', revision: 1 }, review: null };
      if (args.action === 'review') return { project_id: 'creation:one', revision: 3,
        status: 'review', title: 'Repair guide', audience: 'Operators',
        purpose: 'Explain recovery', artifact_type: 'documentation',
        criteria: ['Steps work'], report: { id: 'report:one', revision: 1 },
        review: { checks: { 'Steps work': true }, notes: 'Tested steps', basis: 'author_reported' } };
      return { project_id: 'creation:one', revision: 4,
        status: 'finished', title: 'Repair guide', audience: 'Operators',
        purpose: 'Explain recovery', artifact_type: 'documentation',
        criteria: ['Steps work'], report: { id: 'report:one', revision: 1 },
        review: { checks: { 'Steps work': true }, notes: 'Tested steps', basis: 'author_reported' } };
    }
    if (tool === 'export_intake_creation') return { sha256: 'digest',
      publication_authorized: false, authored_report_export: { markdown: '# Repair guide' } };
    return {};
  });
  render(<NoesisCreationView namespace="research" available origin={{
    session_id: 'intake:research', references: [{ kind: 'source', id: 'source:one',
      namespace: 'research', version: 2 }],
    workspace_links: [{ system: 'modulo', workspace_id: 'personal',
      kind: 'project', id: 'project:one', version: 1 }],
  }} />);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Repair guide' } });
  fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'Operators' } });
  fireEvent.change(screen.getByLabelText('Purpose'), { target: { value: 'Explain recovery' } });
  fireEvent.change(screen.getByLabelText('Acceptance criteria (one per line)'),
    { target: { value: 'Steps work' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start creation project' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_creation',
    expect.objectContaining({ title: 'Repair guide', inputs: [{ kind: 'source',
      id: 'source:one', namespace: 'research', version: 2 }],
    workspace_links: [{ system: 'modulo', workspace_id: 'personal',
      kind: 'project', id: 'project:one', version: 1 }] })));
  expect(mock.set.mock.invocationCallOrder[0]).toBeLessThan(mock.retry.mock.invocationCallOrder[0]);
  expect(mock.retry.mock.invocationCallOrder[0]).toBeLessThan(mock.call.mock.invocationCallOrder[0]);
  expect(await screen.findByText(/creation:one · v1 · draft/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Authored report ID'), { target: { value: 'report:one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Attach report' }));
  expect(await screen.findByText('Attached report:one · v1')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Steps work'));
  fireEvent.change(screen.getByLabelText('Review notes'), { target: { value: 'Tested steps' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record author review' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('command_intake_creation',
    expect.objectContaining({ action: 'review', expected_revision: 2,
      payload: { checks: { 'Steps work': true }, notes: 'Tested steps' } })));
  fireEvent.click(await screen.findByRole('button', { name: 'Finish reviewed artifact' }));
  expect(await screen.findByText(/creation:one · v4 · finished/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export accepted artifact' }));
  expect(await screen.findByText('# Repair guide')).toBeInTheDocument();
  expect(screen.getByText(/Publication not authorized/)).toBeInTheDocument();
});

it('can abandon a rejected start without another remote write', async () => {
  mock.pointer = { namespace: 'research', pendingStart: {
    namespace: 'research', request_key: 'rejected-key', title: 'Guide', audience: 'Team',
    artifact_type: 'documentation', purpose: 'Explain', criteria: ['Usable'],
    inputs: [], workspace_links: [],
  } };
  render(<NoesisCreationView namespace="research" available />);
  fireEvent.click(screen.getByRole('button', { name: 'Abandon pending creation' }));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith({ namespace: 'research' }));
  expect(mock.call).not.toHaveBeenCalled();
});

it('clears a rejected command only while the Noesis project revision is unchanged', async () => {
  mock.pointer = { namespace: 'research', projectId: 'creation:one',
    pendingCommand: { key: 'bad-report', action: 'attach_report',
      expectedRevision: 1, payload: { report_id: 'report:missing', revision: 1 } } };
  mock.call.mockResolvedValue({ project_id: 'creation:one', revision: 1,
    status: 'draft', title: 'Guide', audience: 'Operators', purpose: 'Explain',
    artifact_type: 'documentation', criteria: ['Usable'], report: null, review: null });
  render(<NoesisCreationView namespace="research" available />);
  fireEvent.click(screen.getByRole('button', { name: 'Abandon rejected change' }));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith({
    namespace: 'research', projectId: 'creation:one',
  }));
  expect(mock.call).not.toHaveBeenCalledWith('command_intake_creation', expect.anything());
});
