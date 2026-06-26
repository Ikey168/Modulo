import React, { useEffect, useState, useCallback } from 'react';
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
    return <div className="graph-panel-state">Loading backlinks…</div>;
  }
  if (error) {
    return (
      <div className="graph-panel-state graph-panel-error">
        {error} <button className="graph-link-btn" onClick={load}>Retry</button>
      </div>
    );
  }
  if (backlinks.length === 0) {
    return <div className="graph-panel-state graph-panel-empty">No notes link here yet.</div>;
  }

  return (
    <ul className="graph-card-list">
      {backlinks.map((b) => (
        <li key={b.id} className="graph-card" onClick={() => onOpenNote(b.id)}>
          <div className="graph-card-title">{b.title || `Note #${b.id}`}</div>
          {b.snippet && <div className="graph-card-snippet">{b.snippet}</div>}
        </li>
      ))}
    </ul>
  );
};

export default BacklinksPanel;
