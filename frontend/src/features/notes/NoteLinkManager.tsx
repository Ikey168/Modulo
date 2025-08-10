import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export interface Note {
  id?: number;
  title: string;
  content: string;
  markdownContent?: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface NoteLink {
  id: string;
  sourceNote: Note;
  targetNote: Note;
  linkType: string;
}

export interface NoteLinkCreate {
  sourceNoteId: number;
  targetNoteId: number;
  linkType: string;
}

const LINK_TYPES = [
  'RELATED',
  'REFERENCES',
  'DEPENDS_ON', 
  'PART_OF',
  'CONTRADICTS',
  'SUPPORTS',
  'EXTENDS',
  'EXAMPLE_OF'
];

interface NoteLinkManagerProps {
  noteId: number;
  allNotes: Note[];
  onLinksChanged?: () => void;
}

const NoteLinkManager: React.FC<NoteLinkManagerProps> = ({ 
  noteId, 
  allNotes, 
  onLinksChanged 
}) => {
  const [outgoingLinks, setOutgoingLinks] = useState<NoteLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<NoteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [selectedTargetNoteId, setSelectedTargetNoteId] = useState<string>('');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('RELATED');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLinks();
  }, [noteId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [outgoing, incoming] = await Promise.all([
        api.get(`/note-links/note/${noteId}/outgoing`),
        api.get(`/note-links/note/${noteId}/incoming`)
      ]);
      
      setOutgoingLinks(outgoing || []);
      setIncomingLinks(incoming || []);
    } catch (err) {
      setError('Failed to load note links');
      console.error('Error loading note links:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedTargetNoteId || selectedTargetNoteId === noteId.toString()) {
      setError('Please select a valid target note');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const linkData: NoteLinkCreate = {
        sourceNoteId: noteId,
        targetNoteId: parseInt(selectedTargetNoteId),
        linkType: selectedLinkType
      };

      await api.post('/note-links', linkData);
      
      // Reset form
      setSelectedTargetNoteId('');
      setSelectedLinkType('RELATED');
      setShowAddForm(false);
      
      // Reload links
      await loadLinks();
      
      if (onLinksChanged) {
        onLinksChanged();
      }
    } catch (err) {
      setError('Failed to create note link');
      console.error('Error creating note link:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      setError(null);
      await api.delete(`/note-links/${linkId}`);
      
      // Reload links
      await loadLinks();
      
      if (onLinksChanged) {
        onLinksChanged();
      }
    } catch (err) {
      setError('Failed to delete note link');
      console.error('Error deleting note link:', err);
    }
  };

  const availableTargetNotes = allNotes.filter(note => 
    note.id && 
    note.id !== noteId && 
    !outgoingLinks.some(link => link.targetNote.id === note.id)
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

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

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
              {availableTargetNotes.map(note => (
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
              {LINK_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.replace('_', ' ')}
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
              {outgoingLinks.map(link => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <div className="link-type">{link.linkType.replace('_', ' ')}</div>
                    <div className="link-target">{link.targetNote.title}</div>
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
              {incomingLinks.map(link => (
                <div key={link.id} className="link-item">
                  <div className="link-info">
                    <div className="link-type">{link.linkType.replace('_', ' ')}</div>
                    <div className="link-source">← {link.sourceNote.title}</div>
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
