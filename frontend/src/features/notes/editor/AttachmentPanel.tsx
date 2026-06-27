import React, { useState, useEffect, useRef, useCallback, DragEvent, ClipboardEvent } from 'react';

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
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Attachments</h4>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            background: 'var(--color-primary, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: uploading ? 0.5 : 1,
          }}
        >
          {uploading ? 'Uploading…' : '+ Attach'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={e => e.target.files && upload(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--color-primary, #3b82f6)' : 'var(--color-border, #d1d5db)'}`,
          borderRadius: '6px',
          padding: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--color-text-secondary, #6b7280)',
          marginBottom: '8px',
          background: isDragOver ? 'var(--color-primary-subtle, #eff6ff)' : 'transparent',
          transition: 'all .15s',
        }}
      >
        {isDragOver ? 'Drop to attach' : 'Drag & drop files here, or paste images'}
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attachments.map(a => (
            <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              {a.isImage ? (
                <img
                  src={a.url}
                  alt={a.originalFilename}
                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                />
              ) : (
                <span style={{ fontSize: '20px', flexShrink: 0 }}>📄</span>
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-primary, #3b82f6)' }}
              >
                {a.originalFilename}
              </a>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0 }}>
                {formatSize(a.fileSize)}
              </span>
              {onInsertMarkdown && a.isImage && (
                <button
                  onClick={() => onInsertMarkdown(`![${a.originalFilename}](${a.url})\n`)}
                  title="Insert into note"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  ↩
                </button>
              )}
              <button
                onClick={() => deleteAttachment(a.id)}
                title="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', flexShrink: 0 }}
              >
                ×
              </button>
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
