import React from 'react';
import {createRoot} from 'react-dom/client';
import {NotePropertyPanel} from '../../src/features/knowledge/NotePropertyPanel';
import {authService} from '../../src/features/auth/authService';
import '../../src/styles/index.css';
authService.stateSession=()=>({issuer:'test',subject:'owner',accessToken:'fixture-token'});
createRoot(document.getElementById('root')!).render(<NotePropertyPanel noteId={10} content="Body" notes={[]} onSaved={()=>{}}/>);
