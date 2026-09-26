import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { ParaTasksView } from '../ParaTasksView';
import { parsePara, type ParaData } from '../para';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));

const settle = () => act(async () => {
  await memory.current.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
const writePara = (data: ParaData) => memory.current.seed('para', 'data', data, 'modulo.workspace.para');

beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it('filters PARA tasks by device tag and scopes status counts to the tag', async () => {
  writePara(parsePara({
    tasks: [
      { id: 'desktop', title: 'Desktop action', status: 'Next', priority: 'P2', energy: 'Medium', tags: ['device:desktop'] },
      { id: 'pi', title: 'Pi action', status: 'Next', priority: 'P2', energy: 'Medium', tags: ['device:pi5'] },
      { id: 'both', title: 'Shared action', status: 'Next', priority: 'P2', energy: 'Medium', tags: ['device:desktop', 'device:pi5'] },
    ],
  }));
  const user = userEvent.setup();
  render(<ParaTasksView />);
  await settle();

  const tagFilters = screen.getByRole('group', { name: 'Filter by tag' });
  expect(within(tagFilters).getByRole('button', { name: 'Pi 5 2' })).toBeInTheDocument();
  expect(screen.getByText('Desktop action')).toBeInTheDocument();
  expect(screen.getByText('Pi action')).toBeInTheDocument();
  expect(screen.getByText('Shared action')).toBeInTheDocument();

  await user.click(within(tagFilters).getByRole('button', { name: 'Pi 5 2' }));

  expect(screen.queryByText('Desktop action')).not.toBeInTheDocument();
  expect(screen.getByText('Pi action')).toBeInTheDocument();
  expect(screen.getByText('Shared action')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Filter tasks' })).getByRole('button', { name: 'Open 2' })).toBeInTheDocument();
});

it('writes PARA/Desktop edits back to the server-backed workspace record', async () => {
  writePara(parsePara({
    tasks: [
      { id: 'desktop', title: 'Desktop action', status: 'Next', priority: 'P2', energy: 'Medium', tags: ['device:desktop'] },
    ],
  }));
  const user = userEvent.setup();
  render(<ParaTasksView />);
  await settle();

  await user.click(screen.getByRole('checkbox', { name: 'Complete Desktop action' }));
  await settle();

  expect(parsePara(memory.current.value('para', 'data')).tasks[0]).toMatchObject({
    id: 'desktop',
    status: 'Done',
    tags: ['device:desktop'],
  });
});
