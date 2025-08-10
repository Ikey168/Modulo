import React from 'react';
import Notes from '../features/notes/Notes';

const TestNotesPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#1a202c' }}>Rich Text Notes Demo</h1>
      <p style={{ marginBottom: '20px', color: '#6b7280' }}>
        Test the comprehensive rich text notes feature with TipTap editor supporting 
        images, links, tables, and drag-and-drop functionality.
      </p>
      <Notes />
    </div>
  );
};

export default TestNotesPage;
