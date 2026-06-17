import React from 'react';
import { screen } from '@testing-library/react';
import { render } from '../../../__tests__/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';
import { useAuth } from '../../auth/useAuth';

// Mock the auth hook
const mockUseAuth = {
  user: {
    name: 'John Doe',
    authProvider: 'google',
  },
  isAuthenticated: true,
};

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock WalletInfo component
vi.mock('../../../components/wallet/WalletInfo', () => ({
  default: function MockWalletInfo() {
    return <div data-testid="wallet-info">Wallet Info Component</div>;
  },
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockUseAuth as ReturnType<typeof useAuth>);
  });

  it('renders without crashing', () => {
    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays welcome message with user name', () => {
    render(<Dashboard />);
    expect(screen.getByText('Welcome back, John Doe')).toBeInTheDocument();
  });

  it('displays fallback name when user name is not available', () => {
    const mockAuthWithoutName = {
      ...mockUseAuth,
      user: { ...mockUseAuth.user, name: undefined },
    };

    vi.mocked(useAuth).mockReturnValue(mockAuthWithoutName as ReturnType<typeof useAuth>);

    render(<Dashboard />);
    expect(screen.getByText('Welcome back, User')).toBeInTheDocument();
  });

  it('shows refresh button', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('displays dashboard cards with metrics', () => {
    render(<Dashboard />);
    
    // Check for Active Contracts card
    expect(screen.getByText('Active Contracts')).toBeInTheDocument();
    expect(screen.getByText('Total Active')).toBeInTheDocument();
  });

  it('shows wallet info for metamask users', () => {
    const mockAuthWithMetamask = {
      ...mockUseAuth,
      user: { ...mockUseAuth.user, authProvider: 'metamask' },
    };

    vi.mocked(useAuth).mockReturnValue(mockAuthWithMetamask as ReturnType<typeof useAuth>);

    render(<Dashboard />);
    expect(screen.getByTestId('wallet-info')).toBeInTheDocument();
  });

  it('does not show wallet info for non-metamask users', () => {
    render(<Dashboard />);
    expect(screen.queryByTestId('wallet-info')).not.toBeInTheDocument();
  });

  it('has proper layout structure', () => {
    render(<Dashboard />);
    
    // The outermost dashboard container carries the min-h-screen layout class.
    const dashboardContainer = screen.getByText('Dashboard').closest('.min-h-screen');
    expect(dashboardContainer).toHaveClass('min-h-screen');
  });
});
