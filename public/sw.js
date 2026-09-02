// Service Worker for PWA and Offline Support
const CACHE_NAME = 'inventory-app-v1';
const STATIC_CACHE = 'inventory-static-v1';
const DYNAMIC_CACHE = 'inventory-dynamic-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/robots.txt'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
  /\/api\/products/,
  /\/api\/orders/,
  /\/api\/inventory/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
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

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (request.destination === 'document') {
    event.respondWith(handlePageRequest(request));
  } else {
    event.respondWith(handleAssetRequest(request));
  }
});

// Handle API requests with cache-first strategy for GET, network-only for mutations
async function handleApiRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);

  // For GET requests, try cache first
  if (request.method === 'GET') {
    try {
      // Check if this endpoint should be cached
      const shouldCache = API_CACHE_PATTERNS.some(pattern => 
        pattern.test(request.url)
      );

      if (shouldCache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          console.log('Service Worker: Serving API from cache', request.url);
          
          // Try to update cache in background
          fetch(request)
            .then(response => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
            })
            .catch(() => {
              // Ignore network errors in background update
            });

          return cachedResponse;
        }
      }

      // Fetch from network
      const networkResponse = await fetch(request);
      
      if (networkResponse.ok && shouldCache) {
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      console.log('Service Worker: API request failed, checking cache', request.url);
      
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline response
      return new Response(
        JSON.stringify({
          error: 'Offline - data not available',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // For non-GET requests (POST, PUT, DELETE), always try network
  try {
    return await fetch(request);
  } catch (error) {
    // For mutations, we can't serve from cache
    return new Response(
      JSON.stringify({
        error: 'Offline - cannot perform this action',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle page requests
async function handlePageRequest(request) {
  try {
    // Try network first for pages
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Serve from cache if network fails
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to index.html for SPA routing
    return cache.match('/index.html') || 
           caches.match('/index.html') ||
           new Response('Offline - Page not available', { status: 503 });
  }
}

// Handle static asset requests
async function handleAssetRequest(request) {
  // Try cache first for assets
  const staticCache = await caches.open(STATIC_CACHE);
  const dynamicCache = await caches.open(DYNAMIC_CACHE);
  
  let cachedResponse = await staticCache.match(request);
  if (!cachedResponse) {
    cachedResponse = await dynamicCache.match(request);
  }
  
  if (cachedResponse) {
    console.log('Service Worker: Serving asset from cache', request.url);
    return cachedResponse;
  }
  
  // Fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      dynamicCache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Asset request failed', request.url);
    
    // For images, return a placeholder
    if (request.destination === 'image') {
      return new Response(
        '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em">Offline</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'inventory-sync') {
    event.waitUntil(syncInventoryData());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New inventory update available',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/favicon.ico'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Inventory Management', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow('/dashboard')
    );
  }
});

// Sync inventory data function
async function syncInventoryData() {
  try {
    console.log('Service Worker: Syncing inventory data');
    
    // This would integrate with your offline manager
    // For now, just log the attempt
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: Date.now() })
    });
    
    if (response.ok) {
      console.log('Service Worker: Sync successful');
    } else {
      console.log('Service Worker: Sync failed');
    }
  } catch (error) {
    console.error('Service Worker: Sync error', error);
  }
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'CLEAR_CACHE':
        clearAllCaches();
        break;
      case 'SYNC_NOW':
        syncInventoryData();
        break;
      default:
        console.log('Service Worker: Unknown message type', event.data.type);
    }
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('Service Worker: All caches cleared');
}