import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbDeviceDocuments, setDeviceDocuments } from '../../services/deviceDocuments';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { bartTheme, getThemeByName, themes } from '../themes';

const css = readFileSync(join(__dirname, '../../styles/index.css'), 'utf8');

/** The block the UI actually reads; the Theme object only mirrors it. */
function bartTokens(): Record<string, string> {
  const block = css.match(/\[data-theme='bart'\]\s*\{([\s\S]*?)\n\s*\}/);
  if (!block) return {};
  return Object.fromEntries(
    [...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

function Probe() {
  const { themeName, isDarkMode } = useTheme();
  return (
    <span data-testid="probe">
      {themeName}/{isDarkMode ? 'dark' : 'light'}
    </span>
  );
}

let documents: IndexedDbDeviceDocuments;

describe('Bart theme', () => {
  beforeEach(() => {
    localStorage.clear();
    documents = new IndexedDbDeviceDocuments(new IDBFactory());
    setDeviceDocuments(documents);
    document.documentElement.removeAttribute('data-theme');
  });

  it('is registered and resolvable by name', () => {
    expect(getThemeByName('bart')).toBe(bartTheme);
    expect(themes.map((theme) => theme.name)).toContain('bart');
  });

  it('is the default theme and is treated as dark', () => {
    render(
      <ThemeProvider defaultTheme="bart">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('bart/dark');
  });

  it('applies data-theme so the token block takes effect', () => {
    render(
      <ThemeProvider defaultTheme="bart">
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('bart');
  });

  it('lets a theme saved on this device win over the default', async () => {
    await documents.set('preference.theme', 'light');
    render(
      <ThemeProvider defaultTheme="bart">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('light/light'));
  });

  it('moves a theme chosen in an older build into device storage once', async () => {
    localStorage.setItem('modulo-theme', 'light');
    render(
      <ThemeProvider defaultTheme="bart">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('light/light'));
    expect(localStorage.getItem('modulo-theme')).toBeNull();
    expect(await documents.get('preference.theme')).toBe('light');
  });

  it('defines a token block carrying the KDE scheme colours', () => {
    const tokens = bartTokens();
    // Selection BackgroundNormal #d95a3c -> the accent everything keys off.
    expect(tokens['--primary']).toBe('12 67% 54%');
    // Window/View BackgroundNormal #151414.
    expect(tokens['--background']).toBe('0 2% 8%');
    // View ForegroundNormal #edf0f2.
    expect(tokens['--foreground']).toBe('204 16% 94%');
    // Selection ForegroundLink #fdbc4b drives the focus ring.
    expect(tokens['--ring']).toBe('38 98% 64%');
  });

  it('keeps the Theme object in step with the token block', () => {
    // The object feeds any non-Tailwind consumer; drift between the two is the
    // failure mode this guards.
    expect(bartTheme.colors.brand.primary).toBe('#d95a3c');
    expect(bartTheme.colors.background.primary).toBe('#151414');
    expect(bartTheme.colors.text.primary).toBe('#edf0f2');
    expect(bartTheme.colors.border.focus).toBe('#fdbc4b');
  });

  it('does not reuse the accent hue for warning', () => {
    // Bart's own ForegroundNeutral (#f67400) sits too close to the #d95a3c
    // selection colour to read as a separate state.
    const tokens = bartTokens();
    const hue = (token: string) => Number(tokens[token].split(' ')[0]);
    expect(Math.abs(hue('--warning') - hue('--primary'))).toBeGreaterThan(20);
  });
});
