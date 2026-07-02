import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../__tests__/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from '../Header';

// Radix popper-positioned content needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Mutable auth state so individual tests can flip authentication.
const mockLogout = vi.fn();
const authState: { isAuthenticated: boolean; user: Record<string, unknown> | null } = {
  isAuthenticated: false,
  user: null,
};

vi.mock('../../../features/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    roles: [],
    logout: mockLogout,
  }),
}));

vi.mock('../../../features/notes/collab/NotificationBell', () => ({
  default: () => <div data-testid="notification-bell" />,
}));

vi.mock('../../theme', () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle theme</button>,
}));

const signIn = () => {
  authState.isAuthenticated = true;
  authState.user = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };
};

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = false;
    authState.user = null;
    window.history.pushState({}, '', '/');
  });

  it('renders a single header bar with brand and theme switcher', () => {
    render(<Header />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /modulo/i })).toHaveAttribute('href', '/app/marketplace');
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('shows a sign-in button and no app nav when logged out', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
  });

  it('renders the primary nav, notification bell and account menu when authenticated', () => {
    signIn();
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Marketplace' })).toHaveAttribute('href', '/app/marketplace');
    expect(screen.getByRole('link', { name: 'Blueprints' })).toHaveAttribute('href', '/blueprints');
    expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/app/notes');
    expect(screen.getByRole('link', { name: 'Graph' })).toHaveAttribute('href', '/app/graph');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it('opens the More menu with the secondary destinations', async () => {
    signIn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'More' }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/app/dashboard');
    expect(within(menu).getByRole('menuitem', { name: 'Contracts' })).toHaveAttribute('href', '/contracts');
    expect(within(menu).getByRole('menuitem', { name: 'Contracts' })).toHaveAttribute('href', '/contracts');
    expect(within(menu).getByRole('menuitem', { name: 'About' })).toHaveAttribute('href', '/about');
  });

  it('opens the account menu with Settings and Logout', async () => {
    signIn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /account menu/i }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /settings/i })).toHaveAttribute('href', '/settings');

    await user.click(within(menu).getByRole('menuitem', { name: /logout/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('opens the mobile menu sheet with the full IA and closes it on navigation', async () => {
    signIn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Header />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/app/notes');
    expect(within(dialog).getByRole('link', { name: 'Blueprints' })).toHaveAttribute('href', '/blueprints');
    expect(within(dialog).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(dialog).getByText('Ada Lovelace')).toBeInTheDocument();

    // Navigating from the sheet closes it (close-on-route-change effect).
    await user.click(within(dialog).getByRole('link', { name: 'Notes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers sign-in inside the mobile sheet when logged out', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(within(dialog).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    expect(within(dialog).queryByRole('link', { name: 'Notes' })).not.toBeInTheDocument();
  });
});
