import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../../__tests__/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ThemeToggle from '../ThemeToggle';

// Mock the theme context
const mockToggleDarkMode = vi.fn();
const mockSetTheme = vi.fn();

vi.mock('../../../themes/ThemeContext', () => ({
  useTheme: () => ({
    currentTheme: 'light',
    setTheme: mockSetTheme,
    isDarkMode: false,
    toggleDarkMode: mockToggleDarkMode,
  }),
}));

// Mock themes
vi.mock('../../../themes/themes', () => ({
  themes: {
    light: { name: 'Light Theme' },
    dark: { name: 'Dark Theme' },
    blue: { name: 'Blue Theme' },
  },
}));

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ThemeToggle />);
    // Full (non-compact) mode renders multiple buttons (selector + quick toggle).
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('renders in compact mode', () => {
    render(<ThemeToggle compact={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('theme-toggle-compact');
  });

  it('shows light mode icon when in light mode', () => {
    render(<ThemeToggle compact={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('🌙'); // Moon icon for switching to dark
  });

  it('calls toggleDarkMode when clicked in compact mode', () => {
    render(<ThemeToggle compact={true} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('has proper accessibility attributes', () => {
    render(<ThemeToggle compact={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(button).toHaveAttribute('title', 'Switch to dark mode');
  });

  it('applies custom className', () => {
    render(<ThemeToggle className="custom-class" compact={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});
