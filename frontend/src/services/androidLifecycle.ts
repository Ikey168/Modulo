import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { NavigateFunction } from 'react-router-dom';

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
