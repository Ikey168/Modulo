import React, { useState, useEffect } from 'react';
import MarkdownEditor from '../../components/MarkdownEditor';
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
  const [isCreating, setIsCreating] = useState(false);
  const [newNote, setNewNote] = useState<Note>({ title: '', content: '', markdownContent: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notes on component mount
  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/notes');
      if (response.ok) {
        const notesData = await response.json();
        setNotes(notesData);
      } else {
        setError('Failed to load notes');
      }
    } catch (err) {
      setError('Error loading notes');
      console.error('Error loading notes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = () => {
    setIsCreating(true);
    setSelectedNote(null);
    setNewNote({ title: '', content: '', markdownContent: '' });
  };

  const handleSaveNote = async () => {
    if (!newNote.title.trim()) {
      setError('Note title is required');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newNote.title,
          content: newNote.content,
          markdownContent: newNote.markdownContent,
        }),
      });

      if (response.ok) {
        const savedNote = await response.json();
        setNotes([savedNote, ...notes]);
        setIsCreating(false);
        setSelectedNote(savedNote);
        setNewNote({ title: '', content: '', markdownContent: '' });
        setError(null);
      } else {
        setError('Failed to save note');
      }
    } catch (err) {
      setError('Error saving note');
      console.error('Error saving note:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewNote({ title: '', content: '', markdownContent: '' });
    setError(null);
  };

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setIsCreating(false);
    setError(null);
  };

  const handleMarkdownChange = (markdown: string, html: string) => {
    if (isCreating) {
      setNewNote({
        ...newNote,
        markdownContent: markdown,
        content: html,
      });
    }
  };

  return (
    <div className="notes-container">
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="notes-layout">
        {/* Sidebar with notes list */}
        <div className="notes-sidebar">
          <div className="notes-header">
            <h2>Notes</h2>
            <button onClick={handleCreateNote} className="create-note-btn">
              + New Note
            </button>
          </div>

          {isLoading && <div className="loading">Loading notes...</div>}

          <div className="notes-list">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onClick={() => handleSelectNote(note)}
              >
                <h3>{note.title}</h3>
                <p>{note.content?.substring(0, 100)}...</p>
              </div>
            ))}
            
            {notes.length === 0 && !isLoading && (
              <div className="empty-state">
                <p>No notes yet. Create your first note!</p>
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="notes-main">
          {isCreating ? (
            <div className="note-editor">
              <div className="note-editor-header">
                <input
                  type="text"
                  placeholder="Note title..."
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="note-title-input"
                />
                <div className="note-actions">
                  <button onClick={handleSaveNote} disabled={isLoading} className="save-btn">
                    {isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={handleCancelCreate} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
              <div className="note-editor-content">
                <MarkdownEditor
                  initialContent={newNote.markdownContent}
                  onContentChange={handleMarkdownChange}
                  placeholder="Start writing your note in Markdown..."
                />
              </div>
            </div>
          ) : selectedNote ? (
            <div className="note-viewer">
              <div className="note-viewer-header">
                <h1>{selectedNote.title}</h1>
              </div>
              <div className="note-viewer-content">
                <MarkdownEditor
                  initialContent={selectedNote.markdownContent || selectedNote.content}
                  readOnly={true}
                />
              </div>
            </div>
          ) : (
            <div className="notes-welcome">
              <h2>Welcome to Your Notes</h2>
              <p>Select a note from the sidebar or create a new one to get started.</p>
              <button onClick={handleCreateNote} className="create-note-btn primary">
                Create Your First Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notes;
