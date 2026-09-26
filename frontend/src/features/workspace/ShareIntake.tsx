import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Share2 } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, useToast } from '@/ui';
import { deviceDocuments } from '../../services/deviceDocuments';
import { importShare, nativeShareBridge, sharedNote, ATTACHMENT_LIMIT, type SharedItem } from '../../services/androidShare';
import type { WorkspaceData } from './useCoreWorkspace';
import { uploadFile } from './workspaceTools/attachments';

const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Share-to-Modulo on Android (#493): text, links, images and documents shared
 * from another app wait here until the user saves them as a note (files become
 * its attachments) or discards them. Nothing is marked done until every file
 * reached the server, so a failed upload keeps the share for a retry.
 */
export function ShareIntake({ data, onOpenNote }: { data: WorkspaceData; onOpenNote: (id: number) => void }) {
  const bridge = nativeShareBridge();
  const { toast } = useToast();
  const [shares, setShares] = useState<SharedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const notes = useRef(data);
  notes.current = data;

  const load = useCallback(() => {
    void bridge?.pending().then(result => setShares(result.shares), () => {
      toast({ variant: 'destructive', title: 'Shared items are unavailable', description: 'Reopen Modulo to try again.' });
    });
  }, [bridge, toast]);

  useEffect(() => {
    if (!bridge) return;
    load();
    const handles = [
      bridge.addListener('shareReceived', load),
      bridge.addListener('shareFailed', event => toast({ variant: 'destructive', title: 'Share not saved', description: event.message })),
    ];
    return () => { for (const handle of handles) void handle.then(h => h.remove()); };
  }, [bridge, load, toast]);

  const share = shares[0];
  if (!bridge || !share) return null;
  const preview = sharedNote(share);

  const save = async () => {
    setBusy(true); setFailed([]);
    try {
      const result = await importShare(share, {
        bridge, documents: deviceDocuments(),
        findNote: async marker => {
          await notes.current.refresh();
          return notes.current.notes.find(note => (note.markdownContent ?? note.content ?? '').includes(marker))?.id;
        },
        createNote: async (title, content) => {
          const note = await notes.current.createNote(title, content);
          if (!note) throw new Error('The note could not be created. Check the connection and retry.');
          return note.id;
        },
        upload: uploadFile,
      });
      if (result.failed.length) { setFailed(result.failed); return; }
      setShares(current => current.slice(1));
      toast({ title: 'Saved to Modulo', description: preview.title });
      onOpenNote(result.noteId);
    } catch (error) {
      setFailed([error instanceof Error ? error.message : 'The shared item could not be saved.']);
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    setBusy(true);
    try { await bridge.complete({ id: share.id }); setShares(current => current.slice(1)); setFailed([]); }
    finally { setBusy(false); }
  };

  return <Sheet open onOpenChange={open => { if (!open && !busy) setShares(current => current.slice(1)); }}>
    <SheetContent side="bottom" className="max-h-[85%] overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><Share2 className="size-4" aria-hidden="true" />Save shared item</SheetTitle>
        <SheetDescription>{shares.length > 1 ? `${shares.length} shared items are waiting.` : 'Shared from another app.'}</SheetDescription>
      </SheetHeader>
      <div className="space-y-3 px-4 pb-4">
        <p className="font-medium">{preview.title}</p>
        {share.text && <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-muted-foreground">{share.text}</p>}
        {share.files.length > 0 && <ul className="space-y-1 text-sm" aria-label="Shared files">
          {share.files.map(file => <li key={file.name} className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <span className={file.size > ATTACHMENT_LIMIT ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {file.size > ATTACHMENT_LIMIT ? 'over 10 MB, not attached' : size(file.size)}
            </span>
          </li>)}
        </ul>}
        {share.skipped.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground" aria-label="Not kept">
          {share.skipped.map(reason => <li key={reason}>{reason}</li>)}
        </ul>}
        {failed.length > 0 && <div role="alert" className="rounded-md border border-destructive/40 p-2 text-sm text-destructive">
          <p>Not everything reached the server. The share stays here; retry when you are online.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{failed.map(item => <li key={item}>{item}</li>)}</ul>
        </div>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : failed.length ? 'Retry' : 'Save as note'}</Button>
          <Button variant="outline" onClick={() => void discard()} disabled={busy}>Discard</Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>;
}
