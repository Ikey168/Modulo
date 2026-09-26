// Service Worker for Modulo PWA
// Provides offline functionality and caching

// Bumped to v1.3.1 to refresh the installed app shell and its icon manifest.
const CACHE_NAME = 'modulo-v1.3.1';
const STATIC_CACHE_NAME = 'modulo-static-v1.3.1';
const DYNAMIC_CACHE_NAME = 'modulo-dynamic-v1.3.1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Runtime configuration is public application bootstrap data. Prefer the
  // server, but retain the same deployment's configuration for offline reloads.
  if (url.origin === self.location.origin && url.pathname === '/runtime-config.js') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) { const cache = await caches.open(STATIC_CACHE_NAME); await cache.put(request, response.clone()); }
      return response;
    }).catch(() => caches.match(request)));
    return;
  }

  // Never intercept API calls. The SW must not cache or fall back for /api:
  // doing so served stale responses and, for paths the app shell matched,
  // returned index.html for JSON endpoints (e.g. /api/network/status), and
  // hid live backend errors. Let these go straight to the network so the app
  // sees the real backend response. (The app manages its own offline state.)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname === '/runtime-config.js') {
    return;
  }

  // Handle navigation requests (HTML pages) - Network First so a new deploy's
  // index.html is always picked up; fall back to cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Handle static assets (Cache First strategy)
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request)
            .then((fetchResponse) => {
              return caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                  if (fetchResponse.ok) cache.put(request, fetchResponse.clone());
                  return fetchResponse;
                });
            });
        })
    );
    return;
  }

  // Handle other requests (Stale While Revalidate)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        const fetchPromise = fetch(request)
          .then((fetchResponse) => {
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                if (fetchResponse.ok) cache.put(request, fetchResponse.clone());
              });
            return fetchResponse;
          });

        return response || fetchPromise;
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncOfflineNotes());
  }
  
  if (event.tag === 'sync-contracts') {
    event.waitUntil(syncOfflineContracts());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = { title: 'Modulo', body: event.data.text() };
    }
  }

  const options = {
    title: notificationData.title || 'Modulo',
    body: notificationData.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png?v=2',
    badge: '/icons/icon-72x72.png?v=2',
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/icon-72x72.png?v=2'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png?v=2'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Helper functions
async function syncOfflineNotes() {
  try {
    console.log('Service Worker: Syncing offline notes...');
    
    // Get offline notes from IndexedDB or localStorage
    const offlineNotes = await getOfflineNotes();
    
    if (offlineNotes.length > 0) {
      for (const note of offlineNotes) {
        try {
          const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(note),
          });
          
          if (response.ok) {
            await removeOfflineNote(note.id);
            console.log('Service Worker: Note synced:', note.id);
          }
        } catch (error) {
          console.error('Service Worker: Failed to sync note:', note.id, error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Error syncing notes:', error);
  }
}

async function syncOfflineContracts() {
  try {
    console.log('Service Worker: Syncing offline contracts...');
    // Similar implementation for contracts
  } catch (error) {
    console.error('Service Worker: Error syncing contracts:', error);
  }
}

async function getOfflineNotes() {
  // Placeholder - implement IndexedDB or localStorage logic
  return [];
}

async function removeOfflineNote(noteId) {
  // Placeholder - implement removal logic
  console.log('Removing offline note:', noteId);
}

// The first page's scripts load before this worker controls it. Cache only
// assets that this client actually loaded, preserving lazy plugin loading.
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_LOADED_ASSETS' || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls)].filter(value => {
    try { const url = new URL(value, self.location.origin); return url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname === '/runtime-config.js'); }
    catch { return false; }
  }).slice(0, 1000);
  event.waitUntil(caches.open(STATIC_CACHE_NAME).then(cache => Promise.allSettled(urls.map(url => cache.add(url)))));
});
