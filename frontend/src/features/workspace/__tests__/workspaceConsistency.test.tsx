import { MediaLibraryView } from '../MediaLibraryView';
import { mediaLibraryFromRecords } from '../mediaLibraryStore';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { LIFE_COLLECTION_SCHEMA } from '../useLifeCollection';
import { parseLifeCollection, type LifeCollectionData } from '../lifeStore';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '@/ui';
import { dayKey } from '../noteDates';
import { addDays, isoDate, weekOf } from '../planner';
import { createEmptyPara, isoDay, parsePara, type ParaData } from '../para';
import { useParaStore } from '../useParaStore';
import { useLifeCollection, useLifeCollections } from '../useLifeCollection';
import { emptyLifeCollection } from '../lifeStore';
import { newLearningRecord } from '../learningTools';
import { isWorkspaceShortcut } from '../workspaceKeyboard';
import { Field, RecordSheet, SearchInput } from '../viewkit';
import { LifeCollectionView } from '../LifeCollectionView';
import { MemoryRouter } from 'react-router-dom';
import { HOME_MAINTENANCE_CONFIG } from '../lifeConfigs';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });
const readPara = (): ParaData => parsePara(memory.current.value('para', 'data') ?? createEmptyPara());
const readLifeCollection = (id: string): LifeCollectionData => parseLifeCollection(memory.current.value('life-collections', id) ?? emptyLifeCollection());
const writeLifeCollection = (id: string, data: LifeCollectionData) => memory.current.seed('life-collections', id, data, LIFE_COLLECTION_SCHEMA);
const loadMediaLibrary = () => mediaLibraryFromRecords(memory.current.records('media-library')).data;

beforeEach(() => {
  localStorage.clear();
  memory.current = createMemoryWorkspace();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('workspace calendar dates', () => {
  it('uses one local day at both ends of the day', () => {
    for (const hour of [0, 23]) {
      const date = new Date(2026, 8, 5, hour, 45);
      expect(dayKey(date)).toBe('2026-09-05');
      expect(isoDate(date)).toBe(dayKey(date));
      expect(isoDay(date)).toBe(dayKey(date));
    }
  });

  it('keeps date arithmetic stable across DST and year boundaries', () => {
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekOf('2026-03-29')).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ]);
  });
});

describe('shared storage behavior', () => {
  it('refuses edits until the server store is ready and keeps the confirmed value', async () => {
    const next = { ...createEmptyPara(), inbox: [{ id: 'inbox-test', title: 'Capture', detail: '', capturedAt: '2026-09-05', kind: 'Thought' as const }] };
    memory.current.api.workspaceState = () => new Promise(() => {});
    const offline = renderHook(useParaStore);
    act(() => { expect(offline.result.current[1](next)).toBe(false); });
    expect(offline.result.current[0]).toEqual(createEmptyPara());
    offline.unmount();
    memory.current = createMemoryWorkspace();
    const { result } = renderHook(useParaStore);
    await settle();
    act(() => { expect(result.current[1](next)).toBe(true); });
    expect(result.current[0].inbox[0].title).toBe('Capture');
    await settle();
    expect(readPara().inbox[0].title).toBe('Capture');
  });

  it('refreshes specialist and aggregate stores when server records change', async () => {
    const para = renderHook(useParaStore);
    const life = renderHook(() => useLifeCollection('test-consistency'));
    const aggregate = renderHook(() => useLifeCollections(['test-consistency']));
    await settle();
    const next = {
      ...emptyLifeCollection(),
      records: [{ ...newLearningRecord('Active', 'Other'), title: 'Restored item' }],
    };
    await act(async () => {
      const paraState = await memory.current.api.workspaceState('para');
      await paraState.set('data', JSON.parse(JSON.stringify({ ...createEmptyPara(), inbox: [{ id: 'restored', title: 'Restored', detail: '', capturedAt: '2026-09-05', kind: 'Thought' }] })), 'modulo.workspace.para', 1);
      const lifeState = await memory.current.api.workspaceState('life-collections');
      await lifeState.set('test-consistency', JSON.parse(JSON.stringify(next)), LIFE_COLLECTION_SCHEMA, 1);
    });
    await settle();
    expect(para.result.current[0].inbox[0].title).toBe('Restored');
    expect(life.result.current[0].records[0].title).toBe('Restored item');
    expect(aggregate.result.current['test-consistency'].records[0].title).toBe('Restored item');
    expect(readPara().inbox[0].title).toBe('Restored');
  });
});

describe('shared fields and search', () => {
  it('connects a visible label to an existing input ID and preserves its description', () => {
    render(
      <>
        <p id="external-hint">Existing guidance</p>
        <Field label="Name" hint="Additional guidance">
          <Input id="existing-name" aria-describedby="external-hint" />
        </Field>
      </>,
    );
    const field = screen.getByLabelText('Name');
    expect(field).toHaveAttribute('id', 'existing-name');
    expect(field).toHaveAccessibleDescription(
      'Existing guidance Additional guidance',
    );
  });

  it('clears search with Escape or the clear control and keeps keyboard focus', async () => {
    function Search() {
      const [query, setQuery] = useState('missing');
      return (
        <SearchInput value={query} onChange={setQuery} label="Search records" />
      );
    }
    const user = userEvent.setup();
    render(<Search />);
    await user.click(
      screen.getByRole('button', { name: 'Clear Search records' }),
    );
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    await user.type(input, 'query');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });
});

describe('shared record editing', () => {
  const record = { id: 'one', title: 'Original' };
  const fields = (
    draft: typeof record,
    setDraft: (next: typeof record) => void,
  ) => (
    <Field label="Title">
      <Input
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
      />
    </Field>
  );

  it('retains failed drafts and waits for asynchronous saves', async () => {
    const user = userEvent.setup();
    let finish: (value: boolean) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <RecordSheet
        record={record}
        title="Record"
        subtitle="Details"
        onClose={vi.fn()}
        onSave={save}
        renderEdit={fields}
      >
        Original
      </RecordSheet>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Updated');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await act(async () => finish(false));
    expect(screen.getByRole('alert')).toHaveTextContent('draft is still here');
    expect(screen.getByLabelText('Title')).toHaveValue('Updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await act(async () => finish(true));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('does not save a draft when cancelled', async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <RecordSheet
        record={record}
        title="Record"
        subtitle="Details"
        onClose={vi.fn()}
        onSave={save}
        renderEdit={fields}
      >
        Original
      </RecordSheet>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Title')).toHaveValue('Original');
  });
});

describe('collection editing and empty states', () => {
  it('opens the record named by ?record= (reminder notifications, #494)', async () => {
    const user = userEvent.setup();
    const first = render(<MemoryRouter><LifeCollectionView config={HOME_MAINTENANCE_CONFIG} /></MemoryRouter>);
    await settle();
    await user.click(screen.getAllByRole('button', { name: 'Add home item' })[0]);
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Clean gutters');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await settle();
    const id = readLifeCollection(HOME_MAINTENANCE_CONFIG.id).records[0].id;
    first.unmount();

    render(<MemoryRouter initialEntries={[`/app/home?record=${id}`]}><LifeCollectionView config={HOME_MAINTENANCE_CONFIG} /></MemoryRouter>);
    await settle();
    expect(await screen.findByRole('dialog')).toHaveTextContent('Clean gutters');
  });

  it('buffers edits until Save changes and leaves no record when creation is cancelled', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LifeCollectionView config={HOME_MAINTENANCE_CONFIG} /></MemoryRouter>);
    await settle();
    await user.click(
      screen.getAllByRole('button', { name: 'Add home item' })[0],
    );
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Replace filter');
    await settle();
    expect(readLifeCollection(HOME_MAINTENANCE_CONFIG.id).records).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(
      screen.getAllByRole('button', { name: 'Add home item' })[0],
    );
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Replace filter');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await settle();
    expect(readLifeCollection(HOME_MAINTENANCE_CONFIG.id).records[0].title,
    ).toBe('Replace filter');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), ' changed');
    await settle();
    expect(readLifeCollection(HOME_MAINTENANCE_CONFIG.id).records[0].title,
    ).toBe('Replace filter');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      within(screen.getByRole('dialog'))
        .getAllByRole('heading', { name: 'Replace filter' })
        .at(-1),
    ).toBeVisible();
  });

  it('offers a working Clear filters action for an empty search result', async () => {
    writeLifeCollection(HOME_MAINTENANCE_CONFIG.id, {
      ...emptyLifeCollection(),
      records: [{ ...newLearningRecord('Due', 'Chore'), title: 'Filter' }],
    });
    const user = userEvent.setup();
    render(<MemoryRouter><LifeCollectionView config={HOME_MAINTENANCE_CONFIG} /></MemoryRouter>);
    await settle();
    await user.type(screen.getByRole('searchbox'), 'does not exist');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByText('Filter')).toBeVisible();
  });
});

describe('workspace shortcut scope', () => {
  it.each(['input', 'textarea', 'button', 'select'])(
    'leaves %s keyboard input alone',
    (tag) => {
      const element = document.createElement(tag);
      document.body.append(element);
      const handler = vi.fn((event: KeyboardEvent) =>
        isWorkspaceShortcut(event),
      );
      element.addEventListener('keydown', handler);
      fireEvent.keyDown(element, { key: 'Backspace' });
      expect(handler).toHaveLastReturnedWith(false);
      element.remove();
    },
  );

  it('ignores nested dialog controls and composition but accepts canvas shortcuts', () => {
    render(
      <div role="dialog">
        <span data-testid="nested">Dialog text</span>
      </div>,
    );
    const target = screen.getByTestId('nested');
    target.addEventListener('keydown', (event) =>
      expect(isWorkspaceShortcut(event)).toBe(false),
    );
    fireEvent.keyDown(target, { key: 'Delete' });
    expect(
      isWorkspaceShortcut(new KeyboardEvent('keydown', { isComposing: true })),
    ).toBe(false);
    expect(
      isWorkspaceShortcut(new KeyboardEvent('keydown', { key: 'Delete' })),
    ).toBe(true);
  });
});

describe('media editing consistency', () => {
  it('buffers media creation and edits, and cancels without saving', async () => {
    const user = userEvent.setup();
    render(<MediaLibraryView />);
    await settle();
    await user.click(screen.getByRole('button', { name: /^Add$/ }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'The Dispossessed');
    await settle();
    expect(loadMediaLibrary().items).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await settle();
    expect(loadMediaLibrary().items[0].title).toBe('The Dispossessed');
    await user.click(screen.getByRole('button', { name: /^Edit$/ }));
    await user.type(screen.getByLabelText('Title'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(loadMediaLibrary().items[0].title).toBe('The Dispossessed');
  });
});
