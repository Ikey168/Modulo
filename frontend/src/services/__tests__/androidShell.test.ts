import { afterEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ name: 'android' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform.name } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }));
import { App } from '@capacitor/app';
import { androidBackAction, androidRouteToRestore, appRouteFromUrl, rememberAndroidRoute, startAndroidBackButton } from '../androidLifecycle';
import { outdatedWebView, renderWebViewUpdateRequired } from '../androidWebView';
import type { DeviceDocuments } from '../deviceDocuments';

const memory = (): DeviceDocuments => {
  const values = new Map<string, unknown>();
  return { get: async <T,>(key: string) => values.get(key) as T | undefined, set: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); }, removeIfEqual: async () => false };
};
afterEach(() => { platform.name = 'android'; });

describe('Android process recreation', () => {
  it('reopens the last route when the recreated app starts on the dashboard', async () => {
    const documents = memory();
    await rememberAndroidRoute('/app/notes?note=42', documents, 1_000);
    expect(await androidRouteToRestore('/app/dashboard', documents, 2_000)).toBe('/app/notes?note=42');
  });
  it('respects a deep link, stale routes and non-app paths', async () => {
    const documents = memory();
    await rememberAndroidRoute('/app/notes', documents, 0);
    expect(await androidRouteToRestore('/app/calendar', documents, 1)).toBeUndefined();
    expect(await androidRouteToRestore('/app/dashboard', documents, 13 * 60 * 60 * 1000)).toBeUndefined();
    await rememberAndroidRoute('/login', documents, 5);
    expect(await androidRouteToRestore('/', documents, 6)).toBe('/app/notes');
  });
  it('does nothing outside Android', async () => {
    platform.name = 'web';
    const documents = memory();
    await rememberAndroidRoute('/app/notes', documents, 0);
    expect(await documents.get('shell.route')).toBeUndefined();
    expect(await androidRouteToRestore('/app/dashboard', documents, 1)).toBeUndefined();
  });
});

describe('Android WebView floor', () => {
  const ua = (major: number) => `Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/${major}.0.6099.0 Mobile Safari/537.36`;
  it('flags WebViews older than the supported floor only', () => {
    expect(outdatedWebView(ua(119))).toBe(119);
    expect(outdatedWebView(ua(120))).toBeUndefined();
    expect(outdatedWebView('Mozilla/5.0 (X11; Linux x86_64) Chrome/90.0.0.0 Safari/537.36')).toBeUndefined();
  });
  it('renders an actionable update message', () => {
    const root = document.createElement('div');
    renderWebViewUpdateRequired(110, root);
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('WebView 120 or newer; this device has 110');
  });
});

describe('Android Back', () => {
  const dom = (html: string) => { const root = document.createElement('div'); root.innerHTML = html; return root; };

  it('closes the topmost overlay before navigating', () => {
    const root = dom('<div role="dialog" id="sheet"></div><div role="menu" data-state="open" id="menu"></div>');
    expect(androidBackAction('/app/notes', 3, root)).toEqual({ kind: 'close-overlay', overlay: root.querySelector('#menu') });
    root.querySelector('#menu')!.setAttribute('data-state', 'closed');
    expect(androidBackAction('/app/dashboard', 0, root)).toEqual({ kind: 'close-overlay', overlay: root.querySelector('#sheet') });
  });

  it('walks history, falls back to the dashboard and exits from a root route', () => {
    const root = dom('');
    expect(androidBackAction('/app/notes', 2, root)).toEqual({ kind: 'history-back' });
    expect(androidBackAction('/app/notes', 0, root)).toEqual({ kind: 'replace', path: '/app/dashboard' });
    expect(androidBackAction('/settings', undefined, root)).toEqual({ kind: 'replace', path: '/' });
    expect(androidBackAction('/app/dashboard', 4, root)).toEqual({ kind: 'exit' });
  });

  it('asks the unsaved-work guard before leaving the app', async () => {
    let press: () => void = () => {};
    vi.mocked(App.addListener).mockImplementation((async (_event: string, handler: (event: { canGoBack: boolean }) => void) => {
      press = () => handler({ canGoBack: false });
      return { remove: async () => {} };
    }) as unknown as typeof App.addListener);
    window.history.replaceState({ idx: 0 }, '', '/app/dashboard');
    let allow = false;
    const beforeExit = vi.fn(async () => allow);
    const stop = await startAndroidBackButton(vi.fn(), { beforeExit });

    press();
    await vi.waitFor(() => expect(beforeExit).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(App.exitApp).not.toHaveBeenCalled();

    allow = true;
    press();
    await vi.waitFor(() => expect(App.exitApp).toHaveBeenCalledTimes(1));
    stop();
    window.history.replaceState(null, '', '/');
  });
});

describe('notification deep links', () => {
  it('accepts only workspace routes from com.modulo:/open', () => {
    expect(appRouteFromUrl('com.modulo:/open?route=%2Fapp%2Freminders-notifications%3Frecord%3Dr1')).toBe('/app/reminders-notifications?record=r1');
    expect(appRouteFromUrl('com.modulo:/open?route=https%3A%2F%2Fevil.example%2Fapp%2F')).toBeUndefined();
    expect(appRouteFromUrl('com.modulo:/open?route=%2F%2Fevil.example%2Fapp%2Fx')).toBeUndefined();
    expect(appRouteFromUrl('com.modulo:/open?route=%2Flogin')).toBeUndefined();
    expect(appRouteFromUrl('com.modulo:/oauth2redirect?code=1')).toBeUndefined();
  });
});
