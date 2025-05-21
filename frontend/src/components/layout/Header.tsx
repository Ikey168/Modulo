import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <h1>Modulo</h1>
        <nav className="header-nav">
          <ul>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/settings">Settings</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;