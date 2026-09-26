import { Capacitor } from '@capacitor/core';
import { nativeStateCache } from './services/nativeStateCacheBridge';
import { configureAndroidServer } from './services/androidServer';
import { startMobileViewport } from './services/mobileViewport';
import { outdatedWebView, renderWebViewUpdateRequired } from './services/androidWebView';
import { nativeShareBridge } from './services/androidShare';
import { DOWNLOAD_EVENT, installAndroidDownloads } from './services/androidDownloads';
import './styles/index.css';

// Publish platform + viewport state before the first paint so the shell, the
// Android onboarding screen and every safe-area inset are correct on frame one.
startMobileViewport();

async function bootstrap() {
  if (Capacitor.getPlatform() !== 'android') {
    await import('./appEntry');
    return;
  }
  const outdated = outdatedWebView(navigator.userAgent);
  if (outdated !== undefined) {
    renderWebViewUpdateRequired(outdated, document.getElementById('root')!);
    return;
  }
  // `<a download>` does nothing in the WebView; route exports to the system save dialog.
  const share = nativeShareBridge();
  if (share) installAndroidDownloads(share, outcome => window.dispatchEvent(new CustomEvent(DOWNLOAD_EVENT, { detail: outcome })));
  let saved: string | null = null;
  try {
    saved = (await nativeStateCache.server()).origin;
    if (saved) {
      configureAndroidServer(saved);
      await import('./appEntry');
      return;
    }
  } catch (error) {
    console.error('Android server configuration failed:', error);
  }
  const { renderAndroidServerOnboarding } = await import('./features/auth/AndroidServerOnboarding');
  renderAndroidServerOnboarding(saved);
}

void bootstrap().catch(error => {
  console.error('Modulo could not start:', error);
  const root = document.getElementById('root');
  if (root) root.textContent = 'Modulo could not start. Close and reopen the app to retry.';
});
