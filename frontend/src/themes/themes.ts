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

export const lightTheme: Theme = {
  name: 'light',
  displayName: 'Light Mode',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#f8f9fa',
      tertiary: '#f1f3f4',
      card: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#333333',
      secondary: '#666666',
      tertiary: '#999999',
      inverse: '#ffffff',
    },
    border: {
      primary: '#e9ecef',
      secondary: '#dee2e6',
      focus: '#007bff',
    },
    brand: {
      primary: '#007bff',
      secondary: '#6c757d',
      accent: '#28a745',
    },
    status: {
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8',
    },
    interactive: {
      hover: '#f8f9fa',
      active: '#e9ecef',
      disabled: '#6c757d',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  displayName: 'Dark Mode',
  colors: {
    background: {
      primary: '#1a1a1a',
      secondary: '#2d2d2d',
      tertiary: '#404040',
      card: '#2d2d2d',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      tertiary: '#999999',
      inverse: '#333333',
    },
    border: {
      primary: '#404040',
      secondary: '#555555',
      focus: '#0d6efd',
    },
    brand: {
      primary: '#0d6efd',
      secondary: '#6c757d',
      accent: '#198754',
    },
    status: {
      success: '#198754',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#0dcaf0',
    },
    interactive: {
      hover: '#404040',
      active: '#555555',
      disabled: '#6c757d',
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.3)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.3)',
    large: '0 10px 15px rgba(0, 0, 0, 0.3)',
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
  lightTheme,
  darkTheme,
  blueTheme,
  greenTheme,
  purpleTheme,
];

export const getThemeByName = (name: string): Theme => {
  return themes.find(theme => theme.name === name) || lightTheme;
};
