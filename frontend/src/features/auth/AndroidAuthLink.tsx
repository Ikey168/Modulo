import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { InAppBrowser } from '@capacitor/inappbrowser';
import { Capacitor } from '@capacitor/core';
import { useAppDispatch } from '../../store/store';
import { setCredentials, setError } from './authSlice';
import { authService } from './authService';

/** Completes in-app WebView OIDC inside the existing packaged React session. */
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
      const inAppCallback = callback.origin === window.__MODULO_CONFIG__?.serverOrigin &&
        callback.pathname === '/auth/callback' && callback.searchParams.has('state') &&
        (callback.searchParams.has('code') || callback.searchParams.has('error'));
      if (!privateCallback && !inAppCallback) return;
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
        void InAppBrowser.close();
      }
    };
    let stop: (() => void) | undefined;
    let stopBrowser: (() => void) | undefined;
    void App.addListener('appUrlOpen', event => { void accept(event.url); }).then(handle => {
      if (disposed) void handle.remove(); else stop = () => { void handle.remove(); };
    });
    // The isolated Android WebView reports the HTTPS callback after Keycloak
    // redirects. Complete it in the packaged app, where the PKCE verifier lives.
    void InAppBrowser.addListener('browserPageNavigationCompleted', event => {
      if (event.url) void accept(event.url);
    })
      .then(handle => {
        if (disposed) void handle.remove(); else stopBrowser = () => { void handle.remove(); };
      });
    void App.getLaunchUrl().then(result => { if (result?.url) void accept(result.url); });
    return () => { disposed = true; stop?.(); stopBrowser?.(); };
  }, [dispatch, navigate]);
  return null;
}
