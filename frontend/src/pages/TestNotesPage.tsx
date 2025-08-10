import React from 'react';
import Notes from '../features/notes/Notes';

const TestNotesPage: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Notes Feature Test</h1>
      <Notes />
    </div>
  );
};

export default TestNotesPage;
