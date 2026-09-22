import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryWorkspace } from '../../../__tests__/helpers/memoryWorkspaceState';
import { filterByTags, tagCounts, type MediaItem } from '../mediaLibrary';
import { MEDIA_ITEM_SCHEMA } from '../mediaLibraryStore';
import { MediaLibraryView } from '../MediaLibraryView';

const memory = vi.hoisted(() => ({ current: undefined as unknown as ReturnType<typeof createMemoryWorkspace> }));
vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => memory.current.api }));
vi.mock('../useParaStore', () => ({ useParaStore: () => [{ projects: [], areas: [] }, () => true] }));
vi.mock('../useLifeOsRelations', () => ({ useRemoveLifeOsRelations: () => () => undefined }));

const game = (id: string, title: string, tags: string[]): MediaItem => ({
  id, title, type: 'Video game', status: 'Backlog', currentProgress: 0, totalProgress: 0,
  progressUnit: 'percent', rating: 0, favorite: false, tags,
});
const items = [
  game('g1', 'Doom', ['to play', '1990s', 'shooter']),
  game('g2', 'Myst', ['to know', '1990s']),
  game('g3', 'Tetris', ['to play', '1980s', 'puzzle']),
];
const settle = () => act(async () => { await memory.current.flush(); await new Promise((resolve) => setTimeout(resolve, 0)); });

describe('tag helpers', () => {
  it('requires every selected tag, case-insensitively', () => {
    expect(filterByTags(items, ['TO PLAY']).map((i) => i.id)).toEqual(['g1', 'g3']);
    expect(filterByTags(items, ['to play', '1990s']).map((i) => i.id)).toEqual(['g1']);
    expect(filterByTags(items, [])).toHaveLength(3);
  });
  it('counts tags most-common first, then alphabetically', () => {
    expect(tagCounts(items).slice(0, 2)).toEqual([{ tag: '1990s', count: 2 }, { tag: 'to play', count: 2 }]);
    expect(tagCounts([game('x', 'X', ['a', 'a'])])).toEqual([{ tag: 'a', count: 1 }]);
  });
});

describe('media tag sidebar', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    memory.current = createMemoryWorkspace();
    items.forEach((item, index) => memory.current.seed('media-library', item.id, { position: index + 1, item }, MEDIA_ITEM_SCHEMA));
  });

  it('filters by one or more tags and updates counts', async () => {
    render(<MediaLibraryView mediaType="Video game" title="Video games" />);
    await settle();
    const sidebar = screen.getByRole('complementary', { name: 'Filter by tags' });
    expect(within(sidebar).getByRole('button', { name: 'Filter by tag to play (2)' })).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Filter by tag to play (2)' }));
    expect(screen.getAllByText('Doom').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tetris').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Myst')).toHaveLength(0);
    expect(screen.getByText('2 of 3')).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Filter by tag 1990s (1)' }));
    expect(screen.getAllByText('Doom').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Tetris')).toHaveLength(0);

    fireEvent.click(within(sidebar).getByRole('button', { name: 'Remove tag 1990s' }));
    expect(screen.getAllByText('Tetris').length).toBeGreaterThan(0);
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Clear' }));
    expect(screen.getAllByText('Myst').length).toBeGreaterThan(0);
  });

  it('can be hidden and shown from the toolbar', async () => {
    render(<MediaLibraryView mediaType="Video game" title="Video games" />);
    await settle();
    const toggle = screen.getByRole('button', { name: /Tags/ , pressed: true });
    fireEvent.click(toggle);
    expect(screen.getByRole('complementary', { hidden: true, name: 'Filter by tags' })).toHaveClass('hidden');
    fireEvent.click(toggle);
    expect(screen.getByRole('complementary', { name: 'Filter by tags' })).toHaveClass('flex');
  });
});
