import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/ui';
import { graphApi, Backlink } from './graphApi';

interface Props {
  noteId: number;
  /** Open a note by id (click-to-navigate). */
  onOpenNote: (noteId: number) => void;
  /** Bumped by the parent to force a refresh (e.g. after a link change). */
  refreshKey?: number;
}

/** #251 — lists every note that links to the current note. */
const BacklinksPanel: React.FC<Props> = ({ noteId, onOpenNote, refreshKey }) => {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBacklinks(await graphApi.getBacklinks(noteId));
    } catch (e) {
      setError('Failed to load backlinks');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return <div className="p-3.5 text-[13px] text-muted-foreground">Loading backlinks…</div>;
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3.5 text-[13px] text-destructive">
        {error} <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }
  if (backlinks.length === 0) {
    return <div className="p-3.5 text-[13px] italic text-muted-foreground">No notes link here yet.</div>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {backlinks.map((b) => (
        <li
          key={b.id}
          className="cursor-pointer rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-primary/60 hover:bg-surface-2"
          onClick={() => onOpenNote(b.id)}
        >
          <div className="text-sm font-semibold text-foreground">{b.title || `Note #${b.id}`}</div>
          {b.snippet && (
            <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{b.snippet}</div>
          )}
        </li>
      ))}
    </ul>
  );
};

export default BacklinksPanel;
