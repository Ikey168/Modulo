import { useLifeCollections } from '../useLifeCollection';
import { useMemo } from 'react';
import { useNewsletterStore } from './useNewsletterStore';
import { collectSignals, type Story } from './model';

const SOURCES = ['feeds-reading-inbox', 'web-watch'];
export function useAwarenessSignals() {
  const sources = useLifeCollections(SOURCES);
  const newsletters = useNewsletterStore();
  const signals = useMemo(() => collectSignals(sources['feeds-reading-inbox']?.records ?? [], sources['web-watch']?.records ?? [], newsletters.value.items), [sources, newsletters.value]);
  return { newsletters, signals };
}
export function StoryContent({ story, navigateView }: { story: Story; navigateView: (id: string) => void }) {
  return <div className="min-w-0 flex-1 space-y-2">
    <h2 className="font-medium">{story.title}</h2>
    <p className="text-xs text-muted-foreground">{[...new Set(story.signals.map(signal => signal.source))].join(' · ')}{story.signals.length > 1 ? ` · ${story.signals.length} matching items` : ''}</p>
    <p className="line-clamp-3 whitespace-pre-wrap text-sm">{story.signals[0].body}</p>
    <div className="flex flex-wrap gap-3 text-sm">{story.signals[0].url && <a className="underline" href={story.signals[0].url} target="_blank" rel="noreferrer">Open article</a>}
      {[...new Set(story.signals.map(signal => signal.route))].map(route => <button key={route} className="underline" onClick={() => navigateView(route)}>Open {story.signals.find(signal => signal.route === route)?.source}</button>)}
    </div>
  </div>;
}
