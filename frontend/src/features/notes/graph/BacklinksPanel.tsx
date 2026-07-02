import React, { useEffect, useState, useCallback } from 'react';
import { Button, Skeleton } from '@/ui';
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
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading backlinks">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
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
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {backlinks.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => onOpenNote(b.id)}
            className="block w-full rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-primary/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="text-sm font-semibold text-foreground">{b.title || `Note #${b.id}`}</div>
            {b.snippet && (
              <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{b.snippet}</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default BacklinksPanel;
