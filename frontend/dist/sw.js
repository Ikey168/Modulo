// Service Worker for Modulo PWA
// Provides offline functionality and caching

const CACHE_NAME = 'modulo-v1.0.0';
const STATIC_CACHE_NAME = 'modulo-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'modulo-dynamic-v1.0.0';

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

// API endpoints to cache dynamically
const CACHE_API_PATTERNS = [
  /^\/api\/notes/,
  /^\/api\/tags/,
  /^\/api\/contracts/,
  /^\/api\/auth/,
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

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/')
        .then((response) => {
          return response || fetch(request);
        })
        .catch(() => {
          return caches.match('/');
        })
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

  // Handle API requests (Network First with fallback)
  if (CACHE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Return offline page or error response
              return new Response(
                JSON.stringify({ 
                  error: 'Offline', 
                  message: 'This request requires an internet connection' 
                }), 
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
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
