import React, { useEffect, useState, useCallback } from 'react';
import { Button, Badge } from '@/ui';
import { graphApi, RelatedNote } from './graphApi';

interface Props {
  noteId: number;
  onOpenNote: (noteId: number) => void;
  refreshKey?: number;
}

/** #253 — structurally related notes (shared-neighbor scoring over the link graph). */
const RelatedNotesPanel: React.FC<Props> = ({ noteId, onOpenNote, refreshKey }) => {
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRelated(await graphApi.getRelated(noteId, 10));
    } catch (e) {
      setError('Failed to load related notes');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return <div className="p-3.5 text-[13px] text-muted-foreground">Finding related notes…</div>;
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3.5 text-[13px] text-destructive">
        {error} <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }
  if (related.length === 0) {
    return (
      <div className="p-3.5 text-[13px] italic text-muted-foreground">
        No structurally-related notes yet. Link more notes to build connections.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {related.map((r) => (
        <li
          key={r.id}
          className="cursor-pointer rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-primary/60 hover:bg-surface-2"
          onClick={() => onOpenNote(r.id)}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {r.title || `Note #${r.id}`}
            <Badge variant="default" title="Shared connections">{r.score}</Badge>
          </div>
          {r.snippet && (
            <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{r.snippet}</div>
          )}
        </li>
      ))}
    </ul>
  );
};

export default RelatedNotesPanel;
