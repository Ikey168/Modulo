import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useAppDispatch } from '../../store/store';
import { setCredentials, setError } from './authSlice';
import { authService } from './authService';

/** Completes the system-browser OIDC login when Android returns through com.modulo:/oauth2redirect. */
export function AndroidAuthLink() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let disposed = false;
    let working = false;
    const seen = new Set<string>();
    const accept = async (url: string) => {
      let callback: URL;
      try { callback = new URL(url); } catch { return; }
      const privateCallback = callback.protocol === 'com.modulo:' && !callback.hostname &&
        (callback.pathname === '/oauth2redirect' || callback.pathname === '/logout');
      if (!privateCallback) return;
      if (working || seen.has(url)) return;
      working = true; seen.add(url);
      try {
        if (privateCallback && callback.pathname === '/logout') {
          await authService.handleNativeLogout(url);
          if (!disposed) navigate('/login', { replace: true });
        } else {
          const user = await authService.handleCallback(url);
          if (!disposed) {
            dispatch(setCredentials({ user: { id: user.id, name: user.name, email: user.email,
              roles: user.roles, authProvider: 'oidc' }, token: user.accessToken }));
            navigate(authService.takeNativeReturnTo(), { replace: true });
          }
        }
      } catch (error) {
        if (!disposed) {
          dispatch(setError(error instanceof Error ? error.message : 'Sign in could not finish. Try again.'));
          navigate('/login', { replace: true });
        }
      } finally {
        working = false;
        void Browser.close().catch(() => { /* Custom Tabs close themselves when the app returns. */ });
      }
    };
    let stop: (() => void) | undefined;
    void App.addListener('appUrlOpen', event => { void accept(event.url); }).then(handle => {
      if (disposed) void handle.remove(); else stop = () => { void handle.remove(); };
    });
    void App.getLaunchUrl().then(result => { if (result?.url) void accept(result.url); });
    return () => { disposed = true; stop?.(); };
  }, [dispatch, navigate]);
  return null;
}
