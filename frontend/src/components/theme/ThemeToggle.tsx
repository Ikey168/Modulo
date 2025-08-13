import React, { useState } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { themes } from '../../themes/themes';
import './ThemeToggle.css';

interface ThemeToggleProps {
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  showLabels = true,
  compact = false 
}) => {
  const { currentTheme, setTheme, isDarkMode, toggleDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleQuickToggle = () => {
    toggleDarkMode();
  };

  const handleThemeSelect = (themeName: string) => {
    setTheme(themeName);
    setIsExpanded(false);
  };

  const getThemeIcon = (themeName: string) => {
    switch (themeName) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'blue': return '🌊';
      case 'green': return '🌲';
      case 'purple': return '🔮';
      default: return '🎨';
    }
  };

  if (compact) {
    return (
      <button
        className={`theme-toggle-compact ${className}`}
        onClick={handleQuickToggle}
        title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      >
        <span className="theme-icon">
          {isDarkMode ? '☀️' : '🌙'}
        </span>
      </button>
    );
  }

  return (
    <div className={`theme-toggle ${className}`}>
      <div className="theme-toggle-header">
        <button
          className="theme-toggle-current"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label="Theme selector"
        >
          <span className="theme-icon">
            {getThemeIcon(currentTheme.name)}
          </span>
          {showLabels && (
            <span className="theme-name">{currentTheme.displayName}</span>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            ▼
          </span>
        </button>
        
        <button
          className="quick-toggle"
          onClick={handleQuickToggle}
          title={`Quick switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          aria-label={`Quick switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {isExpanded && (
        <div className="theme-options">
          {themes.map((theme) => (
            <button
              key={theme.name}
              className={`theme-option ${currentTheme.name === theme.name ? 'active' : ''}`}
              onClick={() => handleThemeSelect(theme.name)}
              title={`Switch to ${theme.displayName}`}
            >
              <span className="theme-preview">
                <span 
                  className="color-preview bg" 
                  style={{ backgroundColor: theme.colors.background.primary }}
                />
                <span 
                  className="color-preview brand" 
                  style={{ backgroundColor: theme.colors.brand.primary }}
                />
                <span 
                  className="color-preview accent" 
                  style={{ backgroundColor: theme.colors.brand.accent }}
                />
              </span>
              <span className="theme-option-icon">
                {getThemeIcon(theme.name)}
              </span>
              {showLabels && (
                <span className="theme-option-name">{theme.displayName}</span>
              )}
              {currentTheme.name === theme.name && (
                <span className="active-indicator">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
