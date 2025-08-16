import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { NetworkStatusIndicator } from '../network';
import { ThemeToggle } from '../theme';
import MobileMenu from './MobileMenu';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [window.location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.classList.add('mobile-menu-open');
    } else {
      document.body.classList.remove('mobile-menu-open');
    }
    
    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatWalletAddress = (address: string | undefined): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const formatBalance = (balance: string | undefined): string => {
    if (!balance) return '0.0000';
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <h1>Modulo</h1>
          <div className="header-controls">
            <ThemeToggle compact={true} showLabels={false} className="header-theme-toggle" />
            <NetworkStatusIndicator showDetails={true} className="header-network-status" />
            
            {/* MetaMask Wallet Info */}
            {isAuthenticated && user?.authProvider === 'metamask' && (
              <div className="wallet-info-header">
                <div className="wallet-address">
                  <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.8 3.6L14.4 8.4L15.6 5.4L20.8 3.6ZM3.2 3.6L8.4 5.4L9.6 8.4L3.2 3.6ZM18.4 15.6L20.8 20.4L15.6 18.6L18.4 15.6ZM5.6 15.6L8.4 18.6L3.2 20.4L5.6 15.6ZM9.6 9.6L12 11.1L14.4 9.6L13.2 12L12 14.4L10.8 12L9.6 9.6ZM8.4 13.2L6 16.8L9.6 15.6L8.4 13.2ZM15.6 13.2L14.4 15.6L18 16.8L15.6 13.2Z" />
                  </svg>
                  <span className="address">{formatWalletAddress(user.walletAddress)}</span>
                  <span className="balance">{formatBalance(user.walletBalance)} ETH</span>
                </div>
              </div>
            )}
            
            <nav className="header-nav">
              <ul>
                {isAuthenticated ? (
                  <>
                    <li><a href="/profile">Profile</a></li>
                    <li><a href="/settings">Settings</a></li>
                    <li><button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}>Logout</button></li>
                  </>
                ) : (
                  <li><a href="/login">Login</a></li>
                )}
              </ul>
            </nav>
            <button 
              className="hamburger-button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <div className={`hamburger-icon ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="hamburger-line"></div>
                <div className="hamburger-line"></div>
                <div className="hamburger-line"></div>
              </div>
            </button>
          </div>
        </div>
      </header>
      
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
    </>
  );
};

export default Header;