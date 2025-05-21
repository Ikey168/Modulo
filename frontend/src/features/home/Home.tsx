import React from 'react';

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <section className="hero">
        <h1>Welcome to Modulo</h1>
        <p>Your Gateway to Blockchain Innovation</p>
      </section>
      
      <section className="features">
        <h2>Key Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Smart Contracts</h3>
            <p>Deploy and manage blockchain contracts with ease</p>
          </div>
          <div className="feature-card">
            <h3>Dashboard</h3>
            <p>Monitor your blockchain activities in real-time</p>
          </div>
          <div className="feature-card">
            <h3>Security</h3>
            <p>Enterprise-grade security for your assets</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;