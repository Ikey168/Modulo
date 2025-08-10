import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../components/editor/RichTextEditor';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorAlert from '../../components/common/ErrorAlert';
import './Notes.css';

interface Note {
  id?: number;
  title: string;
  content: string;
  markdownContent?: string;
}

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for new/editing notes
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/notes');
      setNotes(response || []);
    } catch (err) {
      setError('Failed to load notes');
      console.error('Error loading notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedNote(null);
    setTitle('');
    setContent('');
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setIsEditing(true);
    setIsCreating(false);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleSaveNote = async () => {
    if (!title.trim()) {
      setError('Please enter a title for the note');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const noteData = {
        title: title.trim(),
        content,
        markdownContent: content, // Store rich HTML content
      };

      if (isCreating) {
        const newNote = await api.post('/notes', noteData);
        if (newNote) {
          setNotes(prev => [...prev, newNote]);
          setSelectedNote(newNote);
        }
      } else if (selectedNote) {
        const updatedNote = await api.put(`/notes/${selectedNote.id}`, noteData);
        if (updatedNote) {
          setNotes(prev => prev.map(note => 
            note.id === selectedNote.id ? updatedNote : note
          ));
          setSelectedNote(updatedNote);
        }
      }

      setIsCreating(false);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save note');
      console.error('Error saving note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedNote) {
      setTitle(selectedNote.title);
      setContent(selectedNote.content);
    } else {
      setTitle('');
      setContent('');
      setSelectedNote(null);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await api.delete(`/notes/${noteId}`);
      setNotes(prev => prev.filter(note => note.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        setTitle('');
        setContent('');
      }
    } catch (err) {
      setError('Failed to delete note');
      console.error('Error deleting note:', err);
    }
  };

  const handleSelectNote = (note: Note) => {
    if (isEditing || isCreating) {
      if (confirm('You have unsaved changes. Do you want to discard them?')) {
        setIsEditing(false);
        setIsCreating(false);
      } else {
        return;
      }
    }
    
    setSelectedNote(note);
    setTitle(note.title);
    setContent(note.content);
  };

  if (loading) {
    return (
      <div className="notes-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="notes-container">
      <div className="notes-sidebar">
        <div className="notes-header">
          <h2>Notes</h2>
          <button 
            className="btn btn-primary"
            onClick={handleCreateNote}
            disabled={isCreating}
          >
            + New Note
          </button>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="notes-list">
          {notes.length === 0 ? (
            <div className="empty-state">
              <p>No notes yet. Create your first note!</p>
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onClick={() => handleSelectNote(note)}
              >
                <div className="note-item-header">
                  <h3>{note.title}</h3>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (note.id) handleDeleteNote(note.id);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div 
                  className="note-preview"
                  dangerouslySetInnerHTML={{ 
                    __html: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '')
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="notes-editor">
        {(selectedNote || isCreating) ? (
          <div className="editor-container">
            <div className="editor-header">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter note title..."
                className="title-input"
                disabled={!isEditing && !isCreating}
              />
              
              <div className="editor-actions">
                {(isEditing || isCreating) ? (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveNote}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleEditNote(selectedNote!)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="editor-content">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start writing your note... You can drag and drop images, add links, and create tables!"
                editable={isEditing || isCreating}
              />
            </div>
          </div>
        ) : (
          <div className="editor-placeholder">
            <h3>Select a note to view</h3>
            <p>Choose a note from the sidebar or create a new one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
