import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { useSwipe } from '../../hooks/useMobileInteractions';
import MobileOptimizedButton from '../common/MobileOptimizedButton';
import './EnhancedMobileMenu.css';

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
  roles?: string[];
}

interface EnhancedMobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items?: MenuItem[];
}

const defaultMenuItems: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="9" x2="9" y2="15" />
        <line x1="15" y1="9" x2="15" y2="15" />
      </svg>
    ),
    requiresAuth: true,
  },
  {
    id: 'notes',
    label: 'Notes',
    path: '/notes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
    ),
    requiresAuth: true,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    path: '/contracts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    requiresAuth: true,
  },
  {
    id: 'plugins',
    label: 'Plugins',
    path: '/plugins',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <rect x="7" y="7" width="3" height="9" />
        <rect x="14" y="7" width="3" height="5" />
      </svg>
    ),
    requiresAuth: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    path: '/about',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="9,9 a3,3 0 1,1 6,0c0,2-3,3-3,3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

const EnhancedMobileMenu: React.FC<EnhancedMobileMenuProps> = ({
  isOpen,
  onClose,
  items = defaultMenuItems,
}) => {
  const { isAuthenticated, user, logout, roles = [] } = useAuth();
  const location = useLocation();
  const { isMobile, isLandscape } = useResponsive();
  const [isAnimating, setIsAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Filter menu items based on authentication and roles
  const filteredItems = items.filter(item => {
    if (item.requiresAuth && !isAuthenticated) return false;
    if (item.roles && item.roles.length > 0) {
      return item.roles.some(role => roles.includes(role));
    }
    return true;
  });

  // Handle swipe to close
  const { getSwipeProps } = useSwipe({
    onSwipeLeft: onClose,
    onSwipeRight: () => {}, // Prevent closing on swipe right
  }, {
    threshold: 100,
    preventDefault: false,
  });

  // Handle escape key and outside click
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && e.target === overlayRef.current) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('mobile-menu-open');
      setIsAnimating(true);
    } else {
      document.body.classList.remove('mobile-menu-open');
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.classList.remove('mobile-menu-open');
    };
  }, [isOpen]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle menu item click
  const handleMenuItemClick = () => {
    onClose();
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      ref={overlayRef}
      className={`enhanced-mobile-menu-overlay ${isOpen ? 'open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-menu-title"
    >
      <div
        ref={menuRef}
        className={`enhanced-mobile-menu ${isOpen ? 'open' : ''} ${
          isLandscape ? 'landscape' : 'portrait'
        }`}
        {...getSwipeProps()}
      >
        {/* Header */}
        <div className="enhanced-mobile-menu-header">
          <h2 id="mobile-menu-title" className="enhanced-mobile-menu-title">
            Menu
          </h2>
          <MobileOptimizedButton
            variant="ghost"
            size="small"
            onClick={onClose}
            aria-label="Close menu"
            className="enhanced-mobile-menu-close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </MobileOptimizedButton>
        </div>

        {/* User info */}
        {isAuthenticated && user && (
          <div className="enhanced-mobile-menu-user">
            <div className="user-avatar">
              {user.displayName?.charAt(0) || user.username?.charAt(0) || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user.displayName || user.username}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="enhanced-mobile-menu-nav" role="navigation">
          <ul className="menu-list">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    onClick={handleMenuItemClick}
                    className={`menu-item ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="menu-item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="menu-item-label">{item.label}</span>
                    {isActive && (
                      <span className="menu-item-indicator" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9,18 15,12 9,6" />
                        </svg>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Actions */}
        <div className="enhanced-mobile-menu-actions">
          {isAuthenticated ? (
            <MobileOptimizedButton
              variant="outline"
              fullWidth
              onClick={handleLogout}
              leftIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
            >
              Sign Out
            </MobileOptimizedButton>
          ) : (
            <MobileOptimizedButton
              variant="primary"
              fullWidth
              onClick={() => {
                handleMenuItemClick();
                // Navigate to login - you might want to use router here
                window.location.href = '/login';
              }}
              leftIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10,17 15,12 10,7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              }
            >
              Sign In
            </MobileOptimizedButton>
          )}
        </div>

        {/* Footer info */}
        <div className="enhanced-mobile-menu-footer">
          <div className="app-version">
            Modulo v1.0.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMobileMenu;
