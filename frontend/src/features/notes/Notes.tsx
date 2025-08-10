import React, { useState, useEffect } from 'react';
import TagInput from '../../components/common/TagInput';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
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
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');

  // Form state for new/editing notes
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);

  useEffect(() => {
    loadNotes();
    loadTags();
  }, []);

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
        response = await fetch(`/api/notes/${selectedNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteData)
        });
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
    <div className="notes-container">
      <div className="notes-header">
        <h1>Notes</h1>
        <button
          onClick={handleCreateNote}
          className="btn btn-primary"
          disabled={isCreating || isEditing}
        >
          New Note
        </button>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
        />
      )}

      <div className="notes-content">
        <div className="notes-sidebar">
          {/* Tag Filter */}
          <div className="tag-filter">
            <h3>Filter by Tag</h3>
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="tag-filter-select"
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
                <div
                  key={note.id}
                  className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                  onClick={() => !isEditing && !isCreating && setSelectedNote(note)}
                >
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
                  <div className="note-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note);
                      }}
                      className="btn btn-small"
                      disabled={isEditing || isCreating}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        note.id && handleDeleteNote(note.id);
                      }}
                      className="btn btn-small btn-danger"
                      disabled={isEditing || isCreating}
                    >
                      Delete
                    </button>
                  </div>
                </div>
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
    </div>
  );
};

export default Notes;
