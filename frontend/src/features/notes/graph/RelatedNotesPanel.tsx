import React, { useEffect, useState, useCallback } from 'react';
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
    return <div className="graph-panel-state">Finding related notes…</div>;
  }
  if (error) {
    return (
      <div className="graph-panel-state graph-panel-error">
        {error} <button className="graph-link-btn" onClick={load}>Retry</button>
      </div>
    );
  }
  if (related.length === 0) {
    return (
      <div className="graph-panel-state graph-panel-empty">
        No structurally-related notes yet. Link more notes to build connections.
      </div>
    );
  }

  return (
    <ul className="graph-card-list">
      {related.map((r) => (
        <li key={r.id} className="graph-card" onClick={() => onOpenNote(r.id)}>
          <div className="graph-card-title">
            {r.title || `Note #${r.id}`}
            <span className="graph-score" title="Shared connections">{r.score}</span>
          </div>
          {r.snippet && <div className="graph-card-snippet">{r.snippet}</div>}
        </li>
      ))}
    </ul>
  );
};

export default RelatedNotesPanel;
