import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreNote } from '@modulo/core';
import { PhoneHome } from '../mobile/PhoneHome';

vi.mock('../../blueprint/blueprintService', () => ({
  listBlueprints: vi.fn(async () => []),
}));
vi.mock('../../executions/runService', () => ({
  getRunSummary: vi.fn(async () => ({ counts: [] })),
}));

const note = (id: number, title: string, updatedAt: string): CoreNote =>
  ({ id, title, content: '', markdownContent: '', tags: [], updatedAt, createdAt: updatedAt }) as unknown as CoreNote;

const NOTES = [
  note(1, 'Older note', '2026-09-01T10:00:00Z'),
  note(2, 'Newest note', '2026-09-11T10:00:00Z'),
];

function renderHome(overrides: Partial<Parameters<typeof PhoneHome>[0]> = {}) {
  const props = {
    notes: NOTES,
    installedPlugins: new Set(['notes-editor']),
    userName: 'Ada Lovelace',
    onOpenNote: vi.fn(),
    onNewNote: vi.fn(),
    onOpenSearch: vi.fn(),
    onOpenBlueprints: vi.fn(),
    onOpenMarketplace: vi.fn(),
    navigateView: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <PhoneHome {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('PhoneHome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('greets the person by their first name', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Ada$/);
  });

  it('states the counts as numbers rather than a sentence of prose', () => {
    renderHome();
    // The desktop dashboard says "…· 2 notes ·…" in a mono paragraph; a thumb
    // cannot tap a clause.
    const notesTile = screen.getByRole('button', { name: /Notes\s*2/ });
    expect(notesTile).toBeInTheDocument();
  });

  it('opens the most recently edited note first', async () => {
    const props = renderHome();
    await userEvent.click(screen.getByRole('button', { name: /Newest note/ }));
    expect(props.onOpenNote).toHaveBeenCalledWith(2);
  });

  it('puts capture and search on the home screen, not behind a menu', async () => {
    const props = renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'New note' }));
    expect(props.onNewNote).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(props.onOpenSearch).toHaveBeenCalled();
  });

  it('offers the first note instead of an empty panel on a new workspace', async () => {
    const props = renderHome({ notes: [] });
    const section = await screen.findByRole('region', { name: 'Jump back in' });
    expect(section).toHaveTextContent(/No notes yet/);
    await userEvent.click(within(section).getByRole('button', { name: /New note/ }));
    expect(props.onNewNote).toHaveBeenCalled();
  });
});
