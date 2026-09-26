import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { ParaGoalsView } from '../ParaGoalsView';
import { EMPTY_PARA, parsePara, type ParaData } from '../para';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const writePara = (data: ParaData) => memory.current.seed('para', 'data', data, 'modulo.workspace.para');
const readPara = (): ParaData => parsePara(memory.current.value('para', 'data') ?? EMPTY_PARA);

beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  vi.stubGlobal('ResizeObserver', class {
    observe() { return undefined; }
    unobserve() { return undefined; }
    disconnect() { return undefined; }
  });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  delete (window.HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  vi.unstubAllGlobals();
});

it('scopes an arc to several subareas without exposing a Project field', async () => {
  writePara(parsePara({
    areas: [
      { id: 'health', name: 'Health', category: 'Life' },
      { id: 'movement', name: 'Movement', category: 'Health', parentId: 'health' },
      { id: 'recovery', name: 'Recovery', category: 'Health', parentId: 'health' },
    ],
    projects: [{ id: 'training', name: 'Training block', status: 'Active', areaIds: ['movement'] }],
    goals: [{ id: 'arc', title: 'Sustainable momentum', status: 'Active', horizon: '2026 Q4' }],
  }));
  const user = userEvent.setup();
  render(<ParaGoalsView />);
  await settle();

  await user.click(screen.getByRole('button', { name: 'Sustainable momentum' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByText('Project')).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
  expect(within(dialog).queryByRole('combobox', { name: 'Project' })).not.toBeInTheDocument();

  await user.click(within(dialog).getByRole('combobox', { name: 'Subareas' }));
  await user.click(screen.getByRole('option', { name: /Movement/ }));
  await user.click(screen.getByRole('option', { name: /Recovery/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await settle();

  expect(readPara().goals[0].areaIds).toEqual(['movement', 'recovery']);
  expect(readPara().goals[0]).not.toHaveProperty('projectIds');
  expect(within(dialog).getByText('Movement, Recovery')).toBeInTheDocument();
});
