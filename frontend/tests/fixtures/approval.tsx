import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {ApprovalInbox} from '../../src/features/approvals/ApprovalInbox';
import {authService} from '../../src/features/auth/authService';
import '../../src/styles/index.css';
authService.stateSession = () => ({issuer:'test',subject:'reviewer',accessToken:'fixture-token'});
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/app/approvals?request=request-1']}><ApprovalInbox /></MemoryRouter>);
