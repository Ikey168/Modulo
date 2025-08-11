import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import Layout from './components/layout/Layout';
import Home from './features/home/Home';
import Dashboard from './features/dashboard/Dashboard';
import Contracts from './features/contracts/Contracts';
import Notes from './features/notes/Notes';
import About from './features/about/About';
import LoginPage from './features/auth/LoginPage';
import AuthCallbackPage from './features/auth/AuthCallbackPage';
import OAuth2Redirect from './features/auth/OAuth2Redirect';
import RequireAuth from './features/auth/RequireAuth';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/about" element={<Layout><About /></Layout>} />
          <Route path="/notes" element={<Layout><Notes /></Layout>} />
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
  );
}

export default App;