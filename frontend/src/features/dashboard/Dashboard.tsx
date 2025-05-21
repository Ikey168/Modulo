import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="dashboard-actions">
          <button className="refresh-btn">Refresh</button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Active Contracts</h3>
          <div className="card-content">
            <span className="card-value">0</span>
            <p className="card-label">Total Active</p>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Recent Transactions</h3>
          <div className="card-content">
            <span className="card-value">0</span>
            <p className="card-label">Last 24 hours</p>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Gas Usage</h3>
          <div className="card-content">
            <span className="card-value">0 ETH</span>
            <p className="card-label">Total Used</p>
          </div>
        </div>
      </div>

      <section className="recent-activity">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          <p>No recent activity</p>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;