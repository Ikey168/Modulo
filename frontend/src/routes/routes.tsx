import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load components for better performance
const Home = React.lazy(() => import('../features/home/Home'));
const Dashboard = React.lazy(() => import('../features/dashboard/Dashboard'));
const Contracts = React.lazy(() => import('../features/contracts/Contracts'));
const About = React.lazy(() => import('../features/about/About'));

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;