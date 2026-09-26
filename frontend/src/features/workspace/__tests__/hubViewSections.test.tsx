import { render, screen, within } from '@testing-library/react';
import { BookOpen, Gamepad2, GraduationCap, Music2, Theater, Tv } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { HubView } from '../plugins/HubView';
import type { ModeInfo } from '../plugins/modes';
import type { ViewContribution, WorkspaceViewProps } from '../plugins/types';

vi.mock('../plugins/PluginProvider', () => ({ usePlugins: () => ({ preferences: undefined }) }));
vi.mock('../mobile/phoneScreen', () => ({ usePhoneScreen: () => false }));

const MEDIA = { id: 'media', label: 'Media', icon: BookOpen, order: 30 } as ModeInfo;
const tab = (id: string, label: string, section: string, icon = BookOpen) =>
  ({ id, label, icon, order: 10, mode: 'media', section, component: () => null }) as unknown as ViewContribution;

function renderHub(tabs: ViewContribution[]) {
  render(<HubView mode={MEDIA} tabs={tabs} activeTab={tabs[0]} viewProps={{} as WorkspaceViewProps} onSelectTab={vi.fn()} />);
  return screen.getByRole('tablist', { name: 'Media views' });
}

describe('HubView section headings', () => {
  it('labels single-tab sections once the hub shows headings, so they do not fall under the previous section', () => {
    const nav = renderHub([
      tab('media-movies', 'Movies', 'Watched', Tv),
      tab('media-tv', 'TV series', 'Watched', Tv),
      tab('media-albums', 'Albums', 'Listened', Music2),
      tab('media-songs', 'Songs', 'Listened', Music2),
      tab('media-video-games', 'Video games', 'Played', Gamepad2),
      tab('media-courses', 'Courses', 'Learned', GraduationCap),
      tab('media-live', 'Live performances', 'Live', Theater),
    ]);
    for (const heading of ['Watched', 'Listened', 'Played', 'Learned', 'Live']) {
      expect(within(nav).getByText(heading)).toBeInTheDocument();
    }
  });

  it('shows no headings in a hub where every section has a single tab', () => {
    const nav = renderHub([tab('a', 'Alpha', 'One'), tab('b', 'Beta', 'Two')]);
    expect(within(nav).queryByText('One')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Two')).not.toBeInTheDocument();
  });
});
