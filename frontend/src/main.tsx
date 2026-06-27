import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux'; // Import Provider
import { store } from './store/store';   // Import store
import App from './App';
import './styles/index.css';
import './styles/mobile-layout.css';
import { registerFeature, mountFeature } from '@modulo/core';
import { helloWorldPack } from './features/helloWorld/helloWorldPack';

// Bootstrap built-in feature packs. Each pack declares its capabilities and
// receives a ModuloCoreAPI instance via onMount. Errors are non-fatal — a pack
// failure should never prevent the host app from rendering.
registerFeature(helloWorldPack);
mountFeature(helloWorldPack.id).catch((err) => {
  console.error('[feature-registry] failed to mount', helloWorldPack.id, err);
});

// Service Worker: register only in production. A precaching SW in dev serves a
// stale, cached index.html (cache-first navigation) and breaks HMR, so in dev we
// proactively unregister any existing worker and clear its caches.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available, notify user
                if (confirm('New version available! Reload to update?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });

  // Listen for service worker messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_UPDATED') {
      console.log('Cache updated, new content available');
    }
  });
} else if ('serviceWorker' in navigator) {
  // Dev: tear down any service worker / caches left over from a production build
  // so the dev server's fresh index.html is always served.
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

// Handle PWA install prompt
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button or notification
  console.log('PWA install prompt available');
  
  // Make it available globally for install button
  (window as any).installPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        deferredPrompt = null;
      });
    }
  };
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  deferredPrompt = null;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}> {/* Wrap App with Provider */}
      <App />
    </Provider>
  </React.StrictMode>,
);