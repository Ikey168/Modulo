export function workspaceSocketUrl(): string {
  return window.__MODULO_CONFIG__?.serverOrigin
    ? `${window.__MODULO_CONFIG__.serverOrigin}/ws` : '/ws';
}
