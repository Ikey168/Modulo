import React from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { ThemeToggle } from '../../components/theme';
import { themes } from '../../themes/themes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Switch, cn } from '@/ui';

const Settings: React.FC = () => {
  const { currentTheme, setTheme, isDarkMode } = useTheme();

  const followSystem = !localStorage.getItem('modulo-theme');

  const handleFollowSystemChange = (checked: boolean) => {
    if (checked) {
      localStorage.removeItem('modulo-theme');
      // Trigger system preference detection
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(currentTheme.name);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
            <CardDescription>
              Customize how Modulo looks and feels. Changes are saved automatically and applied instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div>
              <h3 className="mb-4 text-sm font-medium text-foreground">Theme Selection</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {themes.map((theme) => (
                  <div
                    key={theme.name}
                    className={cn(
                      'group relative cursor-pointer overflow-hidden rounded-lg border transition-colors',
                      currentTheme.name === theme.name
                        ? 'border-primary ring-2 ring-primary/40'
                        : 'border-border hover:border-border-strong',
                    )}
                    onClick={() => setTheme(theme.name)}
                  >
                    <div className="relative h-44 overflow-hidden">
                      <div
                        className="flex h-10 items-center px-4"
                        style={{ backgroundColor: theme.colors.brand.primary }}
                      >
                        <div className="text-sm font-semibold" style={{ color: theme.colors.text.inverse }}>
                          {theme.displayName}
                        </div>
                      </div>
                      <div
                        className="flex h-[136px] flex-col gap-3 p-4"
                        style={{ backgroundColor: theme.colors.background.primary }}
                      >
                        <div
                          className="flex flex-1 flex-col gap-2 rounded-md p-3"
                          style={{
                            backgroundColor: theme.colors.background.card,
                            border: `1px solid ${theme.colors.border.primary}`,
                            color: theme.colors.text.primary,
                          }}
                        >
                          <div className="text-sm font-medium" style={{ color: theme.colors.text.primary }}>
                            Sample content
                          </div>
                          <div className="text-xs" style={{ color: theme.colors.text.secondary }}>
                            Secondary text
                          </div>
                          <div
                            className="mt-auto rounded px-3 py-1.5 text-center text-xs font-medium"
                            style={{
                              backgroundColor: theme.colors.brand.accent,
                              color: theme.colors.text.inverse,
                            }}
                          >
                            Button
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border bg-surface-2 p-4">
                      <div className="font-semibold text-foreground">{theme.displayName}</div>
                      <div className="flex gap-1">
                        <span
                          className="size-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: theme.colors.brand.primary }}
                          title="Primary"
                        />
                        <span
                          className="size-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: theme.colors.brand.accent }}
                          title="Accent"
                        />
                        <span
                          className="size-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: theme.colors.background.primary }}
                          title="Background"
                        />
                      </div>
                    </div>
                    {currentTheme.name === theme.name && (
                      <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-success text-white shadow-sm [&_svg]:size-3.5">
                        <Check strokeWidth={3} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">Quick Theme Toggle</h3>
              <p className="mb-3 text-sm text-subtle-foreground">Use this for quick switching between light and dark modes:</p>
              <ThemeToggle showLabels={true} compact={false} />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium text-foreground">System Preferences</h3>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2 p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Follow system theme automatically</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When enabled, the theme will automatically switch based on your system's dark/light mode setting.
                  </p>
                </div>
                <Switch
                  checked={followSystem}
                  onChange={handleFollowSystemChange}
                  aria-label="Follow system theme automatically"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accessibility</CardTitle>
            <CardDescription>Options to improve accessibility and usability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">High contrast mode</div>
                <p className="mt-1 text-sm text-muted-foreground">Increases contrast for better visibility.</p>
              </div>
              <Switch checked={false} onChange={() => {}} aria-label="High contrast mode" />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2 p-4">
              <div>
                <div className="text-sm font-medium text-foreground">Reduce animations</div>
                <p className="mt-1 text-sm text-muted-foreground">Minimizes motion effects throughout the interface.</p>
              </div>
              <Switch checked={false} onChange={() => {}} aria-label="Reduce animations" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Theme Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-surface-2 px-5 py-2">
              <div className="flex items-center justify-between border-b border-border py-2.5">
                <span className="text-sm font-medium text-subtle-foreground">Theme:</span>
                <span className="text-sm font-semibold text-foreground">{currentTheme.displayName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border py-2.5">
                <span className="text-sm font-medium text-subtle-foreground">Mode:</span>
                <span className="text-sm font-semibold text-foreground">{isDarkMode ? 'Dark' : 'Light'}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-subtle-foreground">Auto-follow system:</span>
                <span className="text-sm font-semibold text-foreground">{followSystem ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
