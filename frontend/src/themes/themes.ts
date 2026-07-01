export interface Theme {
  name: string;
  displayName: string;
  colors: {
    // Background colors
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      card: string;
      overlay: string;
    };
    // Text colors
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    // Border colors
    border: {
      primary: string;
      secondary: string;
      focus: string;
    };
    // Brand colors
    brand: {
      primary: string;
      secondary: string;
      accent: string;
    };
    // Status colors
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    // Interactive states
    interactive: {
      hover: string;
      active: string;
      disabled: string;
    };
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
}

// Light Mode mirrors the light token block in styles/index.css (zinc + indigo).
export const lightTheme: Theme = {
  name: 'light',
  displayName: 'Light Mode',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#fafafa',
      tertiary: '#f4f4f5',
      card: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#09090b',
      secondary: '#3f3f46',
      tertiary: '#71717a',
      inverse: '#ffffff',
    },
    border: {
      primary: '#e4e4e7',
      secondary: '#d4d4d8',
      focus: '#4f46e5',
    },
    brand: {
      primary: '#4f46e5',
      secondary: '#6366f1',
      accent: '#16a34a',
    },
    status: {
      success: '#16a34a',
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
    },
    interactive: {
      hover: '#f4f4f5',
      active: '#e4e4e7',
      disabled: '#a1a1aa',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.08)',
    large: '0 12px 32px rgba(0, 0, 0, 0.12)',
  },
};

// Dark Mode is the canonical Modulo look — the "workspace" aesthetic the whole
// app unifies on. These values mirror the semantic tokens in styles/index.css.
export const darkTheme: Theme = {
  name: 'dark',
  displayName: 'Dark Mode',
  colors: {
    background: {
      primary: '#0a0a0b',
      secondary: '#111114',
      tertiary: '#16161a',
      card: '#111114',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
    text: {
      primary: '#f4f4f5',
      secondary: '#a1a1aa',
      tertiary: '#71717a',
      inverse: '#0a0a0b',
    },
    border: {
      primary: '#1e1e24',
      secondary: '#2a2a30',
      focus: '#6366f1',
    },
    brand: {
      primary: '#4f46e5',
      secondary: '#6366f1',
      accent: '#22c55e',
    },
    status: {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    interactive: {
      hover: '#16161a',
      active: '#1c1c22',
      disabled: '#52525b',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.5)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.5)',
    large: '0 12px 32px rgba(0, 0, 0, 0.6)',
  },
};

export const blueTheme: Theme = {
  name: 'blue',
  displayName: 'Ocean Blue',
  colors: {
    background: {
      primary: '#f0f4f8',
      secondary: '#e2e8f0',
      tertiary: '#cbd5e0',
      card: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#1a202c',
      secondary: '#4a5568',
      tertiary: '#718096',
      inverse: '#ffffff',
    },
    border: {
      primary: '#e2e8f0',
      secondary: '#cbd5e0',
      focus: '#3182ce',
    },
    brand: {
      primary: '#3182ce',
      secondary: '#4299e1',
      accent: '#38b2ac',
    },
    status: {
      success: '#38a169',
      warning: '#d69e2e',
      error: '#e53e3e',
      info: '#3182ce',
    },
    interactive: {
      hover: '#ebf8ff',
      active: '#bee3f8',
      disabled: '#a0aec0',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
};

export const greenTheme: Theme = {
  name: 'green',
  displayName: 'Forest Green',
  colors: {
    background: {
      primary: '#f0fff4',
      secondary: '#e6fffa',
      tertiary: '#c6f6d5',
      card: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#1a202c',
      secondary: '#2d3748',
      tertiary: '#4a5568',
      inverse: '#ffffff',
    },
    border: {
      primary: '#e6fffa',
      secondary: '#c6f6d5',
      focus: '#38a169',
    },
    brand: {
      primary: '#38a169',
      secondary: '#48bb78',
      accent: '#68d391',
    },
    status: {
      success: '#38a169',
      warning: '#d69e2e',
      error: '#e53e3e',
      info: '#3182ce',
    },
    interactive: {
      hover: '#f0fff4',
      active: '#c6f6d5',
      disabled: '#a0aec0',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
};

export const purpleTheme: Theme = {
  name: 'purple',
  displayName: 'Royal Purple',
  colors: {
    background: {
      primary: '#faf5ff',
      secondary: '#f3e8ff',
      tertiary: '#e9d5ff',
      card: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#1a202c',
      secondary: '#2d3748',
      tertiary: '#4a5568',
      inverse: '#ffffff',
    },
    border: {
      primary: '#f3e8ff',
      secondary: '#e9d5ff',
      focus: '#805ad5',
    },
    brand: {
      primary: '#805ad5',
      secondary: '#9f7aea',
      accent: '#b794f6',
    },
    status: {
      success: '#38a169',
      warning: '#d69e2e',
      error: '#e53e3e',
      info: '#3182ce',
    },
    interactive: {
      hover: '#faf5ff',
      active: '#e9d5ff',
      disabled: '#a0aec0',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
};

export const themes: Theme[] = [
  darkTheme,
  lightTheme,
  blueTheme,
  greenTheme,
  purpleTheme,
];

export const getThemeByName = (name: string): Theme => {
  return themes.find(theme => theme.name === name) || darkTheme;
};
