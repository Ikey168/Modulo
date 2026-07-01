import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Printer, FileArchive } from 'lucide-react';
import { Button } from '@/ui';
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
    <div ref={ref} className="relative inline-block">
      <Button onClick={() => setOpen(o => !o)} variant="secondary" size="sm">
        <Download />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] animate-fade-up rounded-lg border border-border-strong bg-popover py-2 text-popover-foreground shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 px-3.5 py-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={resolveLinks}
              onChange={e => setResolveLinks(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Resolve [[links]]
          </label>

          <div className="my-1 border-t border-border" />

          <MenuItem
            icon={<FileText />}
            label="Markdown (.md)"
            onClick={() => {
              exportApi.downloadMarkdown(noteId, resolveLinks);
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<Printer />}
            label="Print / PDF"
            description="Opens in browser for printing"
            onClick={() => {
              exportApi.openHtmlForPrint(noteId, resolveLinks);
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<FileArchive />}
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

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; description?: string; onClick: () => void }> = ({
  icon, label, description, onClick,
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-start gap-2.5 px-3.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2"
  >
    <span className="mt-px text-muted-foreground [&_svg]:size-4">{icon}</span>
    <div>
      <div>{label}</div>
      {description && <div className="text-[11px] text-muted-foreground">{description}</div>}
    </div>
  </button>
);

export default ExportButton;
