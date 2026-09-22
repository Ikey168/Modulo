import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookOpen, FileText, Tags, Waypoints, type LucideIcon } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { HubViewPicker } from '../mobile/HubViewPicker';
import type { ModeInfo } from '../plugins/modes';
import type { ViewContribution } from '../plugins/types';

const MODE = { id: 'knowledge', label: 'Knowledge', icon: BookOpen, order: 20 } as ModeInfo;

const view = (id: string, label: string, icon: LucideIcon, section?: string): ViewContribution =>
  ({
    id,
    label,
    icon,
    order: 10,
    mode: 'knowledge',
    section,
    component: () => null,
  }) as unknown as ViewContribution;

const TABS = [
  view('notes', 'Notes', FileText),
  view('graph', 'Graph', Waypoints),
  view('tags', 'Tags', Tags),
  view('reading', 'Reading Annotations', BookOpen),
];

function renderPicker(tabs = TABS, activeId = 'notes') {
  const onSelectTab = vi.fn();
  render(
    <HubViewPicker
      mode={MODE}
      tabs={tabs}
      activeTab={tabs.find((tab) => tab.id === activeId)!}
      onSelectTab={onSelectTab}
    />,
  );
  return onSelectTab;
}

describe('HubViewPicker', () => {
  it('names the open view in full instead of clipping it in a strip', () => {
    renderPicker(TABS, 'reading');
    // The strip this replaced showed "Reading Ann…" and only if you swiped to it.
    expect(screen.getByRole('button', { name: /Reading Annotations/ })).toBeInTheDocument();
  });

  it('opens the complete list and reports how many views the hub has', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));

    const list = screen.getByRole('listbox', { name: 'Knowledge views' });
    expect(within(list).getAllByRole('option')).toHaveLength(4);
    expect(screen.getByText('4 views')).toBeInTheDocument();
  });

  it('marks the open view as selected', async () => {
    renderPicker(TABS, 'tags');
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));

    const list = screen.getByRole('listbox', { name: 'Knowledge views' });
    expect(within(list).getByRole('option', { name: /Tags/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByRole('option', { name: /Graph/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('selects a view in two taps and closes', async () => {
    const onSelectTab = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));
    await userEvent.click(screen.getByRole('option', { name: /Graph/ }));

    expect(onSelectTab).toHaveBeenCalledWith('graph');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('offers a filter only once the list outgrows a screen', async () => {
    renderPicker();
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));
    expect(screen.queryByRole('textbox', { name: /Filter Knowledge views/ })).not.toBeInTheDocument();
  });

  it('filters a large hub down by name', async () => {
    const many = [
      ...TABS,
      ...Array.from({ length: 8 }, (_, i) => view(`extra-${i}`, `Extra ${i}`, FileText)),
    ];
    renderPicker(many);
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));

    const filter = screen.getByRole('textbox', { name: 'Filter Knowledge views' });
    await userEvent.type(filter, 'grap');

    const list = screen.getByRole('listbox', { name: 'Knowledge views' });
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    expect(within(list).getByRole('option', { name: /Graph/ })).toBeInTheDocument();
  });

  it('says so when nothing matches instead of showing an empty sheet', async () => {
    const many = [...TABS, ...Array.from({ length: 8 }, (_, i) => view(`x-${i}`, `Extra ${i}`, FileText))];
    renderPicker(many);
    await userEvent.click(screen.getByRole('button', { name: /choose a Knowledge view/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter Knowledge views' }), 'zzzz');

    expect(screen.getByText(/No view matches/)).toBeInTheDocument();
  });
});
