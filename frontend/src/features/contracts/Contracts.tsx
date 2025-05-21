import React from 'react';

const Contracts: React.FC = () => {
  return (
    <div className="contracts-container">
      <header className="contracts-header">
        <h1>Smart Contracts</h1>
        <div className="contract-actions">
          <button className="deploy-btn">Deploy New Contract</button>
        </div>
      </header>

      <section className="contracts-list">
        <h2>Your Contracts</h2>
        <div className="contracts-grid">
          <div className="contract-card empty">
            <p>No contracts deployed yet</p>
            <button className="create-btn">Create Contract</button>
          </div>
        </div>
      </section>

      <section className="contract-templates">
        <h2>Templates</h2>
        <div className="templates-grid">
          <div className="template-card">
            <h3>ERC20 Token</h3>
            <p>Standard token contract</p>
            <button>Use Template</button>
          </div>
          <div className="template-card">
            <h3>ERC721 NFT</h3>
            <p>Non-fungible token contract</p>
            <button>Use Template</button>
          </div>
          <div className="template-card">
            <h3>Custom Contract</h3>
            <p>Start from scratch</p>
            <button>Create Custom</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contracts;