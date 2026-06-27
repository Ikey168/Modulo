import React, { useState, useRef, useEffect } from 'react';
import { exportApi } from './exportApi';

interface Props {
  noteId: number;
  noteTitle?: string;
}

const ExportButton: React.FC<Props> = ({ noteId, noteTitle: _noteTitle }) => {
  const [open, setOpen] = useState(false);
  const [resolveLinks, setResolveLinks] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '5px 12px',
          fontSize: '12px',
          background: 'var(--color-surface-raised, #f3f4f6)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        ↓ Export
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: '4px',
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          minWidth: '200px',
          zIndex: 1000,
          padding: '8px 0',
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            fontSize: '12px',
            color: 'var(--color-text-secondary, #6b7280)',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={resolveLinks}
              onChange={e => setResolveLinks(e.target.checked)}
            />
            Resolve [[links]]
          </label>

          <div style={{ borderTop: '1px solid var(--color-border, #e5e7eb)', margin: '4px 0' }} />

          <MenuItem
            icon="📝"
            label="Markdown (.md)"
            onClick={() => {
              exportApi.downloadMarkdown(noteId, resolveLinks);
              setOpen(false);
            }}
          />
          <MenuItem
            icon="🖨️"
            label="Print / PDF"
            description="Opens in browser for printing"
            onClick={() => {
              exportApi.openHtmlForPrint(noteId, resolveLinks);
              setOpen(false);
            }}
          />
          <MenuItem
            icon="🗜️"
            label="This note as ZIP"
            onClick={() => {
              exportApi.downloadZip([noteId], resolveLinks);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{ icon: string; label: string; description?: string; onClick: () => void }> = ({
  icon, label, description, onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      width: '100%',
      padding: '8px 14px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '13px',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised, #f3f4f6)')}
    onMouseLeave={e => (e.currentTarget.style.background = '')}
  >
    <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '1px' }}>{icon}</span>
    <div>
      <div>{label}</div>
      {description && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)' }}>{description}</div>}
    </div>
  </button>
);

export default ExportButton;
