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

/** Keep hardware Back within the packaged app's route history. */
export async function startAndroidBackButton(navigate: NavigateFunction): Promise<() => void> {
  if (Capacitor.getPlatform() !== 'android') return () => {};
  const back = await App.addListener('backButton', () => {
    const dialog = document.querySelector('[role="dialog"], [role="alertdialog"]');
    if (dialog) {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    const path = window.location.pathname;
    if (path === '/app/dashboard' || path === '/' || path === '/login') {
      void App.exitApp();
      return;
    }
    const index = Number(window.history.state?.idx);
    if (Number.isFinite(index) && index > 0) navigate(-1);
    else navigate(path.startsWith('/app/') ? '/app/dashboard' : '/', { replace: true });
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
