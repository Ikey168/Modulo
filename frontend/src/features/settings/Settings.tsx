import React from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { ThemeToggle } from '../../components/theme';
import { themes } from '../../themes/themes';
import './Settings.css';

const Settings: React.FC = () => {
  const { currentTheme, setTheme, isDarkMode } = useTheme();

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1>Settings</h1>
        
        <div className="settings-section">
          <h2>Appearance</h2>
          <p className="settings-description">
            Customize how Modulo looks and feels. Changes are saved automatically and applied instantly.
          </p>
          
          <div className="setting-group">
            <h3>Theme Selection</h3>
            <div className="theme-options-grid">
              {themes.map((theme) => (
                <div
                  key={theme.name}
                  className={`theme-card ${currentTheme.name === theme.name ? 'active' : ''}`}
                  onClick={() => setTheme(theme.name)}
                >
                  <div className="theme-preview-large">
                    <div className="preview-header" style={{ backgroundColor: theme.colors.brand.primary }}>
                      <div className="preview-title" style={{ color: theme.colors.text.inverse }}>
                        {theme.displayName}
                      </div>
                    </div>
                    <div className="preview-content" style={{ backgroundColor: theme.colors.background.primary }}>
                      <div className="preview-card" style={{ 
                        backgroundColor: theme.colors.background.card,
                        border: `1px solid ${theme.colors.border.primary}`,
                        color: theme.colors.text.primary
                      }}>
                        <div className="preview-text" style={{ color: theme.colors.text.primary }}>
                          Sample content
                        </div>
                        <div className="preview-secondary" style={{ color: theme.colors.text.secondary }}>
                          Secondary text
                        </div>
                        <div className="preview-button" style={{ 
                          backgroundColor: theme.colors.brand.accent,
                          color: theme.colors.text.inverse
                        }}>
                          Button
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <div className="theme-name">{theme.displayName}</div>
                    <div className="theme-colors">
                      <span 
                        className="color-dot" 
                        style={{ backgroundColor: theme.colors.brand.primary }}
                        title="Primary"
                      />
                      <span 
                        className="color-dot" 
                        style={{ backgroundColor: theme.colors.brand.accent }}
                        title="Accent"
                      />
                      <span 
                        className="color-dot" 
                        style={{ backgroundColor: theme.colors.background.primary }}
                        title="Background"
                      />
                    </div>
                  </div>
                  {currentTheme.name === theme.name && (
                    <div className="active-indicator">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <h3>Quick Theme Toggle</h3>
            <p>Use this for quick switching between light and dark modes:</p>
            <ThemeToggle showLabels={true} compact={false} />
          </div>

          <div className="setting-group">
            <h3>System Preferences</h3>
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={!localStorage.getItem('modulo-theme')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      localStorage.removeItem('modulo-theme');
                      // Trigger system preference detection
                      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      setTheme(prefersDark ? 'dark' : 'light');
                    } else {
                      setTheme(currentTheme.name);
                    }
                  }}
                />
                Follow system theme automatically
              </label>
              <p className="setting-help">
                When enabled, the theme will automatically switch based on your system's dark/light mode setting.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Accessibility</h2>
          <p className="settings-description">
            Options to improve accessibility and usability.
          </p>
          
          <div className="setting-group">
            <div className="setting-item">
              <label className="setting-label">
                <input type="checkbox" defaultChecked={false} />
                High contrast mode
              </label>
              <p className="setting-help">
                Increases contrast for better visibility.
              </p>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">
                <input type="checkbox" defaultChecked={false} />
                Reduce animations
              </label>
              <p className="setting-help">
                Minimizes motion effects throughout the interface.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Current Theme Info</h2>
          <div className="theme-details">
            <div className="detail-row">
              <span className="detail-label">Theme:</span>
              <span className="detail-value">{currentTheme.displayName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Mode:</span>
              <span className="detail-value">{isDarkMode ? 'Dark' : 'Light'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Auto-follow system:</span>
              <span className="detail-value">
                {!localStorage.getItem('modulo-theme') ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
