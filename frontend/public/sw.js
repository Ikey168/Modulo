// Service Worker for Modulo PWA
// Provides offline functionality and caching

// Bumped to v1.2.0 so the activate handler purges the v1.1.0 caches, which
// were polluted with /api responses (incl. app-shell HTML) by the old logic.
const CACHE_NAME = 'modulo-v1.2.0';
const STATIC_CACHE_NAME = 'modulo-static-v1.2.0';
const DYNAMIC_CACHE_NAME = 'modulo-dynamic-v1.2.0';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.tsx',
  '/src/styles/index.css',
  '/src/styles/mobile.css',
  '/src/styles/mobile-interactions.css',
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

  // Never intercept API calls. The SW must not cache or fall back for /api:
  // doing so served stale responses and, for paths the app shell matched,
  // returned index.html for JSON endpoints (e.g. /api/network/status), and
  // hid live backend errors. Let these go straight to the network so the app
  // sees the real backend response. (The app manages its own offline state.)
  if (url.pathname.startsWith('/api')) {
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
  if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request)
            .then((fetchResponse) => {
              return caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                  cache.put(request, fetchResponse.clone());
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
                cache.put(request, fetchResponse.clone());
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
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
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
