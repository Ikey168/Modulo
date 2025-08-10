import React from 'react';
import Notes from '../features/notes/Notes';

const TestNotesPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#1a202c' }}>🎨 Rich Text Notes Demo</h1>
      <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '16px' }}>
        Test the comprehensive rich text notes feature with TipTap editor supporting 
        images, links, tables, and drag-and-drop functionality. This is the complete 
        implementation ready for production use.
      </p>
      <div style={{ 
        background: '#f8fafc', 
        padding: '16px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>✨ Features Available:</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#6b7280' }}>
          <li>Rich text formatting (bold, italic, headings, lists)</li>
          <li>Drag & drop image uploads</li>
          <li>Interactive tables with resizable columns</li>
          <li>Hyperlink creation and editing</li>
          <li>Real-time note saving and management</li>
        </ul>
      </div>
      <Notes />
    </div>
  );
};

export default TestNotesPage;
