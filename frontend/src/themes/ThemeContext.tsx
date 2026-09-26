import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, getThemeByName } from './themes';
import { setSystemBarAppearance } from '../services/shellWindow';
import { deviceDocuments } from '../services/deviceDocuments';
import { claimLegacyDeviceValue } from '../services/legacy/legacyDeviceTransfer';

interface ThemeContextType {
  currentTheme: Theme;
  themeName: string;
  setTheme: (themeName: string) => void;
  toggleDarkMode: () => void;
  isDarkMode: boolean;
  /** True while no explicit choice is stored on this device. */
  followsSystem: boolean;
  setFollowSystem: (follow: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
}

/** Device preference: the display theme applies before sign-in, so it is not account data. */
const THEME_DOCUMENT = 'preference.theme';
const LEGACY_THEME_KEY = 'modulo-theme';

/** Themes that render on a dark canvas. */
const DARK_THEMES = new Set(['dark', 'bart']);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark'
}) => {
  // The dark theme this app prefers — 'bart' here, not necessarily 'dark'.
  const darkDefault = DARK_THEMES.has(defaultTheme) ? defaultTheme : 'dark';

  // The configured default, which the app sets deliberately. Only fall back
  // to the system preference when that default is a light theme and the
  // system asks for dark.
  const systemTheme = (): string => {
    if (typeof window === 'undefined' || DARK_THEMES.has(defaultTheme)) return defaultTheme;
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : defaultTheme;
  };
  const [themeName, setThemeName] = useState<string>(systemTheme);
  const [explicit, setExplicit] = useState(false);

  // An explicit choice stored on this device always wins once it is read.
  useEffect(() => {
    let active = true;
    const documents = deviceDocuments();
    void documents.get<string>(THEME_DOCUMENT)
      .then(saved => saved ?? claimLegacyDeviceValue(LEGACY_THEME_KEY, THEME_DOCUMENT, documents, raw => raw || undefined))
      .then(saved => { if (active && saved && getThemeByName(saved).name === saved) { setThemeName(saved); setExplicit(true); } })
      .catch(() => { /* Unreadable device storage leaves the default theme in place. */ });
    return () => { active = false; };
  }, []);

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
      if (explicit) return;
      setThemeName(event.matches ? darkDefault : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [darkDefault, explicit]);

  const setTheme = (newThemeName: string) => {
    setThemeName(newThemeName);
    setExplicit(true);
    void deviceDocuments().set(THEME_DOCUMENT, newThemeName).catch((error) => {
      console.error('Theme preference could not be stored on this device:', error);
    });
  };

  const setFollowSystem = (follow: boolean) => {
    if (!follow) { setTheme(themeName); return; }
    setExplicit(false);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setThemeName(prefersDark ? darkDefault : 'light');
    void deviceDocuments().remove(THEME_DOCUMENT).catch(() => { /* The in-memory choice still applies. */ });
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
    followsSystem: !explicit,
    setFollowSystem,
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
