import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Theme, getThemeByName } from './themes';

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

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultTheme = 'light' 
}) => {
  // Initialize theme from localStorage or default
  const [themeName, setThemeName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        return savedTheme;
      }
      // Check system preference for dark mode
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return defaultTheme;
  });

  const currentTheme = getThemeByName(themeName);
  const isDarkMode = themeName === 'dark';

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply all color variables
    Object.entries(currentTheme.colors.background).forEach(([key, value]) => {
      root.style.setProperty(`--color-bg-${key}`, value);
    });
    
    Object.entries(currentTheme.colors.text).forEach(([key, value]) => {
      root.style.setProperty(`--color-text-${key}`, value);
    });
    
    Object.entries(currentTheme.colors.border).forEach(([key, value]) => {
      root.style.setProperty(`--color-border-${key}`, value);
    });
    
    Object.entries(currentTheme.colors.brand).forEach(([key, value]) => {
      root.style.setProperty(`--color-brand-${key}`, value);
    });
    
    Object.entries(currentTheme.colors.status).forEach(([key, value]) => {
      root.style.setProperty(`--color-status-${key}`, value);
    });
    
    Object.entries(currentTheme.colors.interactive).forEach(([key, value]) => {
      root.style.setProperty(`--color-interactive-${key}`, value);
    });

    // Apply shadow variables
    Object.entries(currentTheme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });

    // Apply theme name as data attribute for CSS targeting
    root.setAttribute('data-theme', currentTheme.name);
    
    // Add/remove dark mode class for compatibility
    if (isDarkMode) {
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
    }

  }, [currentTheme, isDarkMode]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = (e: MediaQueryListEvent) => {
        // Only auto-switch if user hasn't manually selected a theme
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (!savedTheme) {
          setThemeName(e.matches ? 'dark' : 'light');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const setTheme = (newThemeName: string) => {
    setThemeName(newThemeName);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newThemeName);
    }
  };

  const toggleDarkMode = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setTheme(newTheme);
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
