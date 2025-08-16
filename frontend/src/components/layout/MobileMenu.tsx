import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    onClose();
  };

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <div className={`mobile-menu-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className={`mobile-menu ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-menu-header">
          <h2>Menu</h2>
          <button 
            className="mobile-menu-close" 
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        
        <nav className="mobile-menu-nav">
          <ul>
            <li>
              <Link to="/" onClick={handleLinkClick} className="mobile-menu-link">
                🏠 Home
              </Link>
            </li>
            <li>
              <Link to="/about" onClick={handleLinkClick} className="mobile-menu-link">
                ℹ️ About
              </Link>
            </li>
            <li>
              <Link to="/settings" onClick={handleLinkClick} className="mobile-menu-link">
                ⚙️ Settings
              </Link>
            </li>
            
            {isAuthenticated ? (
              <>
                <li className="menu-divider" />
                <li>
                  <Link to="/dashboard" onClick={handleLinkClick} className="mobile-menu-link">
                    📊 Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/notes" onClick={handleLinkClick} className="mobile-menu-link">
                    📝 Notes
                  </Link>
                </li>
                <li>
                  <Link to="/notes-graph" onClick={handleLinkClick} className="mobile-menu-link">
                    🕸️ Notes Graph
                  </Link>
                </li>
                <li>
                  <Link to="/contracts" onClick={handleLinkClick} className="mobile-menu-link">
                    📋 Contracts
                  </Link>
                </li>
                <li>
                  <Link to="/plugins" onClick={handleLinkClick} className="mobile-menu-link">
                    🔌 Plugins
                  </Link>
                </li>
                <li>
                  <Link to="/marketplace" onClick={handleLinkClick} className="mobile-menu-link">
                    🛒 Marketplace
                  </Link>
                </li>
                <li className="menu-divider" />
                <li>
                  <Link to="/profile" onClick={handleLinkClick} className="mobile-menu-link">
                    👤 Profile
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={handleLogout} 
                    className="mobile-menu-link mobile-menu-logout"
                  >
                    🚪 Logout
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className="menu-divider" />
                <li>
                  <Link to="/login" onClick={handleLinkClick} className="mobile-menu-link login-link">
                    🔑 Login
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default MobileMenu;
