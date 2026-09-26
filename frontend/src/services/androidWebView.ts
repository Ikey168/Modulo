/**
 * The packaged app needs a current Android System WebView (ADR 0009): the
 * shared frontend relies on modern CSS and IndexedDB behaviour. An older
 * WebView gets a clear update prompt instead of a partially working app.
 */
export const MINIMUM_WEBVIEW_MAJOR = 120;

export function outdatedWebView(userAgent: string): number | undefined {
  if (!/Android/.test(userAgent)) return undefined;
  const match = /Chrome\/(\d+)\./.exec(userAgent);
  if (!match) return undefined;
  const major = Number(match[1]);
  return major < MINIMUM_WEBVIEW_MAJOR ? major : undefined;
}

export function renderWebViewUpdateRequired(major: number, root: HTMLElement): void {
  root.innerHTML = '';
  const main = document.createElement('main');
  main.setAttribute('role', 'alert');
  main.style.cssText = 'max-width:32rem;margin:15vh auto;padding:1.5rem;font:16px/1.5 system-ui,sans-serif';
  const title = document.createElement('h1');
  title.textContent = 'Update Android System WebView';
  const body = document.createElement('p');
  body.textContent = `Modulo needs Android System WebView ${MINIMUM_WEBVIEW_MAJOR} or newer; this device has ${major}. `
    + 'Update “Android System WebView” (or Chrome) from Google Play, then reopen Modulo. Your offline data is kept.';
  main.append(title, body);
  root.append(main);
}
