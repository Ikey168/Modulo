import React, { useState, useEffect } from 'react';

interface NoteLink {
  id: string;
  sourceNote: {
    id: number;
    title: string;
  };
  targetNote: {
    id: number;
    title: string;
  };
  linkType: string;
}

interface Note {
  id: number;
  title: string;
}

interface NoteLinkManagerProps {
  currentNoteId: number;
  onLinksUpdated?: () => void;
}

const NoteLinkManager: React.FC<NoteLinkManagerProps> = ({ currentNoteId, onLinksUpdated }) => {
  const [outgoingLinks, setOutgoingLinks] = useState<NoteLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<NoteLink[]>([]);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New link form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTargetNoteId, setSelectedTargetNoteId] = useState<number | null>(null);
  const [linkType, setLinkType] = useState('RELATED');
  const [creating, setCreating] = useState(false);

  const LINK_TYPES = [
    { value: 'RELATED', label: 'Related' },
    { value: 'REFERENCES', label: 'References' },
    { value: 'DEPENDS_ON', label: 'Depends On' },
    { value: 'PART_OF', label: 'Part Of' },
    { value: 'CONTRADICTS', label: 'Contradicts' },
    { value: 'SUPPORTS', label: 'Supports' },
    { value: 'EXTENDS', label: 'Extends' },
    { value: 'EXAMPLE_OF', label: 'Example Of' }
  ];

  useEffect(() => {
    loadLinks();
    loadAvailableNotes();
  }, [currentNoteId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load outgoing links
      const outgoingResponse = await fetch(`/api/note-links/note/${currentNoteId}/outgoing`);
      if (outgoingResponse.ok) {
        const outgoingData = await outgoingResponse.json();
        setOutgoingLinks(outgoingData || []);
      }

      // Load incoming links
      const incomingResponse = await fetch(`/api/note-links/note/${currentNoteId}/incoming`);
      if (incomingResponse.ok) {
        const incomingData = await incomingResponse.json();
        setIncomingLinks(incomingData || []);
      }
    } catch (err) {
      setError('Failed to load note links');
      console.error('Error loading links:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (response.ok) {
        const data = await response.json();
        // Filter out the current note
        const filteredNotes = data.filter((note: Note) => note.id !== currentNoteId);
        setAvailableNotes(filteredNotes || []);
      }
    } catch (err) {
      console.error('Error loading available notes:', err);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedTargetNoteId || !linkType) {
      setError('Please select a target note and link type');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/note-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNoteId: currentNoteId,
          targetNoteId: selectedTargetNoteId,
          linkType: linkType
        })
      });

      if (response.ok) {
        await loadLinks();
        setShowAddForm(false);
        setSelectedTargetNoteId(null);
        setLinkType('RELATED');
        onLinksUpdated?.();
      } else {
        throw new Error('Failed to create link');
      }
    } catch (err) {
      setError('Failed to create link');
      console.error('Error creating link:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/note-links/${linkId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadLinks();
        onLinksUpdated?.();
      } else {
        throw new Error('Failed to delete link');
      }
    } catch (err) {
      setError('Failed to delete link');
      console.error('Error deleting link:', err);
    }
  };

  const getLinkTypeLabel = (type: string) => {
    const linkType = LINK_TYPES.find(lt => lt.value === type);
    return linkType ? linkType.label : type;
  };

  if (loading) {
    return <div className="note-links-loading">Loading links...</div>;
  }

  return (
    <div className="note-links-manager">
      <div className="note-links-header">
        <h3>Note Links</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-small btn-primary"
        >
          {showAddForm ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="add-link-form">
          <h4>Create New Link</h4>
          <div className="form-group">
            <label>Target Note:</label>
            <select
              value={selectedTargetNoteId || ''}
              onChange={(e) => setSelectedTargetNoteId(Number(e.target.value))}
              className="form-select"
            >
              <option value="">Select a note...</option>
              {availableNotes.map(note => (
                <option key={note.id} value={note.id}>
                  {note.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Link Type:</label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="form-select"
            >
              {LINK_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button
              onClick={handleCreateLink}
              className="btn btn-primary"
              disabled={creating || !selectedTargetNoteId}
            >
              {creating ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </div>
      )}

      <div className="links-sections">
        {/* Outgoing Links */}
        <div className="links-section">
          <h4>Links to Other Notes ({outgoingLinks.length})</h4>
          {outgoingLinks.length === 0 ? (
            <p className="no-links">No outgoing links</p>
          ) : (
            <div className="links-list">
              {outgoingLinks.map(link => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <span className="link-type">{getLinkTypeLabel(link.linkType)}</span>
                    <span className="link-target">{link.targetNote.title}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="btn btn-small btn-danger"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Links */}
        <div className="links-section">
          <h4>Links from Other Notes ({incomingLinks.length})</h4>
          {incomingLinks.length === 0 ? (
            <p className="no-links">No incoming links</p>
          ) : (
            <div className="links-list">
              {incomingLinks.map(link => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <span className="link-source">{link.sourceNote.title}</span>
                    <span className="link-type">{getLinkTypeLabel(link.linkType)}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="btn btn-small btn-danger"
                  >
                    Remove
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
