import { GmailConnection } from './GmailConnection';
import { useNewsletterStore } from './useNewsletterStore';
import { useState } from 'react';
import { field, useAction, uid, now } from '../workspaceTools/shared';
import { ToolPage } from '../workspaceTools/ToolPage';
import { mergeNewsletters, safeUrl, type Newsletter } from './model';
import { importNewsletter } from './newsletterImport';

export default function NewsletterInboxView() {
  const store = useNewsletterStore(); const action = useAction();
  const [title, setTitle] = useState(''); const [sender, setSender] = useState(''); const [body, setBody] = useState(''); const [url, setUrl] = useState('');
  const [filter, setFilter] = useState('Unread'); const [selected, setSelected] = useState(''); const [showCapture, setShowCapture] = useState(false);
  const visible = store.value.items.filter(item => filter === 'All' || item.status === filter);
  const issue = store.value.items.find(item => item.id === selected);
  const saveStatus = (id: string, status: Newsletter['status']) => action.run(() => store.save(previous => ({ items: previous.items.map(item => item.id === id ? { ...item, status } : item) })));
  return <ToolPage title="Newsletter Inbox" notice={store.notice}>{action.alert}
    <GmailConnection onSynced={store.refresh}/>
    <div className="flex flex-wrap items-center gap-3"><label className={field}>Import email<input type="file" accept=".eml,message/rfc822" multiple className="sr-only" disabled={!store.ready || action.busy} onChange={event => {
      const files = [...(event.target.files ?? [])]; event.target.value = '';
      void action.run(async () => { if (files.length > 20) throw new Error('Import up to 20 emails at a time.'); const incoming: Newsletter[] = []; for (const file of files) { if (file.size > 2000000) throw new Error(`${file.name} exceeds 2 MB.`); incoming.push(await importNewsletter(await file.arrayBuffer(), file.name)); } await store.save(previous => ({ items: mergeNewsletters(previous.items, incoming) })); });
    }} /></label><button className={field} onClick={() => setShowCapture(!showCapture)}>{showCapture ? 'Close capture' : 'Paste newsletter'}</button>
      <label>Show <select className={field} value={filter} onChange={event => setFilter(event.target.value)}>{['Unread', 'Saved', 'Archived', 'All'].map(status => <option key={status}>{status}</option>)}</select></label></div>
    <p className="text-sm text-muted-foreground">Import exported emails or paste an issue below. Imported messages are displayed as text; connect Gmail above for automatic delivery.</p>
    {showCapture && <form className="grid gap-3 border-y border-border py-4" onSubmit={event => { event.preventDefault(); void action.run(async () => {
      if (!title.trim() || !body.trim()) throw new Error('Add a subject and message.'); if (url.trim() && !safeUrl(url.trim())) throw new Error('Use an HTTP or HTTPS article URL.');
      const issue: Newsletter = { id: uid(), title: title.trim(), sender: sender.trim(), body: body.trim(), url: url.trim(), receivedAt: now(), messageId: '', status: 'Unread' };
      await store.save(previous => ({ items: mergeNewsletters(previous.items, [issue]) })); setTitle(''); setSender(''); setBody(''); setUrl(''); setShowCapture(false);
    }); }}><label className="grid gap-1">Subject<input className={field} value={title} onChange={e => setTitle(e.target.value)} required maxLength={1000}/></label>
      <label className="grid gap-1">Sender<input className={field} value={sender} onChange={e => setSender(e.target.value)} maxLength={1000}/></label>
      <label className="grid gap-1">Article URL (optional)<input className={field} type="url" value={url} onChange={e => setUrl(e.target.value)} maxLength={4000}/></label>
      <label className="grid gap-1">Message<textarea className={field} rows={8} value={body} onChange={e => setBody(e.target.value)} required maxLength={200000}/></label>
      <button className={field} disabled={!store.ready || action.busy}>Add newsletter</button></form>}
    <div className="divide-y divide-border">{visible.map(item => <article key={item.id} className="flex flex-wrap items-center gap-3 py-3"><button className="min-w-0 flex-1 text-left" onClick={() => setSelected(item.id)}><span className="block font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{item.sender || 'Unknown sender'} · {new Date(item.receivedAt).toLocaleDateString()}</span></button><button className={field} disabled={!store.ready || action.busy} onClick={() => void saveStatus(item.id, item.status === 'Saved' ? 'Unread' : 'Saved')}>{item.status === 'Saved' ? 'Mark unread' : 'Save'}</button><button className={field} disabled={!store.ready || action.busy} onClick={() => void saveStatus(item.id, item.status === 'Archived' ? 'Unread' : 'Archived')}>{item.status === 'Archived' ? 'Restore' : 'Archive'}</button></article>)}</div>
    {!visible.length && <p className="text-sm text-muted-foreground">No {filter === 'All' ? '' : filter.toLowerCase()} newsletters.</p>}
    {issue && <section className="space-y-3 border-t border-border pt-4"><div className="flex items-center gap-3"><h2 className="flex-1 font-medium">{issue.title}</h2><button className={field} onClick={() => setSelected('')}>Close reader</button></div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{issue.body}</p>{safeUrl(issue.url) && <a className="underline" href={safeUrl(issue.url)} target="_blank" rel="noreferrer">Open article</a>}</section>}
  </ToolPage>;
}
