import { useState } from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import NewsletterInboxView from '../NewsletterInboxView';
import DailyBriefingView from '../DailyBriefingView';
import TopicWatchlistsView from '../TopicWatchlistsView';
import type { WorkspaceViewProps } from '../../plugins/types';
import type { Signal } from '../model';
const { records, signals } = vi.hoisted(() => ({ records: {} as Record<string, any>, signals: [] as Signal[] }));
vi.mock('../../workspaceTools/shared', async importOriginal => ({ ...await importOriginal<object>(), useToolStore: (id: string, initial: unknown, validate: (value: unknown) => unknown) => {
  const [, refresh] = useState(0); records[id] ??= initial;
  return { value: records[id], ready: true, notice: null, save: async (update: any) => { records[id] = validate(typeof update === 'function' ? update(records[id]) : update); refresh(value => value + 1); } };
} }));
vi.mock('../GmailConnection', () => ({ GmailConnection: () => null }));
vi.mock('../useNewsletterStore', async () => { const shared = await import('../../workspaceTools/shared'); const model = await import('../model'); return { useNewsletterStore: () => shared.useToolStore('newsletter-inbox', model.EMPTY_NEWSLETTERS, model.validateNewsletters) }; });
vi.mock('../shared', async importOriginal => ({ ...await importOriginal<object>(), useAwarenessSignals: () => ({ signals, newsletters: { notice: null } }) }));
vi.mock('../../useParaStore', () => ({ useParaStore: () => [{ areas: [{ id: 'health', name: 'Health' }] }] }));
const props = { navigateView: vi.fn() } as unknown as WorkspaceViewProps;
beforeEach(() => { for (const id of Object.keys(records)) delete records[id]; signals.length = 0; });
afterEach(cleanup);
describe('Awareness plugin journeys', () => {
  it('captures a pasted newsletter and archives it', async () => {
    render(<NewsletterInboxView />);
    fireEvent.click(screen.getByRole('button', { name: 'Paste newsletter' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Morning issue' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Today in climate research' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add newsletter' }));
    await waitFor(() => expect(screen.getByText('Morning issue')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(records['newsletter-inbox'].items[0].status).toBe('Archived'));
    expect(screen.queryByText('Morning issue')).toBeNull();
  });
  it('dismisses a deduplicated story and can restore it', async () => {
    signals.push({ id: 'f', source: 'Feeds', title: 'One story', body: 'News', url: 'https://example.org/story', date: '2026-09-13', route: 'feeds-reading-inbox' });
    render(<DailyBriefingView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reviewed — dismiss from briefing' }));
    await waitFor(() => expect(screen.queryByText('One story')).toBeNull());
    fireEvent.click(screen.getByLabelText('Include reviewed'));
    expect(screen.getByText('One story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark unreviewed' }));
    await waitFor(() => expect(Object.keys(records['daily-briefing'].reviewed)).toHaveLength(0));
  });
  it('saves a watchlist linked to an Area and finds matching intake', async () => {
    signals.push({ id: 'f', source: 'Feeds', title: 'Sleep research', body: 'Recovery improves', url: '', date: '', route: 'feeds-reading-inbox' });
    render(<TopicWatchlistsView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add watchlist' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Recovery' } });
    fireEvent.change(screen.getByLabelText('Keywords or phrases (comma-separated)'), { target: { value: 'sleep, recovery' } });
    fireEvent.change(screen.getByLabelText('PARA Area'), { target: { value: 'health' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save watchlist' }));
    await waitFor(() => expect(records['topic-watchlists'].items[0]?.areaId).toBe('health'));
    expect(screen.getByText('Sleep research')).toBeTruthy();
  });
});
