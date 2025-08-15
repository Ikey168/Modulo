import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load components for better performance
const Home = React.lazy(() => import('../features/home/Home'));
const Dashboard = React.lazy(() => import('../features/dashboard/Dashboard'));
const Contracts = React.lazy(() => import('../features/contracts/Contracts'));
const Notes = React.lazy(() => import('../features/notes/Notes'));
const NotesGraph = React.lazy(() => import('../features/notes/NotesGraph'));
const About = React.lazy(() => import('../features/about/About'));
const LoginPage = React.lazy(() => import('../features/auth/LoginPage')); // Added
const AuthCallbackPage = React.lazy(() => import('../features/auth/AuthCallbackPage')); // Added
const PluginManager = React.lazy(() => import('../features/plugins/PluginManager'));
const PluginMarketplace = React.lazy(() => import('../features/plugins/PluginMarketplace'));
const PluginSubmission = React.lazy(() => import('../features/PluginSubmission'));
const MySubmissions = React.lazy(() => import('../features/MySubmissions'));

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} /> {/* Added */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} /> {/* Added */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes-graph" element={<NotesGraph />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/plugins" element={<PluginManager />} />
        <Route path="/plugins/marketplace" element={<PluginMarketplace />} />
        <Route path="/plugins/submit" element={<PluginSubmission />} />
        <Route path="/plugins/my-submissions" element={<MySubmissions />} />
        <Route path="/marketplace" element={<PluginMarketplace />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;