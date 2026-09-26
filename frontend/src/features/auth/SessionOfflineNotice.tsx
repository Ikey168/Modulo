import { useEffect, useReducer } from 'react';
import { authService } from './authService';
import { SystemBanner } from '../workspace/mobile/SystemBanner';

/**
 * Distinguishes "signed in, no connection" from an ended session: offline, the
 * account's cached records, queued edits and drafts stay usable and the session
 * renews on reconnect; an expired or revoked session goes to the login screen.
 */
export function SessionOfflineNotice() {
  const [, redraw] = useReducer(n => n + 1, 0);
  useEffect(() => authService.subscribeSession(redraw), []);
  if (!authService.isOffline()) return null;
  return <SystemBanner tone="neutral" aria-label="Offline session">
    <span className="min-w-0 flex-1">
      You are offline. Your changes and drafts are kept on this device and synchronize when the connection returns.
    </span>
  </SystemBanner>;
}
