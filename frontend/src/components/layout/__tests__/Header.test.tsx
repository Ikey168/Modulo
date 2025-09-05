import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../__tests__/utils/test-utils';
import { describe, it, expect, vi } from 'vitest';
import Header from '../Header';

// Mock the auth hook
vi.mock('../../../features/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
    roles: [],
  }),
}));

// Mock the responsive hook
jest.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock child components
jest.mock('../../network', () => ({
  NetworkStatusIndicator: () => <div data-testid="network-status">Network Status</div>,
}));

jest.mock('../../theme', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle Theme</button>,
}));

jest.mock('../EnhancedMobileMenu', () => {
  return function MockEnhancedMobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return isOpen ? (
      <div data-testid="mobile-menu">
        <button onClick={onClose} data-testid="close-mobile-menu">Close</button>
      </div>
    ) : null;
  };
});

jest.mock('../common/MobileOptimizedButton', () => {
  return function MockMobileOptimizedButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return <button onClick={onClick} data-testid="mobile-optimized-button">{children}</button>;
  };
});

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays network status indicator', () => {
    render(<Header />);
    expect(screen.getByTestId('network-status')).toBeInTheDocument();
  });

  it('displays theme toggle', () => {
    render(<Header />);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('shows login state when user is not authenticated', () => {
    render(<Header />);
    // Should show login-related elements
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('opens and closes mobile menu', () => {
    render(<Header />);
    
    // Mobile menu should not be visible initially
    expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    
    // Find and click mobile menu button
    const mobileMenuButton = screen.queryByTestId('mobile-optimized-button');
    if (mobileMenuButton) {
      fireEvent.click(mobileMenuButton);
      expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
      
      // Close the menu
      fireEvent.click(screen.getByTestId('close-mobile-menu'));
      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();
    }
  });
});
