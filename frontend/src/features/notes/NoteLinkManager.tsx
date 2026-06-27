import React, { useState, useEffect, useMemo } from 'react';
import { createCoreAPI } from '@modulo/core';
import type { CoreLink } from '@modulo/core';

const LINK_TYPES = [
  'RELATED',
  'REFERENCES',
  'DEPENDS_ON',
  'PART_OF',
  'CONTRADICTS',
  'SUPPORTS',
  'EXTENDS',
  'EXAMPLE_OF',
];

interface NoteLinkManagerProps {
  noteId: number;
  /** Minimal note shape — only id and title are required for display. */
  allNotes: Array<{ id: number; title: string }>;
  onLinksChanged?: () => void;
}

const NoteLinkManager: React.FC<NoteLinkManagerProps> = ({
  noteId,
  allNotes,
  onLinksChanged,
}) => {
  const api = useMemo(() => createCoreAPI(), []);

  const [outgoingLinks, setOutgoingLinks] = useState<CoreLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<CoreLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [selectedTargetNoteId, setSelectedTargetNoteId] = useState<string>('');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('RELATED');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const [outgoing, incoming] = await Promise.all([
        api.outgoingLinks(noteId),
        api.incomingLinks(noteId),
      ]);
      setOutgoingLinks(outgoing);
      setIncomingLinks(incoming);
    } catch (err) {
      setError('Failed to load note links');
      console.error('Error loading note links:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedTargetNoteId || selectedTargetNoteId === String(noteId)) {
      setError('Please select a valid target note');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      // createLink emits link.created on the CoreEventBus automatically.
      await api.createLink(noteId, parseInt(selectedTargetNoteId), selectedLinkType);
      setSelectedTargetNoteId('');
      setSelectedLinkType('RELATED');
      setShowAddForm(false);
      await loadLinks();
      onLinksChanged?.();
    } catch (err) {
      setError('Failed to create note link');
      console.error('Error creating note link:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    try {
      setError(null);
      // removeLink emits link.removed on the CoreEventBus automatically.
      await api.removeLink(linkId);
      await loadLinks();
      onLinksChanged?.();
    } catch (err) {
      setError('Failed to delete note link');
      console.error('Error deleting note link:', err);
    }
  };

  const noteTitle = (id: number) =>
    allNotes.find((n) => n.id === id)?.title ?? '(unknown)';

  const availableTargetNotes = allNotes.filter(
    (n) =>
      n.id !== noteId &&
      !outgoingLinks.some((l) => l.targetNoteId === n.id),
  );

  if (loading) {
    return (
      <div className="note-links-manager">
        <div className="note-links-loading">Loading note links...</div>
      </div>
    );
  }

  return (
    <div className="note-links-manager">
      <div className="note-links-header">
        <h3>Note Links</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-small btn-secondary"
          disabled={availableTargetNotes.length === 0}
        >
          {showAddForm ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="add-link-form">
          <h4>Create New Link</h4>

          <div className="form-group">
            <label htmlFor="target-note">Target Note</label>
            <select
              id="target-note"
              value={selectedTargetNoteId}
              onChange={(e) => setSelectedTargetNoteId(e.target.value)}
              className="form-select"
            >
              <option value="">Select a note...</option>
              {availableTargetNotes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="link-type">Link Type</label>
            <select
              id="link-type"
              value={selectedLinkType}
              onChange={(e) => setSelectedLinkType(e.target.value)}
              className="form-select"
            >
              {LINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button
              onClick={handleCreateLink}
              className="btn btn-small btn-primary"
              disabled={submitting || !selectedTargetNoteId}
            >
              {submitting ? 'Creating...' : 'Create Link'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-small btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="links-sections">
        {/* Outgoing Links */}
        <div className="links-section">
          <h4>Outgoing Links ({outgoingLinks.length})</h4>
          {outgoingLinks.length === 0 ? (
            <p className="no-links">No outgoing links</p>
          ) : (
            <div className="links-list">
              {outgoingLinks.map((link) => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <div className="link-type">{link.linkType.replace(/_/g, ' ')}</div>
                    <div className="link-target">{noteTitle(link.targetNoteId)}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Links */}
        <div className="links-section">
          <h4>Incoming Links ({incomingLinks.length})</h4>
          {incomingLinks.length === 0 ? (
            <p className="no-links">No incoming links</p>
          ) : (
            <div className="links-list">
              {incomingLinks.map((link) => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <div className="link-type">{link.linkType.replace(/_/g, ' ')}</div>
                    <div className="link-source">← {noteTitle(link.sourceNoteId)}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteLinkManager;
