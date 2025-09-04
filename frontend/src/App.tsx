import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { store } from './store/store';
import { networkStatusService } from './services/networkStatus';
import { ThemeProvider } from './themes/ThemeContext';
import Layout from './components/layout/Layout';
import Home from './features/home/Home';
import Dashboard from './features/dashboard/Dashboard';
import Contracts from './features/contracts/Contracts';
import About from './features/about/About';
import Settings from './features/settings/Settings';
import LoginPage from './features/auth/LoginPage';
import AuthCallback from './features/auth/AuthCallback';
import SilentCallback from './features/auth/SilentCallback';
import RequireAuth from './features/auth/RequireAuth';
import { MobileLoginPage } from './components/mobile/MobileLoginPage';
import { GoogleOAuthCallback, MicrosoftOAuthCallback } from './components/mobile/OAuthCallback';

function App() {
  useEffect(() => {
    // Initialize network monitoring when app starts
    networkStatusService.startMonitoring();
    
    // Cleanup on unmount
    return () => {
      networkStatusService.stopMonitoring();
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="light">
      <Provider store={store}>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/login" element={<LoginPage />} />
            
            {/* OIDC callback routes */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/silent-callback" element={<SilentCallback />} />
            
            {/* Mobile routes */}
            <Route path="/mobile/login" element={<MobileLoginPage />} />
            <Route path="/mobile/auth/google/callback" element={<GoogleOAuthCallback />} />
            <Route path="/mobile/auth/microsoft/callback" element={<MicrosoftOAuthCallback />} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/contracts"
              element={
                <RequireAuth>
                  <Layout>
                    <Contracts />
                  </Layout>
                </RequireAuth>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </Provider>
    </ThemeProvider>
  );
}

export default App;