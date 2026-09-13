import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NoesisIntakeView } from '../NoesisIntakeView';

const mock = vi.hoisted(() => ({
  call: vi.fn(),
  preflight: vi.fn(),
  set: vi.fn(),
  state: vi.fn(),
}));
vi.mock('../noesisIntakeApi', () => ({ intakeCall: mock.call, intakePreflight: mock.preflight }));
vi.mock('../../PluginProvider', () => ({ usePlugins: () => ({ state: mock.state }) }));
vi.mock('../../usePluginState', () => ({
  usePluginState: () => ({
    value: { namespace: 'research' }, ready: true, set: mock.set,
    error: undefined,
  }),
}));

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  window.localStorage.clear();
  mock.call.mockReset(); mock.preflight.mockReset(); mock.set.mockReset(); mock.state.mockReset();
  mock.preflight.mockResolvedValue({ available: true });
  mock.set.mockResolvedValue(undefined);
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'list_intake_feed_inbox') return {
      remaining_unprocessed: 1,
      items: [{ item_id: 'feed:one', title: 'A source', original_url: 'https://example.org/a',
        source_version: 2, decision: null, read_at_ms: null }],
    };
    if (tool === 'start_awareness_from_inbox') return {
      session_id: 'intake:today', mode: 'Awareness', status: 'active', revision: 1,
      duration_minutes: 15, inputs: { feed_item_ids: ['feed:one'] }, data: {},
    };
    if (tool === 'triage_awareness_item') return {
      session_id: 'intake:today', mode: 'Awareness', status: 'active', revision: 2,
      duration_minutes: 15, inputs: { feed_item_ids: ['feed:one'] },
      data: { decisions: { 'feed:one': 'discard' } },
    };
    return {};
  });
});

it('previews and imports browser-local Modulo intake without deleting it', async () => {
  const raw = JSON.stringify({ version: 1, items: [{ id: 'old-1', title: 'Saved locally' }] });
  window.localStorage.setItem('modulo-information-intake-v1', raw);
  const records = new Map<string, { key: string; value: Record<string, unknown>; pending: boolean; deleted: boolean }>();
  const client = {
    get: (key: string) => records.get(key),
    refreshAll: vi.fn(async () => undefined),
    create: vi.fn(async (key: string, value: Record<string, unknown>) => {
      records.set(key, { key, value, pending: true, deleted: false });
    }),
    set: vi.fn(),
    delete: vi.fn(async (key: string) => {
      const record = records.get(key);
      if (record) records.set(key, { ...record, value: null as unknown as Record<string, unknown>,
        pending: true, deleted: true });
    }),
    synchronize: vi.fn(async () => {
      for (const record of records.values()) record.pending = false;
    }),
  };
  mock.state.mockResolvedValue(client);
  render(<NoesisIntakeView />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview local intake' }));
  expect(await screen.findByText('1 records · 1 to add · 0 already present')).toBeInTheDocument();
  expect(client.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import into plugin state' }));
  await waitFor(() => expect(client.create).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/1 confirmed, 0 queued, 0 conflicts/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Undo unchanged import' }));
  await waitFor(() => expect(client.delete).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/Undo queued 0 deletions/)).toBeInTheDocument();
  expect(window.localStorage.getItem('modulo-information-intake-v1')).toBe(raw);
});

it('persists a Modulo item link before promoting an escalated source', async () => {
  let stored: { value: Record<string, unknown>; pending: boolean; deleted: boolean } | undefined;
  const client = {
    get: vi.fn(() => stored),
    create: vi.fn(async (_key: string, value: Record<string, unknown>) => {
      stored = { value, pending: true, deleted: false };
    }),
    set: vi.fn(),
    synchronize: vi.fn(async () => { if (stored) stored.pending = false; }),
  };
  mock.state.mockResolvedValue(client);
  mock.call.mockImplementation(async (tool: string) => {
    if (tool === 'list_intake_feed_inbox') return {
      remaining_unprocessed: 1,
      items: [{ item_id: `feed:${'a'.repeat(32)}`, title: 'Escalated source',
        original_url: 'https://example.org/a', source_version: 2,
        decision: 'escalate', read_at_ms: null }],
    };
    if (tool === 'start_awareness_from_inbox') return {
      session_id: 'intake:today', mode: 'Awareness', status: 'active', revision: 2,
      duration_minutes: 15, inputs: { feed_item_ids: [`feed:${'a'.repeat(32)}`] },
      data: { decisions: { [`feed:${'a'.repeat(32)}`]: 'escalate' } },
    };
    if (tool === 'promote_awareness_item') return {
      session_id: 'intake:explore', mode: 'Exploration', status: 'active', revision: 1,
      duration_minutes: 90, inputs: {}, data: {},
    };
    return {};
  });
  render(<NoesisIntakeView />);
  await screen.findByText('Escalated source');
  fireEvent.click(screen.getByRole('button', { name: 'Start daily triage' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Explore this item' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('promote_awareness_item',
    expect.objectContaining({ workspace_links: [{
      system: 'modulo', workspace_id: 'personal', kind: 'intake_item',
      id: `item.${'a'.repeat(32)}`, version: 1,
    }] })));
  expect(client.create).toHaveBeenCalled();
  expect(client.synchronize).toHaveBeenCalled();
});

it('starts a durable daily queue and triages through the Noesis session', async () => {
  render(<NoesisIntakeView />);
  expect(await screen.findByText('A source')).toHaveAttribute('href', 'https://example.org/a');
  fireEvent.click(screen.getByRole('button', { name: 'Start daily triage' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_awareness_from_inbox',
    expect.objectContaining({ namespace: 'research', request_key: expect.stringMatching(/^modulo-awareness-/) })));
  await waitFor(() => expect(mock.set).toHaveBeenCalledWith(
    expect.objectContaining({ lastSessionId: 'intake:today' })));
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('triage_awareness_item',
    expect.objectContaining({ session_id: 'intake:today', item_id: 'feed:one', decision: 'discard' })));
  expect(mock.call).not.toHaveBeenCalledWith('decide_intake_feed_item', expect.anything());
});

it('runs Exploration capture, related reading, and follow from the plugin', async () => {
  let notesSaved = false;
  const visit = { source_id: `explore:${'a'.repeat(32)}`, url: 'https://example.org/climate',
    title: 'Climate adaptation', version: 1, saved: true, note: 'Interesting' };
  const suggestion = { suggestion_id: `explore-related:${'b'.repeat(32)}`, method: 'lexical_overlap_v1',
    cross_domain: true, shared_terms: ['climate', 'adaptation'],
    anchor: { title: visit.title, reference: { kind: 'exploration_source', id: visit.source_id,
      namespace: 'research', version: 1, locator: { url: visit.url } } },
    candidate: { source_id: `explore:${'c'.repeat(32)}`, title: 'Adaptation methods',
      url: 'https://example.net/adaptation', reference: { kind: 'exploration_source',
        id: `explore:${'c'.repeat(32)}`, namespace: 'research', version: 1,
        locator: { url: 'https://example.net/adaptation' } } },
  };
  mock.call.mockImplementation(async (tool: string, args?: { mode?: string }) => {
    if (tool === 'list_intake_feed_inbox') return { remaining_unprocessed: 0, items: [] };
    if (tool === 'start_intake_mode' && args?.mode === 'Deep Research') return {
      session_id: 'intake:research', mode: 'Deep Research', status: 'active', revision: 1,
      duration_minutes: 120, inputs: {}, data: {},
    };
    if (tool === 'start_intake_mode') return { session_id: 'intake:explore', mode: 'Exploration',
      status: 'active', revision: 1, duration_minutes: 90, remaining_minutes: 90,
      inputs: {}, data: {}, unmet_completion_checks: ['timebox_or_escalation'] };
    if (tool === 'capture_exploration_page') return { session_id: 'intake:explore', mode: 'Exploration',
      status: 'active', revision: 2, duration_minutes: 90, remaining_minutes: 88,
      inputs: {}, data: { trail: [visit] }, unmet_completion_checks: ['timebox_or_escalation'] };
    if (tool === 'suggest_exploration_sources') return { suggestions: [suggestion] };
    if (tool === 'inspect_exploration_source') return { version: 1,
      annotations: notesSaved ? [{ body: 'Check the method', source_version: 1 }] : [] };
    if (tool === 'annotate_exploration_source') { notesSaved = true; return {}; }
    if (tool === 'decide_exploration_suggestion') return { session_id: 'intake:explore', mode: 'Exploration',
      status: 'active', revision: 3, duration_minutes: 90, remaining_minutes: 87,
      inputs: {}, data: { trail: [visit, { ...visit, source_id: suggestion.candidate.source_id,
        title: suggestion.candidate.title, url: suggestion.candidate.url }] },
      unmet_completion_checks: ['timebox_or_escalation'] };
    return {};
  });
  render(<NoesisIntakeView />);
  fireEvent.click(screen.getByRole('button', { name: 'Start Exploration' }));
  expect(await screen.findByText('Exploration trail')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: visit.url } });
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: visit.title } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to trail' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('capture_exploration_page',
    expect.objectContaining({ url: visit.url, expected_revision: 1 })));
  expect(await screen.findByText('Climate adaptation')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Follow and save' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('decide_exploration_suggestion',
    expect.objectContaining({ suggestion_id: suggestion.suggestion_id,
      decision: 'follow', expected_revision: 2, expected_candidate_version: 1 })));
  fireEvent.click(screen.getAllByRole('button', { name: 'Notes' })[1]);
  fireEvent.change(await screen.findByLabelText('Add a source note'),
    { target: { value: 'Check the method' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('annotate_exploration_source',
    expect.objectContaining({ source_id: visit.source_id, body: 'Check the method' })));
  fireEvent.click(screen.getAllByRole('button', { name: 'Research this source' })[1]);
  await waitFor(() => expect(mock.call).toHaveBeenCalledWith('start_intake_mode',
    expect.objectContaining({ mode: 'Deep Research', origin: { session_id: 'intake:explore',
      reason: 'Saved Exploration source selected for research' },
    references: [expect.objectContaining({ id: visit.source_id, version: 1 })] })));
});
