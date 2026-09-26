import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, getThemeByName } from './themes';
import { setSystemBarAppearance } from '../services/shellWindow';

interface ThemeContextType {
  currentTheme: Theme;
  themeName: string;
  setTheme: (themeName: string) => void;
  toggleDarkMode: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

const THEME_STORAGE_KEY = 'modulo-theme';

/** Themes that render on a dark canvas. */
const DARK_THEMES = new Set(['dark', 'bart']);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark'
}) => {
  // The dark theme this app prefers — 'bart' here, not necessarily 'dark'.
  const darkDefault = DARK_THEMES.has(defaultTheme) ? defaultTheme : 'dark';

  const [themeName, setThemeName] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultTheme;

    // An explicit choice always wins.
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) return savedTheme;

    // Otherwise the configured default, which the app sets deliberately. Only
    // fall back to the system preference when that default is a light theme
    // and the system asks for dark.
    if (DARK_THEMES.has(defaultTheme)) return defaultTheme;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : defaultTheme;
  });

  const currentTheme = getThemeByName(themeName);
  // Every dark-canvas theme, not just the one literally named "dark" — the
  // toggle icon and toggleDarkMode both key off this.
  const isDarkMode = DARK_THEMES.has(themeName);

  // The data-theme attribute drives the token overrides in styles/index.css —
  // the design system (Tailwind + shadcn/ui) reads only those CSS variables.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme.name);
  }, [currentTheme]);

  // The packaged Android window is edge to edge, so the system bars sit on top
  // of this canvas and their icons have to be told which way to contrast.
  useEffect(() => {
    void setSystemBarAppearance(isDarkMode).catch((error) => {
      console.error('System bar appearance unavailable:', error);
    });
  }, [isDarkMode]);

  // Follow later system changes, but only while the user has made no choice.
  // `matchMedia` is absent in jsdom and in some embedded webviews, so it is
  // treated as optional rather than assumed.
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery?.addEventListener) return;

    const handleChange = (event: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      setThemeName(event.matches ? darkDefault : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [darkDefault]);

  const setTheme = (newThemeName: string) => {
    setThemeName(newThemeName);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newThemeName);
    }
  };

  const toggleDarkMode = () => {
    // Coming back from light returns to the app's configured dark theme rather
    // than always 'dark', so a Bart user is not silently moved off it.
    setTheme(isDarkMode ? 'light' : darkDefault);
  };

  const contextValue: ThemeContextType = {
    currentTheme,
    themeName,
    setTheme,
    toggleDarkMode,
    isDarkMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
