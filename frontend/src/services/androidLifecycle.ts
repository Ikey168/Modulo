import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { NavigateFunction } from 'react-router-dom';
import { deviceDocuments, type DeviceDocuments } from './deviceDocuments';

/** Resume the existing workspace and Notes synchronization when the Android app returns. */
export async function startAndroidLifecycle(): Promise<() => void> {
  if (Capacitor.getPlatform() !== 'android') return () => {};
  const resume = await App.addListener('resume', () => {
    window.dispatchEvent(new Event('focus'));
  });
  return () => { void resume.remove(); };
}

/**
 * Overlays Back closes before it navigates: dialogs, sheets, and open Radix
 * menus, listboxes and popovers. The most recently opened one is last in the DOM.
 */
const OVERLAY_SELECTOR = [
  '[role="dialog"]', '[role="alertdialog"]',
  '[role="menu"][data-state="open"]', '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper] [data-state="open"]',
].join(', ');

export function topmostOverlay(root: ParentNode = document): Element | undefined {
  const open = [...root.querySelectorAll(OVERLAY_SELECTOR)];
  return open[open.length - 1];
}

const ROOT_PATHS = new Set(['/app/dashboard', '/', '/login']);

export type AndroidBackAction =
  | { kind: 'close-overlay'; overlay: Element }
  | { kind: 'history-back' }
  | { kind: 'replace'; path: string }
  | { kind: 'exit' };

/** What hardware Back does in the current state; pure so it can be tested without a device. */
export function androidBackAction(path: string, historyIndex: unknown, root: ParentNode = document): AndroidBackAction {
  const overlay = topmostOverlay(root);
  if (overlay) return { kind: 'close-overlay', overlay };
  if (ROOT_PATHS.has(path)) return { kind: 'exit' };
  const index = Number(historyIndex);
  if (Number.isFinite(index) && index > 0) return { kind: 'history-back' };
  return { kind: 'replace', path: path.startsWith('/app/') ? '/app/dashboard' : '/' };
}

export interface AndroidBackOptions {
  /**
   * Called before Back leaves the app. Resolve false to stay, e.g. because
   * unsaved work could not be committed anywhere.
   */
  beforeExit?: () => Promise<boolean>;
}

/** Keep hardware Back within the packaged app's route history. */
export async function startAndroidBackButton(navigate: NavigateFunction, options: AndroidBackOptions = {}): Promise<() => void> {
  if (Capacitor.getPlatform() !== 'android') return () => {};
  let exiting = false;
  const back = await App.addListener('backButton', () => {
    const action = androidBackAction(window.location.pathname, window.history.state?.idx);
    switch (action.kind) {
      case 'close-overlay':
        // Radix and the shared sheets dismiss on Escape; the event bubbles to their document listener.
        action.overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      case 'history-back':
        navigate(-1);
        return;
      case 'replace':
        navigate(action.path, { replace: true });
        return;
      case 'exit':
        if (exiting) return;
        exiting = true;
        void (options.beforeExit?.() ?? Promise.resolve(true))
          .catch(() => false)
          .then(leave => { if (leave) void App.exitApp(); })
          .finally(() => { exiting = false; });
    }
  });
  return () => { void back.remove(); };
}

const ROUTE_DOCUMENT = 'shell.route';
/** Android may recreate the process while the app is backgrounded; return there, not to the dashboard. */
const ROUTE_MEMORY_MS = 12 * 60 * 60 * 1000;

export async function rememberAndroidRoute(path: string, documents: DeviceDocuments = deviceDocuments(), now = Date.now()): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || !path.startsWith('/app/')) return;
  await documents.set(ROUTE_DOCUMENT, { path, at: now });
}

/** The route to reopen after process recreation, or undefined for a fresh start or a deep link. */
export async function androidRouteToRestore(currentPath: string, documents: DeviceDocuments = deviceDocuments(),
  now = Date.now()): Promise<string | undefined> {
  if (Capacitor.getPlatform() !== 'android') return undefined;
  if (currentPath !== '/' && currentPath !== '/app/dashboard') return undefined;
  const saved = await documents.get<{ path?: unknown; at?: unknown }>(ROUTE_DOCUMENT);
  if (!saved || typeof saved.path !== 'string' || typeof saved.at !== 'number') return undefined;
  if (!saved.path.startsWith('/app/') || saved.path === currentPath || now - saved.at > ROUTE_MEMORY_MS) return undefined;
  return saved.path;
}

/**
 * The in-app route of a `com.modulo:/open?route=/app/...` link (reminder
 * notifications, #494), or undefined. Only workspace routes are accepted, so a
 * link from another app cannot navigate to an arbitrary URL.
 */
export function appRouteFromUrl(url: string): string | undefined {
  let link: URL;
  try { link = new URL(url); } catch { return undefined; }
  if (link.protocol !== 'com.modulo:' || link.hostname || link.pathname !== '/open') return undefined;
  const route = link.searchParams.get('route') ?? '';
  let parsed: URL;
  try { parsed = new URL(route, 'https://modulo.invalid'); } catch { return undefined; }
  if (parsed.origin !== 'https://modulo.invalid' || !route.startsWith('/app/') || !parsed.pathname.startsWith('/app/')) return undefined;
  return parsed.pathname + parsed.search;
}
