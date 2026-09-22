import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import userEvent from '@testing-library/user-event';
import { ParaAreasView } from '../ParaCoreViews';
import { EMPTY_PARA, parsePara, type ParaData } from '../para';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const writePara = (data: ParaData) => memory.current.seed('para', 'data', data, 'modulo.workspace.para');
const readPara = (): ParaData => parsePara(memory.current.value('para', 'data') ?? EMPTY_PARA);

beforeEach(() => { localStorage.clear(); memory.current = createMemoryWorkspace(); });

it('shows every active project assigned to an area or its subareas', async () => {
  writePara(parsePara({
    areas: [
      { id: 'health', name: 'Health', category: 'Life' },
      { id: 'fitness', name: 'Fitness', category: 'Health', parentId: 'health' },
      { id: 'money', name: 'Money', category: 'Life' },
    ],
    projects: [
      { id: 'direct', name: 'Book checkup', areaIds: ['health'] },
      { id: 'child', name: 'Run a 10K', areaIds: ['fitness', 'money'] },
      { id: 'unrelated', name: 'File taxes', areaIds: ['money'] },
      { id: 'archived', name: 'Old training plan', areaIds: ['fitness'], archivedAt: '2026-09-01' },
    ],
  }));
  const user = userEvent.setup();
  render(<ParaAreasView />);
  await settle();

  await user.click(screen.getByRole('button', { name: /Health Life · 1 subarea/ }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'Projects (2)' })).toBeInTheDocument();
  expect(within(dialog).getByText('Book checkup')).toBeInTheDocument();
  expect(within(dialog).getByText('Run a 10K')).toBeInTheDocument();
  expect(within(dialog).queryByText('File taxes')).not.toBeInTheDocument();
  expect(within(dialog).queryByText('Old training plan')).not.toBeInTheDocument();

  await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
  await user.click(screen.getByRole('button', { name: 'Expand subareas of Health' }));
  await user.click(screen.getByRole('button', { name: 'Open Fitness' }));
  const subareaDialog = await screen.findByRole('dialog');
  expect(within(subareaDialog).getByRole('heading', { name: 'Projects (1)' })).toBeInTheDocument();
  expect(within(subareaDialog).getByText('Run a 10K')).toBeInTheDocument();
  expect(within(subareaDialog).queryByText('Book checkup')).not.toBeInTheDocument();
});

it('edits an existing area and keeps the changes after reopening it', async () => {
  writePara(parsePara({ areas: [{ id: 'health', name: 'Health', category: 'Life', vision: 'Keep well' }] }));
  const user = userEvent.setup();
  render(<ParaAreasView />);
  await settle();

  await user.click(screen.getByRole('button', { name: /Health Life · 0 subareas/ }));
  const dialog = await screen.findByRole('dialog');
  dialog.scrollTop = 500;
  await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
  expect(dialog.scrollTop).toBe(0);
  const name = within(dialog).getByRole('textbox', { name: 'Name' });
  await user.clear(name);
  await user.type(name, 'Health & Fitness');
  await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

  await settle();

  expect(readPara().areas[0].name).toBe('Health & Fitness');
  expect(within(dialog).getByRole('heading', { name: /Health & Fitness/ })).toBeInTheDocument();
  await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
  await user.click(screen.getByRole('button', { name: /Health & Fitness Life · 0 subareas/ }));
  expect(within(await screen.findByRole('dialog')).getByText('Keep well')).toBeInTheDocument();
});

it('shows subarea health checklists and persists checked and custom requirements', async () => {
  writePara(parsePara({ areas: [
    { id: 'health', name: 'Health', category: 'Life' },
    { id: 'movement', name: 'Movement', category: 'Life', parentId: 'health' },
  ] }));
  const user = userEvent.setup();
  render(<ParaAreasView />);
  await settle();
  await user.click(screen.getByRole('button', { name: 'Expand subareas of Health' }));
  await user.click(screen.getByRole('button', { name: 'Open Movement' }));
  let dialog = await screen.findByRole('dialog');
  for (const health of ['Rebuilding', 'Messy', 'Growing', 'Under Control']) {
    expect(within(dialog).getByRole('heading', { name: health })).toBeInTheDocument();
  }
  const baseline = within(dialog).getByRole('checkbox', { name: 'Rebuilding: Start with a manageable movement session.' });
  await user.click(baseline);
  await user.type(within(dialog).getByRole('textbox', { name: 'New Under Control requirement' }), 'Move three times a week');
  await user.click(within(dialog).getAllByRole('button', { name: 'Add' })[3]);
  await settle();
  expect(readPara().areas.find((area) => area.id === 'movement')?.requirements?.Rebuilding?.[0].done).toBe(true);
  await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
  await user.click(screen.getByRole('button', { name: 'Open Movement' }));
  dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('checkbox', { name: 'Rebuilding: Start with a manageable movement session.' })).toBeChecked();
  expect(within(dialog).getByRole('checkbox', { name: 'Under Control: Move three times a week' })).toBeInTheDocument();
  await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0]);
  await user.click(screen.getByRole('button', { name: /Health Life · 1 subarea/ }));
  expect(within(await screen.findByRole('dialog')).getByRole('checkbox', { name: /Rebuilding: Identify the main obstacle to health/ })).toBeInTheDocument();
});
