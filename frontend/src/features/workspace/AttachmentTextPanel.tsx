import { useEffect, useState } from 'react';
import type { NotePanelProps } from './plugins/types';
import { attachments, attachmentBlob, type AttachmentInfo } from './workspaceTools/attachments';
import { extractDocument } from './documentExtraction';
import { notesApi } from './workspaceApi';

export function AttachmentTextPanel(props: NotePanelProps) { return <AttachmentTextSurface key={props.note.id} {...props} />; }
function AttachmentTextSurface({ note }: NotePanelProps) {
  const [files, setFiles] = useState<AttachmentInfo[]>([]);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ file: AttachmentInfo; text: string; checksum: string }>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setPreview(undefined); setError(''); setFiles([]); void attachments(note.id).then(items => { if (active) setFiles(items); }).catch(reason => { if (active) setError(String(reason)); }); return () => { active = false; }; }, [note.id]);
  const run = async (work: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <div className="space-y-2 text-sm">{error && <p role="alert">{error}</p>}{files.filter(file => /^(text\/|message\/rfc822|application\/pdf|image\/(png|jpeg|webp))/.test(file.contentType)).map(file => <button key={file.id} className="block underline" disabled={busy} onClick={() => void run(async () => { const extracted = await extractDocument(await attachmentBlob(file), file.originalFilename); setPreview({ file, ...extracted }); })}>Extract text: {file.originalFilename}</button>)}
    {preview && <div className="space-y-2"><label>Review extracted text<textarea aria-label="Extracted attachment text" className="mt-1 w-full rounded border border-border bg-background p-2" rows={8} value={preview.text} onChange={event => setPreview({ ...preview, text: event.target.value })} /></label><button className="underline" disabled={busy} onClick={() => void run(async () => {
      const current = await notesApi.get(note.id);
      if (current.version !== note.version) throw new Error('The note changed. Reopen it before adding extracted text.');
      const marker = `<!-- modulo-attachment:${preview.file.id}:${preview.checksum} -->`;
      const body = current.markdownContent ?? current.content;
      if (!body.includes(marker)) {
        const content = `${body}\n\n${marker}\n\n## ${preview.file.originalFilename.replace(/[\r\n]/g, ' ')}\n\n${preview.text}`;
        await notesApi.update(note.id, { title: current.title, content, markdownContent: content, version: current.version, tagNames: current.tags?.map(tag => tag.name), expectedLocal: { title: current.title, content: current.content, markdownContent: current.markdownContent } });
      }
      window.location.reload();
    })}>Add reviewed text to note</button><p className="text-xs text-muted-foreground">The original attachment stays intact. Added text becomes searchable with this note.</p></div>}
    {!files.length && !error && <p className="text-muted-foreground">Attach a document to extract searchable text.</p>}
  </div>;
}
