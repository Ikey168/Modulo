import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/ui';
import { graphApi, UnlinkedMention } from './graphApi';

interface Props {
  noteId: number;
  onOpenNote: (noteId: number) => void;
  /** Called after a link is created so other panels (backlinks/related) can refresh. */
  onLinked?: () => void;
  refreshKey?: number;
}

/**
 * #252 — notes whose text mentions this note's title but don't yet link it.
 * The "Link" action creates the link and removes the row from the list.
 */
const UnlinkedMentionsPanel: React.FC<Props> = ({ noteId, onOpenNote, onLinked, refreshKey }) => {
  const [mentions, setMentions] = useState<UnlinkedMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMentions(await graphApi.getUnlinkedMentions(noteId));
    } catch (e) {
      setError('Failed to load unlinked mentions');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleLink = useCallback(
    async (sourceId: number) => {
      setLinking(sourceId);
      try {
        await graphApi.linkFrom(noteId, sourceId);
        // Optimistically remove the now-linked mention from the list.
        setMentions((prev) => prev.filter((m) => m.id !== sourceId));
        onLinked?.();
      } catch (e) {
        setError('Failed to create link');
      } finally {
        setLinking(null);
      }
    },
    [noteId, onLinked]
  );

  /** Highlight the matched term inside the snippet. */
  const renderSnippet = (m: UnlinkedMention) => {
    if (!m.matchedText) {
      return m.snippet;
    }
    const idx = m.snippet.toLowerCase().indexOf(m.matchedText.toLowerCase());
    if (idx < 0) {
      return m.snippet;
    }
    return (
      <>
        {m.snippet.slice(0, idx)}
        <mark className="rounded-sm bg-warning/25 px-0.5 text-warning">
          {m.snippet.slice(idx, idx + m.matchedText.length)}
        </mark>
        {m.snippet.slice(idx + m.matchedText.length)}
      </>
    );
  };

  if (loading) {
    return <div className="p-3.5 text-[13px] text-muted-foreground">Scanning for mentions…</div>;
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 p-3.5 text-[13px] text-destructive">
        {error} <Button variant="outline" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }
  if (mentions.length === 0) {
    return <div className="p-3.5 text-[13px] italic text-muted-foreground">No unlinked mentions found.</div>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {mentions.map((m) => (
        <li
          key={m.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-primary/60 hover:bg-surface-2"
        >
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenNote(m.id)}>
            <div className="text-sm font-semibold text-foreground">{m.title || `Note #${m.id}`}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{renderSnippet(m)}</div>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            disabled={linking === m.id}
            loading={linking === m.id}
            onClick={(e) => {
              e.stopPropagation();
              handleLink(m.id);
            }}
          >
            {linking === m.id ? 'Linking…' : 'Link'}
          </Button>
        </li>
      ))}
    </ul>
  );
};

export default UnlinkedMentionsPanel;
