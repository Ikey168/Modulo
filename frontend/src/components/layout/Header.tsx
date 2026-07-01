import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { NetworkStatusIndicator } from '../network';
import { ThemeToggle } from '../theme';
import EnhancedMobileMenu from './EnhancedMobileMenu';
import MobileOptimizedButton from '../common/MobileOptimizedButton';
import { useResponsive } from '../../hooks/useResponsive';
import { Badge } from '@/ui';

const ModuloMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden>
    <rect x={1} y={1} width={9} height={9} rx={2} fill="#4f46e5" />
    <rect x={12} y={1} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
    <rect x={1} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.4} />
    <rect x={12} y={12} width={9} height={9} rx={2} fill="#4f46e5" opacity={0.7} />
  </svg>
);

const Header: React.FC = () => {
  const { isAuthenticated, user, roles } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isMobile } = useResponsive();

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

  const formatWalletAddress = (address: string | undefined): string =>
    address ? `${address.substring(0, 6)}…${address.substring(address.length - 4)}` : '';

  const formatBalance = (balance: string | undefined): string =>
    balance ? parseFloat(balance).toFixed(4) : '0.0000';

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-6 max-md:px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
          >
            <ModuloMark />
            <span className="text-[15px] font-semibold tracking-tight">Modulo</span>
          </button>

          <div className="flex items-center gap-3">
            <ThemeToggle compact showLabels={false} className="header-theme-toggle" />
            <NetworkStatusIndicator showDetails className="header-network-status" />

            {/* OIDC user chips */}
            {isAuthenticated && user?.authProvider === 'oidc' && (
              <div className="flex items-center gap-2 max-md:hidden">
                {user.email && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xxs text-subtle-foreground">
                    <Mail className="size-3.5 text-primary" />
                    {user.email}
                  </span>
                )}
                {roles.length > 0 && (
                  <div className="flex items-center gap-1">
                    {roles.map((role) => (
                      <Badge key={role} variant="secondary">{role}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MetaMask wallet chip */}
            {isAuthenticated && user?.authProvider === 'metamask' && (
              <div className="inline-flex items-center gap-2 rounded-md border border-warning/20 bg-warning/10 px-2.5 py-1 text-xxs max-md:hidden">
                <span className="font-mono text-subtle-foreground">{formatWalletAddress(user.walletAddress)}</span>
                <span className="font-semibold text-warning">{formatBalance(user.walletBalance)} ETH</span>
              </div>
            )}

            {/* Desktop auth links */}
            <nav className="desktop-only flex items-center gap-1 max-md:hidden">
              {isAuthenticated ? (
                <Link to="/settings" className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                  Settings
                </Link>
              ) : (
                <Link to="/login" className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                  Login
                </Link>
              )}
            </nav>

            {/* Mobile menu button */}
            {isMobile && (
              <MobileOptimizedButton
                variant="ghost"
                size="touch"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
                className="mobile-menu-trigger"
              >
                <div className={`hamburger-icon ${isMobileMenuOpen ? 'open' : ''}`}>
                  <div className="hamburger-line"></div>
                  <div className="hamburger-line"></div>
                  <div className="hamburger-line"></div>
                </div>
              </MobileOptimizedButton>
            )}
          </div>
        </div>
      </header>

      <EnhancedMobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  );
};

export default Header;
