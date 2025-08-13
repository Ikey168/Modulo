import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { selectIsAuthenticated, clearCredentials } from '../../features/auth/authSlice';
import { NetworkStatusIndicator } from '../network';
import { ThemeToggle } from '../theme';

const Header: React.FC = () => {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    // Clear frontend state
    dispatch(clearCredentials());

    // Call backend logout endpoint
    // Spring Security's default logout is a GET to /logout,
    // but it's better to use POST for logout to prevent CSRF if not using CSRF tokens for GET.
    // For simplicity with default GET /logout:
    try {
      // Note: fetch to /logout will invalidate the session cookie.
      // The response might be a redirect to the login page by Spring Security.
      // We don't strictly need to await this if we are redirecting client-side immediately after.
      await fetch('http://localhost:8080/logout', { 
        method: 'POST', // Or GET if Spring Security default is used and CSRF is handled.
                        // If POST, ensure backend is configured for POST logout and CSRF token is sent if enabled.
        // headers: { 'X-CSRF-TOKEN': 'your_csrf_token_if_needed' } // Example for POST with CSRF
      });
    } catch (error) {
      console.error('Logout failed on backend:', error);
      // Still proceed with client-side logout
    }
    
    // Redirect to login page
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <h1>Modulo</h1>
        <div className="header-controls">
          <ThemeToggle compact={true} showLabels={false} className="header-theme-toggle" />
          <NetworkStatusIndicator showDetails={true} className="header-network-status" />
          <nav className="header-nav">
            <ul>
              {isAuthenticated ? (
                <>
                  <li><a href="/profile">Profile</a></li>
                  <li><a href="/settings">Settings</a></li>
                  <li><button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}>Logout</button></li>
                </>
              ) : (
                <li><a href="/login">Login</a></li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;