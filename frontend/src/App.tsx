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
import AuthCallbackPage from './features/auth/AuthCallbackPage';
import OAuth2Redirect from './features/auth/OAuth2Redirect';
import RequireAuth from './features/auth/RequireAuth';

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
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            
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

            {/* OAuth2 redirect route */}
            <Route 
              path="/oauth2/authorization/:provider" 
              element={<OAuth2Redirect />} 
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