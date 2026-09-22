import { useEffect, useRef, useState } from 'react';
import type { WorkspaceViewProps } from '../plugins/types';
import { NotePropertyPanel } from '../../knowledge/NotePropertyPanel';
import { bodyOf, field, now, object, text, useAction, useToolStore } from './shared';
import { ToolPage } from './ToolPage';
import { uploadFile } from './attachments';

interface Capture { noteId: number; kind: string; capturedAt: string; filed: boolean }
interface InboxState { items: Capture[] }
const empty: InboxState = { items: [] };
function validate(value: unknown): InboxState {
  const root = object(value);
  if (!Array.isArray(root.items) || root.items.length > 5000) throw new Error('Invalid inbox.');
  for (const value of root.items) { const item = object(value); text(item.kind, 40); text(item.capturedAt, 100); if (!Number.isSafeInteger(item.noteId) || typeof item.filed !== 'boolean') throw new Error('Invalid capture.'); }
  return value as InboxState;
}
export default function InboxView({ data, onOpenNote }: WorkspaceViewProps) {
  const store = useToolStore('universal-inbox', empty, validate); const action = useAction();
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [selected, setSelected] = useState<number>();
  const [tags, setTags] = useState(''); const [destination, setDestination] = useState(''); const [showFiled, setShowFiled] = useState(false);
  const [recording, setRecording] = useState(false); const recorder = useRef<MediaRecorder>(); const stream = useRef<MediaStream>();
  const [voice, setVoice] = useState<File>();
  const [pendingAttachment, setPendingAttachment] = useState<{ noteId: number; file: File }>();
  useEffect(() => () => { if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); } stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const note = data.notes.find(note => note.id === selected);
  const choose = (id: number) => { setSelected(id); setDestination(''); const note = data.notes.find(n => n.id === id); const source = note ? `${note.title} ${bodyOf(note)}`.toLowerCase() : ''; setTags(data.tags.filter(tag => source.includes(tag.name.toLowerCase())).map(tag => tag.name).join(', ')); };
  const capture = async (file?: File) => {
    if (pendingAttachment) throw new Error('Retry the pending attachment or discard it before capturing another item.');
    if (!title.trim() && !content.trim() && !file) throw new Error('Add text, a URL or a file.');
    if (file && file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.');
    const textual = file && (/\.(md|txt|eml)$/i.test(file.name) || file.type.startsWith('text/'));
    const body = textual ? `${content}${content ? '\n\n' : ''}${await file!.text()}` : content;
    if (body.length > 200000) throw new Error('Text exceeds 200,000 characters. Capture a smaller document.');
    const created = await data.createNote(title.trim() || file?.name || 'Inbox capture', body);
    if (!created) throw new Error('Capture failed. Your input is retained.');
    await store.save(previous => ({ items: [{ noteId: created.id, kind: file ? file.type.startsWith('audio/') ? 'Voice memo' : /\.eml$/i.test(file.name) ? 'Email' : 'File' : /^https?:\/\//.test(content.trim()) ? 'URL' : 'Text', capturedAt: now(), filed: false }, ...previous.items] }));
    setSelected(created.id); setTitle(''); setContent(''); setVoice(undefined); setTags('');
    if (file) { setPendingAttachment({ noteId: created.id, file }); await uploadFile(created.id, file); setPendingAttachment(undefined); }
    await data.refresh();
  };
  return <ToolPage title="Universal Inbox" notice={store.notice}>{action.alert}
    {pendingAttachment && <section className="space-y-2 border-b border-border pb-3" aria-label="Pending attachment"><p>{pendingAttachment.file.name} is retained in this view. Retry the upload before leaving.</p><button className={field} disabled={action.busy} onClick={() => void action.run(async () => { await uploadFile(pendingAttachment.noteId, pendingAttachment.file); setPendingAttachment(undefined); await data.refresh(); })}>Retry pending attachment</button><button className={`${field} ml-2`} disabled={action.busy} onClick={() => { if (window.confirm('Discard the pending attachment? Its draft note is retained.')) setPendingAttachment(undefined); }}>Discard pending attachment</button></section>}
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void action.run(() => capture(voice)); }} onPaste={e => { const file = e.clipboardData.files[0]; if (file && store.ready && !action.busy) { e.preventDefault(); void action.run(() => capture(file)); } }}>
      <fieldset disabled={!store.ready || action.busy} className="space-y-3">
        <label className="block">Title<input className={`${field} block w-full`} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block">Text, URL or email<textarea className={`${field} block w-full`} rows={4} value={content} onChange={e => setContent(e.target.value)} /></label>
        <div className="flex flex-wrap gap-3"><button className={field}>Capture{voice ? ` ${voice.name}` : ''}</button>
          <label className={field}>Capture file<input type="file" className="block max-w-full" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void action.run(() => capture(file)); }} /></label>
          <button type="button" className={field} disabled={!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined'} onClick={() => void action.run(async () => {
            if (recording) { recorder.current?.stop(); setRecording(false); return; }
            stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            try {
              const device = new MediaRecorder(stream.current); recorder.current = device; const chunks: BlobPart[] = [];
              device.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
              device.onstop = () => { setVoice(new File(chunks, `voice-${Date.now()}.${device.mimeType.includes('mp4') ? 'm4a' : 'webm'}`, { type: device.mimeType })); stream.current?.getTracks().forEach(track => track.stop()); setRecording(false); };
              device.start(); setRecording(true);
            } catch (error) { stream.current.getTracks().forEach(track => track.stop()); throw error; }
          })}>{recording ? 'Stop recording' : 'Record voice memo'}</button>
        </div>{voice && <p role="status">Voice memo ready. Choose Capture to upload it.</p>}
      </fieldset>
    </form>
    <p className="text-sm">Files are uploaded to your configured attachment storage. URLs are saved without fetching their contents. Paste an image here or select a file; email capture accepts .eml files.</p>
    <label className="flex gap-2"><input type="checkbox" checked={showFiled} onChange={e => setShowFiled(e.target.checked)} />Show filed captures</label>
    <ul className="divide-y divide-border">{store.value.items.filter(item => showFiled || !item.filed).map(item => <li key={item.noteId} className="py-2"><button className="underline" disabled={action.busy} onClick={() => choose(item.noteId)}>{data.notes.find(n => n.id === item.noteId)?.title ?? `Unavailable note #${item.noteId}`} · {item.kind} · {item.filed ? 'Filed' : 'Needs review'}</button></li>)}</ul>
    {note && <section className="space-y-3 border-t border-border pt-4"><h2 className="font-medium">Review {note.title}</h2><button className="underline" onClick={() => onOpenNote(note.id)}>Open note and attachments</button>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap text-sm">{bodyOf(note)}</pre>
      <fieldset disabled={action.busy || !store.ready} className="space-y-3"><label className="block">Suggested tags — edit before filing<input className={`${field} block w-full`} value={tags} onChange={e => setTags(e.target.value)} /></label>
        <label className="block">Destination tag<input className={`${field} block w-full`} placeholder="projects/example" value={destination} onChange={e => setDestination(e.target.value)} /></label>
        <label className="block">Add or retry attachment<input type="file" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void action.run(() => uploadFile(note.id, file)); }} /></label>
        <button className={field} disabled={!!pendingAttachment} onClick={() => void action.run(async () => { for (const tag of new Set([...tags.split(','), destination].map(t => t.trim()).filter(Boolean))) { if (await data.addTag(note.id, tag) === false) throw new Error('Could not apply tags. Capture remains in the inbox.'); } await store.save(previous => ({ items: previous.items.map(item => item.noteId === note.id ? { ...item, filed: true } : item) })); setSelected(undefined); })}>File capture</button>
      </fieldset>
      <NotePropertyPanel noteId={note.id} content={bodyOf(note)} notes={data.notes} onSaved={() => void data.refresh()} />
    </section>}
  </ToolPage>;
}
