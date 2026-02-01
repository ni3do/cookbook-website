// Service Worker for The Kyburz Table
// Provides offline support with cache-first for assets and network-first for pages

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `kyburz-table-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `kyburz-table-dynamic-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Cache expiration time (7 days in milliseconds)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting for existing workers
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName.startsWith('kyburz-table-') &&
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE
            );
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Helper: Check if response is expired
function isExpired(response) {
  if (!response) return true;
  const dateHeader = response.headers.get('sw-cache-date');
  if (!dateHeader) return false;
  const cacheDate = new Date(dateHeader).getTime();
  return Date.now() - cacheDate > CACHE_EXPIRATION;
}

// Helper: Clone response with cache date header
function addCacheDate(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-date', new Date().toISOString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  });
}

// Helper: Check if request is for a static asset
function isStaticAsset(url) {
  const pathname = new URL(url).pathname;
  return (
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  );
}

// Helper: Check if request is for a recipe page
function isRecipePage(url) {
  const pathname = new URL(url).pathname;
  return pathname.startsWith('/recipes/');
}

// Helper: Check if request is for an HTML page
function isHtmlPage(url) {
  const pathname = new URL(url).pathname;
  return (
    pathname === '/' ||
    pathname.startsWith('/recipes/') ||
    pathname.startsWith('/tags/') ||
    !pathname.includes('.')
  );
}

// Fetch event: handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip requests to external domains (except fonts)
  const requestUrl = new URL(url);
  if (
    requestUrl.origin !== self.location.origin &&
    !requestUrl.hostname.includes('fonts.googleapis.com') &&
    !requestUrl.hostname.includes('fonts.gstatic.com')
  ) {
    return;
  }

  // Cache-first strategy for static assets
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Network-first strategy for recipe pages (with caching for offline)
  if (isRecipePage(url) || isHtmlPage(url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Cache-first strategy: check cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse && !isExpired(cachedResponse)) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, addCacheDate(networkResponse.clone()));
    }
    return networkResponse;
  } catch {
    // Return cached response even if expired when network fails
    if (cachedResponse) {
      return cachedResponse;
    }
    throw new Error('No cached response available');
  }
}

// Network-first strategy: try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, addCacheDate(networkResponse.clone()));
    }
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline fallback page if available
    const offlinePage = await caches.match('/');
    if (offlinePage) {
      return offlinePage;
    }
    throw new Error('No cached response available');
  }
}
