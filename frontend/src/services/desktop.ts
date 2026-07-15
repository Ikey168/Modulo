/**
 * Detection helpers for the Electron desktop shell (desktop/ package).
 *
 * The shell's preload script exposes `window.moduloDesktop`; in the browser
 * the global is simply absent, so the same bundle runs in both contexts.
 * Use these to branch desktop-only behaviour (e.g. skipping PWA install
 * prompts, native menus) without importing anything Electron-specific.
 */

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && window.moduloDesktop?.isDesktop === true;
}

export function desktopInfo(): Window['moduloDesktop'] {
  return typeof window !== 'undefined' ? window.moduloDesktop : undefined;
}
