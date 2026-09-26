/**
 * The Electron shell's native services (desktop/preload.cjs). This module is
 * the only code allowed to read `window.moduloDesktop`; features ask for a
 * capability and get these services only when running in Electron.
 */
export type DesktopServices = NonNullable<Window['moduloDesktop']>;

export function desktopServices(): DesktopServices | undefined {
  return typeof window !== 'undefined' && window.moduloDesktop?.isDesktop === true ? window.moduloDesktop : undefined;
}
