import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ParaTasksView } from '../ParaTasksView';
import { parsePara } from '../para';

const store = vi.hoisted(() => ({ data: {} as any, persist: vi.fn() }));
vi.mock('../useParaStore', () => ({ useParaStore: () => [store.data, store.persist] }));

beforeEach(() => {
  store.persist.mockReset();
  store.data = parsePara({ tasks: [
    { id: 'a', title: 'Automate intake', status: 'Next', tags: ['device:pi5', 'agentic'] },
    { id: 'b', title: 'Review vault', status: 'Next', tags: ['device:laptop', 'manual'] },
    { id: 'c', title: 'Completed job', status: 'Done', tags: ['completed-only'] },
    { id: 'd', title: 'Old task', archivedAt: '2026-09-01', tags: ['archived-only'] },
    { id: 'e', title: 'Legacy untagged', status: 'Next' },
  ] });
});

describe('PARA task tags', () => {
  it('shows stored tags on rows and searches their text', () => {
    render(<ParaTasksView />);
    expect(screen.getByText('device:pi5')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tasks' }), { target: { value: 'agentic' } });
    expect(screen.getByText('Automate intake')).toBeInTheDocument();
    expect(screen.queryByText('Review vault')).not.toBeInTheDocument();
  });

  it('offers stored tags and filters rows while retaining the status filter', () => {
    render(<ParaTasksView />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by tag' }));
    expect(screen.getByRole('option', { name: 'completed-only' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'archived-only' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'agentic' }));
    expect(screen.getByText('Automate intake')).toBeInTheDocument();
    expect(screen.queryByText('Review vault')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed job')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by tag' }));
    fireEvent.click(screen.getByRole('option', { name: 'All tags' }));
    expect(screen.getByText('Review vault')).toBeInTheDocument();
  });

  it('keeps tags when completing a task', () => {
    render(<ParaTasksView />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Automate intake' }));
    const next = store.persist.mock.calls[0][0](store.data);
    expect(next.tasks[0]).toMatchObject({ status: 'Done', tags: ['device:pi5', 'agentic'] });
  });

  it('shows tags in the task details', () => {
    render(<ParaTasksView />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Automate intake' }));
    expect(within(screen.getByRole('dialog')).getByText('agentic')).toBeInTheDocument();
  });

  it('edits comma-separated tags without losing existing task fields', async () => {
    render(<ParaTasksView />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Automate intake' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'device:pi5, agentic, review, agentic' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    const next = store.persist.mock.calls[0][0](store.data);
    expect(next.tasks[0]).toMatchObject({ title: 'Automate intake', status: 'Next', tags: ['device:pi5', 'agentic', 'review'] });
  });
});
