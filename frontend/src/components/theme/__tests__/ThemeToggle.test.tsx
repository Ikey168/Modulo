import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../__tests__/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThemeToggle from '../ThemeToggle';

// Radix popper-positioned content needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// Mutable theme state so individual tests can switch the active theme.
const mockSetTheme = vi.fn();
const themeState = { themeName: 'dark', isDarkMode: true };

vi.mock('../../../themes/ThemeContext', () => ({
  useTheme: () => ({
    themeName: themeState.themeName,
    isDarkMode: themeState.isDarkMode,
    setTheme: mockSetTheme,
    toggleDarkMode: vi.fn(),
  }),
}));

const openMenu = async () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  await user.click(screen.getByRole('button', { name: /change theme/i }));
  return { user, menu: await screen.findByRole('menu') };
};

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeState.themeName = 'dark';
    themeState.isDarkMode = true;
  });

  it('renders a compact icon trigger with accessible label', () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole('button', { name: /change theme/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('shows the moon icon in dark mode and the sun icon otherwise', () => {
    const { unmount } = render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: /change theme/i }).querySelector('svg.lucide-moon'),
    ).toBeInTheDocument();
    unmount();

    themeState.themeName = 'light';
    themeState.isDarkMode = false;
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: /change theme/i }).querySelector('svg.lucide-sun'),
    ).toBeInTheDocument();
  });

  it('lists every theme with the active one checked', async () => {
    render(<ThemeToggle />);
    const { menu } = await openMenu();

    const items = within(menu).getAllByRole('menuitemcheckbox');
    expect(items.map((item) => item.textContent)).toEqual([
      'Dark Mode',
      'Light Mode',
      'Ocean Blue',
      'Forest Green',
      'Royal Purple',
    ]);
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Dark Mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Light Mode' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls setTheme with the selected theme name', async () => {
    render(<ThemeToggle />);
    const { user, menu } = await openMenu();

    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Ocean Blue' }));

    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith('blue');
  });

  it('applies a custom className to the trigger', () => {
    render(<ThemeToggle className="custom-class" />);
    expect(screen.getByRole('button', { name: /change theme/i })).toHaveClass('custom-class');
  });
});
