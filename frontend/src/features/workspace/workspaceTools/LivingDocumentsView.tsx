import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CoreNote } from '@modulo/core';
import type { WorkspaceViewProps, NoteFenceProps } from '../plugins/types';
import { PropertyQueryResults } from '../../knowledge/PropertyQueryView';
import { queryRequest, type SavedQuery } from '../../knowledge/propertyQueryApi';
import { Markdown } from '../Markdown';
import { bodyOf, field, request, useAction } from './shared';
import { ToolPage } from './ToolPage';

export function LivingQuery({ source }: NoteFenceProps) {
  const id = source.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <p role="alert">Choose a saved property query in Living Documents.</p>;
  return <PropertyQueryResults key={id} id={id} />;
}
export function LivingNote({ source }: NoteFenceProps) {
  const id = source.trim(); const [note, setNote] = useState<CoreNote>(); const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setNote(undefined); setError('');
    if (!/^[1-9]\d*$/.test(id)) { setError('Invalid source note ID.'); return; }
    const refresh = () => { void request<CoreNote>(`/api/notes/${id}`).then(value => { if (active) { setNote(value); setError(''); } }).catch(() => { if (active) { setNote(undefined); setError('Source unavailable or access revoked.'); } }); };
    refresh(); const timer = setInterval(refresh, 15000); window.addEventListener('modulo:properties-changed', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('modulo:properties-changed', refresh); };
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!note) return <p role="status">Loading source…</p>;
  return <section className="my-3 border-l-2 border-border pl-3"><Link className="underline" to={`/app/notes?note=${note.id}`}>{note.title}</Link><Markdown content={bodyOf(note)} notes={[]} onSelectNote={() => {}} fences={[]} /><p className="text-xs text-muted-foreground">Live source · version {note.version ?? 'unknown'}</p></section>;
}
export default function LivingDocumentsView({ data, onOpenNote }: WorkspaceViewProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([]); const [query, setQuery] = useState(''); const [source, setSource] = useState('');
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [loadError, setLoadError] = useState(''); const action = useAction();
  useEffect(() => { let active = true; void queryRequest<SavedQuery[]>('').then(items => { if (active) setQueries(items); }).catch(() => { if (active) setLoadError('Saved queries unavailable. Source-note embeds remain available.'); }); return () => { active = false; }; }, []);
  const append = (language: string, id: string) => setContent(previous => `${previous}${previous ? '\n\n' : ''}\`\`\`${language}\n${id}\n\`\`\`\n`);
  return <ToolPage title="Living Documents">{action.alert}{loadError && <p role="status">{loadError}</p>}
    <p className="text-sm">Embed current records in a note. Source excerpts and saved queries refresh every 15 seconds while the document is open.</p>
    <fieldset disabled={action.busy} className="space-y-3">
      <label className="block">Document title<input className={`${field} block w-full`} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <div className="flex flex-wrap items-end gap-2"><label>Saved query<select aria-label="Saved query" className={`${field} block`} value={query} onChange={e => setQuery(e.target.value)}><option value="">Choose query</option>{queries.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className={field} disabled={!query} onClick={() => append('living-query', query)}>Embed query</button><Link className="underline" to="/app/property-queries">Manage queries</Link></div>
      <div className="flex flex-wrap items-end gap-2"><label>Source note<select aria-label="Source note" className={`${field} block`} value={source} onChange={e => setSource(e.target.value)}><option value="">Choose source</option>{data.notes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button className={field} disabled={!source} onClick={() => append('living-note', source)}>Embed source</button></div>
      <label className="block">Markdown<textarea className={`${field} block w-full font-mono`} rows={10} value={content} onChange={e => setContent(e.target.value)} /></label>
      <button className={field} disabled={!title.trim() || !content.trim()} onClick={() => void action.run(async () => { const note = await data.createNote(title.trim(), content); if (!note) throw new Error('Document could not be saved.'); onOpenNote(note.id); })}>Create living document</button>
    </fieldset>
    <section className="border-t border-border pt-4" aria-label="Document preview"><Markdown content={content} notes={data.notes} onSelectNote={onOpenNote} fences={[{ language: 'living-note', component: LivingNote }, { language: 'living-query', component: LivingQuery }]} /></section>
  </ToolPage>;
}
