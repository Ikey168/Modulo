import { useState } from 'react';
import { useParaStore } from '../useParaStore';
import type { WorkspaceViewProps } from '../plugins/types';
import { field, uid, useAction, useToolStore } from '../workspaceTools/shared';
import { ToolPage } from '../workspaceTools/ToolPage';
import { EMPTY_WATCHLISTS, groupStories, matches, validateWatchlists, type Watchlist } from './model';
import { StoryContent, useAwarenessSignals } from './shared';
const terms = (value: string) => [...new Set(value.split(',').map(term => term.trim()).filter(Boolean))];

export default function TopicWatchlistsView({ navigateView }: WorkspaceViewProps) {
  const store = useToolStore('topic-watchlists', EMPTY_WATCHLISTS, validateWatchlists); const action = useAction(); const [para] = useParaStore();
  const { newsletters, signals } = useAwarenessSignals(); const [draft, setDraft] = useState<Watchlist>(); const [keywords, setKeywords] = useState(''); const [excluded, setExcluded] = useState(''); const [selected, setSelected] = useState('');
  const selectedWatch = store.value.items.find(item => item.id === selected);
  const stories = groupStories(signals.filter(signal => selectedWatch ? matches(selectedWatch, signal) : store.value.items.some(watch => matches(watch, signal))));
  const edit = (watch: Watchlist) => { setDraft(watch); setKeywords(watch.terms.join(', ')); setExcluded(watch.exclude.join(', ')); };
  return <ToolPage title="Topic Watchlists" notice={<>{store.notice}{newsletters.notice}</>}>{action.alert}
    <p className="text-sm text-muted-foreground">Match any keyword or phrase across captured feeds, newsletter issues, and detected web changes. Exclusions remove unwanted matches.</p>
    <button className={field} onClick={() => edit({ id: uid(), name: '', terms: [], exclude: [], areaId: '', enabled: true })}>Add watchlist</button>
    {draft && <form className="grid gap-3 border-y border-border py-4" onSubmit={event => { event.preventDefault(); void action.run(async () => { if (!draft.name.trim()) throw new Error('Name this watchlist.'); const next = { ...draft, name: draft.name.trim(), terms: terms(keywords), exclude: terms(excluded) }; await store.save(previous => ({ items: [...previous.items.filter(item => item.id !== next.id), next] })); setSelected(next.id); setDraft(undefined); }); }}>
      <label className="grid gap-1">Name<input className={field} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} required maxLength={1000}/></label>
      <label className="grid gap-1">Keywords or phrases (comma-separated)<input className={field} value={keywords} onChange={e => setKeywords(e.target.value)} required placeholder="climate adaptation, urban gardening"/></label>
      <label className="grid gap-1">Exclude keywords<input className={field} value={excluded} onChange={e => setExcluded(e.target.value)}/></label>
      <label className="grid gap-1">PARA Area<select className={field} value={draft.areaId} onChange={e => setDraft({ ...draft, areaId: e.target.value })}><option value="">No area</option>{para.areas.filter(area => !area.archivedAt || area.id === draft.areaId).map(area => <option key={area.id} value={area.id}>{area.parentId ? `${para.areas.find(parent => parent.id === area.parentId)?.name ?? ''} / ` : ''}{area.name}</option>)}{draft.areaId && !para.areas.some(area => area.id === draft.areaId) && <option value={draft.areaId}>Unavailable area</option>}</select></label>
      <div className="flex gap-2"><button className={field} disabled={!store.ready || action.busy}>Save watchlist</button><button type="button" className={field} onClick={() => setDraft(undefined)}>Cancel</button></div></form>}
    <div className="divide-y divide-border">{store.value.items.map(watch => <article key={watch.id} className="flex flex-wrap items-center gap-3 py-3"><button className="flex-1 text-left" onClick={() => setSelected(watch.id)}><span className="font-medium">{watch.name}</span><span className="block text-xs text-muted-foreground">{watch.terms.join(', ')}{watch.areaId ? ` · ${para.areas.find(area => area.id === watch.areaId)?.name ?? 'Unavailable area'}` : ''} · {watch.enabled ? 'Active' : 'Paused'}</span></button><button className={field} onClick={() => edit(watch)}>Edit</button><button className={field} disabled={!store.ready || action.busy} onClick={() => void action.run(() => store.save(previous => ({ items: previous.items.map(item => item.id === watch.id ? { ...item, enabled: !item.enabled } : item) })))}>{watch.enabled ? 'Pause' : 'Resume'}</button></article>)}</div>
    <section className="space-y-3 border-t border-border pt-4"><div className="flex items-center gap-3"><h2 className="flex-1 font-medium">{selectedWatch ? selectedWatch.name : 'All watchlists'} · {stories.length} matches</h2>{selectedWatch && <button className={field} onClick={() => setSelected('')}>Show all</button>}</div>{stories.map(story => <article key={story.key} className="border-b border-border py-3"><StoryContent story={story} navigateView={navigateView}/></article>)}{!stories.length && <p className="text-sm text-muted-foreground">No matches in the current intake. Add keywords, import newsletters, or sync your sources.</p>}</section>
  </ToolPage>;
}
