import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Suspense, useEffect } from 'react';
import { store } from './store/store';
import { networkStatusService } from './services/networkStatus';
import { ThemeProvider } from './themes/ThemeContext';
import { Toaster, TooltipProvider } from '@/ui';
import Layout from './components/layout/Layout';
import Home from './features/home/Home';
import Contracts from './features/contracts/Contracts';
import About from './features/about/About';
import Settings from './features/settings/Settings';
import LoginPage from './features/auth/LoginPage';
import AuthCallback from './features/auth/AuthCallback';
import SilentCallback from './features/auth/SilentCallback';
import RequireAuth from './features/auth/RequireAuth';
import BlueprintEditor from './features/blueprint/editor/BlueprintEditor';
import PackManager from './features/blueprint/pack/PackManager';
import MobileLoginPage from './components/mobile/MobileLoginPage';
import { GoogleOAuthCallback, MicrosoftOAuthCallback } from './components/mobile/OAuthCallback';
import SharedNotePage from './features/notes/sharing/SharedNotePage';
import PluginSubmission from './features/PluginSubmission';
import MySubmissions from './features/MySubmissions';
import { getFeatureRegistry } from '@modulo/core';

const NOTE_WORKBENCH_ID = 'com.modulo.note-workbench';

function App() {
  useEffect(() => {
    // Initialize network monitoring when app starts
    networkStatusService.startMonitoring();

    // Cleanup on unmount
    return () => {
      networkStatusService.stopMonitoring();
    };
  }, []);

  // Resolve the note-workbench pack routes at render time. The pack is
  // registered synchronously in main.tsx before ReactDOM.render, so this
  // reflects the final boot state (no pack → routes absent; pack present →
  // routes rendered). Set VITE_NOTE_WORKBENCH_ENABLED=false to disable.
  const workbenchPack = getFeatureRegistry().getAll().find((p) => p.id === NOTE_WORKBENCH_ID);

  return (
    <ThemeProvider defaultTheme="dark">
      <Provider store={store}>
        <TooltipProvider delayDuration={300}>
        <Router>
          <Routes>
            {/* Login is the main entry page */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Public routes */}
            <Route path="/home" element={<Home />} />
            {/* E2E encrypted shared note viewer — no auth required (#265) */}
            <Route path="/shared/:noteId" element={<SharedNotePage />} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            
            {/* OIDC callback routes */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/silent-callback" element={<SilentCallback />} />
            
            {/* Mobile routes */}
            <Route path="/mobile/login" element={<MobileLoginPage />} />
            <Route path="/mobile/auth/google/callback" element={<GoogleOAuthCallback />} />
            <Route path="/mobile/auth/microsoft/callback" element={<MicrosoftOAuthCallback />} />
            
            {/* note-workbench pack routes — only present when the pack is registered. */}
            {workbenchPack && (
              <Route path="/app" element={<Navigate to="/app/notes" replace />} />
            )}
            {workbenchPack?.routes?.map((route) => {
              const Component = route.component;
              const element = route.requiresAuth ? (
                <RequireAuth>
                  <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>}>
                    <Component />
                  </Suspense>
                </RequireAuth>
              ) : (
                <Suspense fallback={null}>
                  <Component />
                </Suspense>
              );
              return <Route key={route.path} path={route.path} element={element} />;
            })}

            {/* Blueprint visual editor (#274) */}
            <Route
              path="/blueprints"
              element={
                <RequireAuth>
                  <BlueprintEditor />
                </RequireAuth>
              }
            />

            {/* Pack manager (#276) */}
            <Route
              path="/packs"
              element={
                <RequireAuth>
                  <PackManager />
                </RequireAuth>
              }
            />

            {/* Protected routes */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/notes" element={<Navigate to="/app/notes" replace />} />
            <Route path="/notes-graph" element={<Navigate to="/app/graph" replace />} />
            <Route path="/plugins/marketplace" element={<Navigate to="/app/marketplace" replace />} />
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

            {/* Plugin submission pipeline */}
            <Route
              path="/plugins/submit"
              element={
                <RequireAuth>
                  <Layout>
                    <PluginSubmission />
                  </Layout>
                </RequireAuth>
              }
            />
            <Route
              path="/plugins/my-submissions"
              element={
                <RequireAuth>
                  <Layout>
                    <MySubmissions />
                  </Layout>
                </RequireAuth>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
        <Toaster />
        </TooltipProvider>
      </Provider>
    </ThemeProvider>
  );
}

export default App;