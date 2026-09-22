import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceViewProps } from '../plugins/types';
import { field, useAction, useToolStore } from '../workspaceTools/shared';
import { ToolPage } from '../workspaceTools/ToolPage';
import { EMPTY_BRIEFING, EMPTY_WATCHLISTS, groupStories, matches, validateBriefing, validateWatchlists } from './model';
import { StoryContent, useAwarenessSignals } from './shared';

export default function DailyBriefingView({ navigateView }: WorkspaceViewProps) {
  const store = useToolStore('daily-briefing', EMPTY_BRIEFING, validateBriefing); const topics = useToolStore('topic-watchlists', EMPTY_WATCHLISTS, validateWatchlists);
  const { newsletters, signals } = useAwarenessSignals(); const action = useAction();
  const [tick, setTick] = useState(Date.now()); const [onlyMatches, setOnlyMatches] = useState(false); const [showReviewed, setShowReviewed] = useState(false); const [limit, setLimit] = useState(20);
  const day = new Date(tick).toLocaleDateString('en-CA');
  const deadline = store.value.day === day ? store.value.deadline : 0;
  const remaining = Math.max(0, Math.ceil((deadline - tick) / 1000));
  useEffect(() => { const timer = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const grouped = useMemo(() => groupStories(signals), [signals]);
  const stories = grouped.filter(story => (!onlyMatches || story.signals.some(signal => topics.value.items.some(watch => matches(watch, signal)))) && (showReviewed || store.value.reviewed[story.key] !== story.revision));
  return <ToolPage title="Daily Briefing" notice={<>{store.notice}{topics.notice}{newsletters.notice}</>}>{action.alert}
    <div className="flex flex-wrap items-center gap-3"><button className={field} disabled={!store.ready || action.busy || remaining > 0} onClick={() => void action.run(() => store.save(previous => ({ ...previous, day, deadline: Date.now() + 15 * 60 * 1000 })))}>Start 15-minute scan</button>
      {deadline > 0 && <span role="timer" className="text-sm tabular-nums">{remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining` : 'Time is up. Finish this item and stop scanning.'}</span>}
      <span className="text-sm">{stories.length} stories{showReviewed ? '' : ' to review'}</span></div>
    <p className="text-sm text-muted-foreground">Your synchronized feed items, newsletter issues, and detected web changes. Duplicate article URLs and exact titles without URLs are grouped together.</p>
    <div className="flex flex-wrap gap-4 text-sm"><button className="underline" onClick={() => navigateView('feeds-reading-inbox')}>Feeds</button><button className="underline" onClick={() => navigateView('web-watch')}>Web Watch</button><button className="underline" onClick={() => navigateView('newsletter-inbox')}>Newsletter Inbox</button><button className="underline" onClick={() => navigateView('topic-watchlists')}>Manage watchlists</button></div>
    <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" checked={onlyMatches} onChange={event => { setOnlyMatches(event.target.checked); setLimit(20); }}/> Watchlist matches only</label><label><input type="checkbox" checked={showReviewed} onChange={event => { setShowReviewed(event.target.checked); setLimit(20); }}/> Include reviewed</label></div>
    <div className="divide-y divide-border">{stories.slice(0, limit).map(story => {
      const reviewed = store.value.reviewed[story.key] === story.revision;
      const watchNames = topics.value.items.filter(watch => story.signals.some(signal => matches(watch, signal))).map(watch => watch.name);
      return <article key={story.key} className="space-y-3 py-4"><StoryContent story={story} navigateView={navigateView}/>{watchNames.length > 0 && <p className="text-xs text-muted-foreground">Watching: {watchNames.join(', ')}</p>}
        <button className={field} disabled={!store.ready || action.busy} onClick={() => void action.run(() => store.save(previous => { const reviewedItems = { ...previous.reviewed }; if (reviewed) delete reviewedItems[story.key]; else reviewedItems[story.key] = story.revision; return { ...previous, reviewed: reviewedItems }; }))}>{reviewed ? 'Mark unreviewed' : 'Reviewed — dismiss from briefing'}</button>
      </article>;
    })}</div>
    {stories.length > limit && <button className={field} onClick={() => setLimit(limit + 20)}>Show next 20</button>}
    {!stories.length && <p className="text-sm text-muted-foreground">{onlyMatches ? 'No current watchlist matches.' : 'You are caught up with the current intake.'}</p>}
    {Object.keys(store.value.reviewed).length > 0 && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm">Reviewed history</summary><p className="my-2 text-sm">Resetting makes the current stories appear again. Source items are unchanged.</p><button className={field} disabled={!store.ready || action.busy} onClick={() => void action.run(() => store.save(previous => ({ ...previous, reviewed: {} })))}>Reset reviewed history</button></details>}
  </ToolPage>;
}
