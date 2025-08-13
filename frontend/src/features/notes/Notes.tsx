import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TagInput from '../../components/common/TagInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import NoteLinkManager from './NoteLinkManager';
import ConflictResolutionModal from '../../components/conflicts/ConflictResolutionModal';
import TouchHandler from '../../components/common/TouchHandler';
import { useNotesSync } from '../../hooks/useWebSocket';
import { useDeviceInfo } from '../../hooks/useViewport';
import { NoteUpdateMessage } from '../../services/websocket';
import { ConflictResolution } from '../../types/conflicts';
import { conflictResolutionService } from '../../services/conflictResolution';
import './Notes.css';

interface Tag {
  id: string;
  name: string;
}

interface Note {
  id?: number;
  title: string;
  content: string;
  markdownContent?: string;
  tags?: Tag[];
}

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const deviceInfo = useDeviceInfo();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  
  // Conflict resolution state
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Form state for new/editing notes
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/notes');
      if (response.ok) {
        const data = await response.json();
        setNotes(data || []);
      } else {
        throw new Error('Failed to load notes');
      }
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data || []);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  // WebSocket integration for real-time updates
  const handleNoteUpdate = useCallback((message: NoteUpdateMessage) => {
    console.log('Received real-time note update:', message);
    
    switch (message.eventType) {
      case 'NOTE_CREATED':
        // Refresh notes list to include the new note
        loadNotes();
        break;
        
      case 'NOTE_UPDATED':
        // Update the specific note in the list
        setNotes(prevNotes => 
          prevNotes.map(note => 
            note.id === message.noteId 
              ? { 
                  ...note, 
                  title: message.title || note.title,
                  content: message.content || note.content,
                  tags: message.tagNames ? message.tagNames.map(name => ({ id: name, name })) : note.tags
                }
              : note
          )
        );
        
        // Update selected note if it's the one being updated
        if (selectedNote?.id === message.noteId) {
          setSelectedNote(prevSelected => 
            prevSelected ? {
              ...prevSelected,
              title: message.title || prevSelected.title,
              content: message.content || prevSelected.content,
              tags: message.tagNames ? message.tagNames.map(name => ({ id: name, name })) : prevSelected.tags
            } : null
          );
        }
        break;
        
      case 'NOTE_DELETED':
        // Remove the note from the list
        setNotes(prevNotes => prevNotes.filter(note => note.id !== message.noteId));
        
        // Clear selection if the deleted note was selected
        if (selectedNote?.id === message.noteId) {
          setSelectedNote(null);
          setIsEditing(false);
          setIsCreating(false);
        }
        break;
        
      case 'NOTE_LINK_CREATED':
      case 'NOTE_LINK_DELETED':
        // Refresh notes to update link counts/information
        loadNotes();
        break;
        
      default:
        console.log('Unknown message type:', message.eventType);
    }
  }, [selectedNote]);

  const { isConnected, connectionStatus } = useNotesSync(handleNoteUpdate);

  useEffect(() => {
    loadNotes();
    loadTags();
  }, []);

  const handleCreateNote = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setNoteTags([]);
  };

  const handleEditNote = (note: Note) => {
    setIsEditing(true);
    setIsCreating(false);
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
    setNoteTags(note.tags?.map(tag => tag.name) || []);
  };

  const handleSaveNote = async () => {
    if (!title.trim()) {
      setError('Note title is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const noteData = {
        title: title.trim(),
        content: content,
        markdownContent: content,
        tagNames: noteTags
      };

      let response;
      if (isCreating) {
        response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData)
        });
      } else if (selectedNote) {
        // Check for conflicts before updating
        try {
          const conflictRequest = {
            noteId: selectedNote.id!,
            expectedVersion: 0, // TODO: Get version from selected note
            title: noteData.title,
            content: noteData.content,
            markdownContent: noteData.markdownContent,
            tagNames: noteData.tagNames,
            editor: "Current User" // TODO: Get from auth context
          };
          
          const result = await conflictResolutionService.updateWithConflictCheck(conflictRequest);
          
          if (!result.success && result.conflict) {
            // Handle conflict - show resolution modal
            setConflictResolution(result.conflict);
            setShowConflictModal(true);
            setSaving(false);
            return;
          }
          
          response = { ok: true }; // Mock successful response for now
        } catch (conflictError: any) {
          if (conflictError.conflict) {
            // Handle conflict - show resolution modal
            setConflictResolution(conflictError.conflict);
            setShowConflictModal(true);
            setSaving(false);
            return;
          }
          throw conflictError;
        }
      }

      if (response && response.ok) {
        await loadNotes();
        await loadTags();
        handleCancelEdit();
      } else {
        throw new Error('Failed to save note');
      }
    } catch (err) {
      setError('Failed to save note');
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConflictResolve = async (resolution: any) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await conflictResolutionService.resolveConflict(resolution);
      
      if (response.ok) {
        await loadNotes();
        await loadTags();
        setShowConflictModal(false);
        setConflictResolution(null);
        handleCancelEdit();
      } else {
        throw new Error('Failed to resolve conflict');
      }
    } catch (err) {
      setError('Failed to resolve conflict');
      console.error('Error resolving conflict:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConflictCancel = () => {
    setShowConflictModal(false);
    setConflictResolution(null);
    setSaving(false);
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadNotes();
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
        }
      } else {
        throw new Error('Failed to delete note');
      }
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
    }
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setNoteTags([]);
  };

  const filteredNotes = selectedTagFilter
    ? notes.filter(note =>
        note.tags?.some(tag => tag.name === selectedTagFilter)
      )
    : notes;

  const allUsedTags = Array.from(
    new Set(notes.flatMap(note => note.tags?.map(tag => tag.name) || []))
  );

  if (loading) {
    return <LoadingSpinner message="Loading notes..." />;
  }

  return (
    <div className={`notes-container ${deviceInfo.isMobile ? 'mobile' : ''}`}>
      <div className="notes-header">
        <h1>Notes</h1>
        {deviceInfo.isMobile && (
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="btn btn-secondary mobile-sidebar-toggle"
          >
            {showMobileSidebar ? 'Hide Filters' : 'Show Filters'}
          </button>
        )}
        <div className="notes-header-actions">
          <Link to="/notes-graph" className="btn btn-secondary">
            {deviceInfo.isMobile ? 'Graph' : 'View Graph'}
          </Link>
          <button
            onClick={handleCreateNote}
            className="btn btn-primary btn-mobile"
            disabled={isCreating || isEditing}
          >
            {deviceInfo.isMobile ? '+' : 'New Note'}
          </button>
          
          {/* WebSocket Status Indicator */}
          <div className={`websocket-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-indicator"></span>
            <span className="status-text">{connectionStatus}</span>
          </div>
        </div>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <div className="notes-content">
        <div className={`notes-sidebar ${deviceInfo.isMobile ? (showMobileSidebar ? 'mobile-visible' : 'mobile-hidden') : ''}`}>
          {/* Tag Filter */}
          <div className="tag-filter">
            <h3>Filter by Tag</h3>
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="tag-filter-select mobile-select"
            >
              <option value="">All Notes</option>
              {allUsedTags.map(tagName => (
                <option key={tagName} value={tagName}>
                  {tagName}
                </option>
              ))}
            </select>
          </div>

          {/* Notes List */}
          <div className="notes-list">
            <h3>Notes ({filteredNotes.length})</h3>
            {filteredNotes.length === 0 ? (
              <p className="no-notes">No notes found</p>
            ) : (
              filteredNotes.map((note) => (
                <TouchHandler
                  key={note.id}
                  onTap={() => !isEditing && !isCreating && setSelectedNote(note)}
                  onLongPress={() => deviceInfo.isMobile && handleEditNote(note)}
                  onSwipeLeft={() => deviceInfo.isMobile && note.id && handleDeleteNote(note.id)}
                  className={`note-item mobile-card ${selectedNote?.id === note.id ? 'selected' : ''}`}
                >
                  <div className="note-content-preview">
                    <h4>{note.title}</h4>
                    <p>{note.content.substring(0, 100)}...</p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="note-tags">
                        {note.tags.map((tag, index) => (
                          <span key={index} className="note-tag">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!deviceInfo.isMobile && (
                    <div className="note-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditNote(note);
                        }}
                        className="btn btn-small touch-target"
                        disabled={isEditing || isCreating}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          note.id && handleDeleteNote(note.id);
                        }}
                        className="btn btn-small btn-danger touch-target"
                        disabled={isEditing || isCreating}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  {deviceInfo.isMobile && (
                    <div className="mobile-note-hint">
                      <small>Tap to view • Long press to edit • Swipe left to delete</small>
                    </div>
                  )}
                </TouchHandler>
              ))
            )}
          </div>
        </div>

        <div className="notes-main">
          {(isCreating || isEditing) ? (
            <div className="note-editor">
              <h2>{isCreating ? 'Create New Note' : 'Edit Note'}</h2>
              
              <div className="form-group">
                <label htmlFor="note-title">Title</label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter note title..."
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="note-tags">Tags</label>
                <TagInput
                  tags={noteTags}
                  onChange={setNoteTags}
                  suggestions={availableTags}
                  placeholder="Add tags..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="note-content">Content</label>
                <textarea
                  id="note-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note content..."
                  className="form-textarea"
                  rows={15}
                />
              </div>

              <div className="editor-actions">
                <button
                  onClick={handleSaveNote}
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Note'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : selectedNote ? (
            <div className="note-viewer">
              <h2>{selectedNote.title}</h2>
              {selectedNote.tags && selectedNote.tags.length > 0 && (
                <div className="note-tags">
                  {selectedNote.tags.map((tag, index) => (
                    <span key={index} className="note-tag">
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="note-content">
                <pre>{selectedNote.content}</pre>
              </div>
              
              {/* Note Links Manager */}
              {selectedNote.id && (
                <NoteLinkManager
                  noteId={selectedNote.id}
                  allNotes={notes.filter(note => note.id !== undefined)}
                  onLinksChanged={loadNotes}
                />
              )}
            </div>
          ) : (
            <div className="note-placeholder">
              <h2>Welcome to Notes</h2>
              <p>Select a note from the sidebar to view it, or create a new note to get started.</p>
              <p>You can organize your notes using tags for easy filtering and searching.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Conflict Resolution Modal */}
      {showConflictModal && conflictResolution && (
        <ConflictResolutionModal
          isOpen={showConflictModal}
          conflict={conflictResolution}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
          userName="Current User" // TODO: Get from auth context
        />
      )}
    </div>
  );
};

export default Notes;
