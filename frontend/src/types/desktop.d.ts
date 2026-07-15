/**
 * Surface exposed by the Electron desktop shell's preload script
 * (desktop/preload.cjs) via contextBridge. Absent in the browser build.
 */
export {};

declare global {
  interface Window {
    moduloDesktop?: {
      readonly isDesktop: true;
      readonly platform: string;
      readonly versions: {
        readonly electron: string;
        readonly chrome: string;
        readonly node: string;
      };
    };
  }
}
