import React, { useState, useEffect, useRef, useCallback, DragEvent, ClipboardEvent } from 'react';
import { FileText, CornerDownLeft, X, Paperclip } from 'lucide-react';
import { Button, cn } from '@/ui';

interface AttachmentInfo {
  id: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  url: string;
  isImage: boolean;
}

interface Props {
  noteId: number;
  onInsertMarkdown?: (markdown: string) => void;
}

const ACCEPT = 'image/*,application/pdf,text/plain,text/markdown,.doc,.docx';

const AttachmentPanel: React.FC<Props> = ({ noteId, onInsertMarkdown }) => {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/files`);
      if (res.ok) setAttachments(await res.json());
    } catch {
      // ignore
    }
  }, [noteId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/notes/${noteId}/files`, { method: 'POST', body: fd });
        if (res.ok) {
          const info: AttachmentInfo = await res.json();
          setAttachments(prev => [info, ...prev]);
          if (onInsertMarkdown && info.isImage) {
            onInsertMarkdown(`![${info.originalFilename}](${info.url})\n`);
          }
        }
      }
    } finally {
      setUploading(false);
    }
  }, [noteId, onInsertMarkdown]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length) upload(imageFiles);
  }, [upload]);

  // Expose paste handler to parent via a global listener on the document
  useEffect(() => {
    const handler = (e: Event) => handlePaste(e as unknown as ClipboardEvent<HTMLElement>);
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [handlePaste]);

  const deleteAttachment = async (id: number) => {
    const res = await fetch(`/api/notes/${noteId}/files/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setAttachments(prev => prev.filter(a => a.id !== id));
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="m-0 text-sm font-semibold text-foreground">Attachments</h4>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          size="sm"
          loading={uploading}
        >
          {!uploading && <Paperclip />}
          {uploading ? 'Uploading…' : 'Attach'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={e => e.target.files && upload(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'mb-2 rounded-lg border-2 border-dashed p-3 text-center text-xs transition-colors',
          isDragOver
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border-strong text-muted-foreground',
        )}
      >
        {isDragOver ? 'Drop to attach' : 'Drag & drop files here, or paste images'}
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {attachments.map(a => (
            <li key={a.id} className="flex items-center gap-2 text-[13px]">
              {a.isImage ? (
                <img
                  src={a.url}
                  alt={a.originalFilename}
                  className="size-10 shrink-0 rounded-md border border-border object-cover"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted-foreground">
                  <FileText className="size-5" />
                </span>
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-indigo-400 hover:underline"
              >
                {a.originalFilename}
              </a>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatSize(a.fileSize)}
              </span>
              {onInsertMarkdown && a.isImage && (
                <Button
                  onClick={() => onInsertMarkdown(`![${a.originalFilename}](${a.url})\n`)}
                  title="Insert into note"
                  variant="ghost"
                  size="icon-sm"
                >
                  <CornerDownLeft />
                </Button>
              )}
              <Button
                onClick={() => deleteAttachment(a.id)}
                title="Remove"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default AttachmentPanel;
