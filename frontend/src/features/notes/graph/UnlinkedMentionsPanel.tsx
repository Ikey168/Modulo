import React, { useEffect, useState, useCallback } from 'react';
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
        <mark className="graph-match">{m.snippet.slice(idx, idx + m.matchedText.length)}</mark>
        {m.snippet.slice(idx + m.matchedText.length)}
      </>
    );
  };

  if (loading) {
    return <div className="graph-panel-state">Scanning for mentions…</div>;
  }
  if (error) {
    return (
      <div className="graph-panel-state graph-panel-error">
        {error} <button className="graph-link-btn" onClick={load}>Retry</button>
      </div>
    );
  }
  if (mentions.length === 0) {
    return <div className="graph-panel-state graph-panel-empty">No unlinked mentions found.</div>;
  }

  return (
    <ul className="graph-card-list">
      {mentions.map((m) => (
        <li key={m.id} className="graph-card graph-card-mention">
          <div className="graph-card-main" onClick={() => onOpenNote(m.id)}>
            <div className="graph-card-title">{m.title || `Note #${m.id}`}</div>
            <div className="graph-card-snippet">{renderSnippet(m)}</div>
          </div>
          <button
            className="graph-link-btn graph-link-action"
            disabled={linking === m.id}
            onClick={(e) => {
              e.stopPropagation();
              handleLink(m.id);
            }}
          >
            {linking === m.id ? 'Linking…' : 'Link'}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default UnlinkedMentionsPanel;
