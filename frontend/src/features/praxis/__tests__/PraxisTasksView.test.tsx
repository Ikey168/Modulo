import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix checkbox and select measure themselves with ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const { api } = vi.hoisted(() => ({
  api: {
    status: vi.fn(), list: vi.fn(), submit: vi.fn(), inspect: vi.fn(), approvals: vi.fn(),
    control: vi.fn(), decide: vi.fn(), publish: vi.fn(),
  },
}));
vi.mock('../praxisApi', async importOriginal => ({
  ...(await importOriginal<object>()),
  praxisApi: api,
  followEvents: vi.fn(() => new Promise(() => {})),
}));

import { PraxisTasksView } from '../PraxisTasksView';
import type { ProcessView } from '../praxisApi';

function view(overrides: Partial<ProcessView['summary']> & { executor?: string }): ProcessView {
  const executor = overrides.executor ?? 'fake';
  const unsupported = executor === 'claude';
  const control = (available: boolean, reason: ProcessView['controls']['cancel']['reason'] = 'process_state') => ({
    supported: !unsupported, available: !unsupported && available, reason: unsupported ? 'executor_unsupported' as const : available ? null : reason,
  });
  return {
    process_id: 'p-1', attempt_id: 'a-1', state: overrides.state ?? 'completed', parent_id: null, children: [],
    spec: { objective: 'Summarize the release', executor }, blocking_reason: null,
    summary: {
      state: 'completed', executor, finished: true, execution: { status: 'completed', reason: 'fake.completed' },
      verification: { available: true, approved: false, requiredFailures: ['tests'], missingOutputs: [] }, publishable: false,
      ...overrides,
    } as ProcessView['summary'],
    controls: {
      cancel: control(false), suspend: control(false), resume: control(false), signal: control(false),
      retry: { supported: true, available: false, reason: 'process_not_failed' },
    },
  };
}

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.status.mockResolvedValue({ configured: true, executors: { fake: ['cancel'], claude: [] } });
  api.list.mockResolvedValue([{ processId: 'p-1', objective: 'Summarize the release', executor: 'fake', publishRequested: false, createdAt: null }]);
  api.approvals.mockResolvedValue([]);
});

describe('PraxisTasksView', () => {
  it('shows a finished executor run separately from a failed verification', async () => {
    api.inspect.mockResolvedValue(view({}));
    render(<PraxisTasksView />);
    await userEvent.click(await screen.findByRole('button', { name: /Summarize the release/ }));

    const execution = await screen.findByRole('region', { name: 'Execution' });
    const verification = screen.getByRole('region', { name: 'Verification' });
    expect(within(execution).getByText('Executor finished')).toBeInTheDocument();
    expect(within(verification).getByText('Not approved by verification')).toBeInTheDocument();
    expect(within(verification).getByText('Failed check: tests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish to knowledge base' })).toBeDisabled();
  });

  it('greys out controls the executor does not support and says why', async () => {
    api.inspect.mockResolvedValue(view({ executor: 'claude', state: 'running', finished: false, execution: { status: null, reason: null } }));
    render(<PraxisTasksView />);
    await userEvent.click(await screen.findByRole('button', { name: /Summarize the release/ }));

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancel).toBeDisabled();
    expect(cancel).toHaveAttribute('title', 'The claude executor does not support cancel.');
    expect(screen.getByText('Not verified yet')).toBeInTheDocument();
    expect(api.control).not.toHaveBeenCalled();
  });

  it('keeps one idempotency key for a retried submission and a new one for the next task', async () => {
    api.inspect.mockResolvedValue(view({}));
    api.submit.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ process_id: 'p-2', state: 'pending', duplicate: false });
    render(<PraxisTasksView />);
    await userEvent.type(await screen.findByLabelText('Task'), 'Draft the changelog');
    await userEvent.click(screen.getByRole('button', { name: /Start task/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Start task/ }));

    const [first, second] = api.submit.mock.calls;
    expect(first[1]).toBe(second[1]);
    expect(second[0]).toEqual({ objective: 'Draft the changelog', executor: 'fake', publish: false });
  });

  it('explains when the server has no Praxis connection', async () => {
    api.status.mockResolvedValue({ configured: false, executors: {} });
    render(<PraxisTasksView />);
    expect(await screen.findByText('Praxis is not connected')).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
  });
});
