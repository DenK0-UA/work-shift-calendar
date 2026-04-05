const CACHE_VERSION = 'v5-2026-04-05';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/data/config.js',
    '/js/weather.js',
    '/js/schedule.js',
    '/js/profiles.js',
    '/js/calendar.js',
    '/js/settings-state.js',
    '/js/insights.js',
    '/js/overlay-controller.js',
    '/js/schedule-ui.js',
    '/js/profiles-ui.js',
    '/js/app-update.js',
    '/js/ui.js',
    '/js/native-back.js',
    '/styles/theme.css',
    '/styles/layout.css',
    '/styles/calendar.css',
    '/styles/modal-day.css',
    '/styles/settings-panel.css',
    '/styles/schedule-panel.css',
    '/styles/profiles.css',
    '/styles/responsive.css'
];

// Dynamic cache max age: 7 days
const DYNAMIC_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// External API origins — served with network-first, fallback to cache
const NETWORK_FIRST_ORIGINS = [
    'api.open-meteo.com',
    'date.nager.at'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

function isNetworkFirst(url) {
    return NETWORK_FIRST_ORIGINS.some((origin) => url.hostname === origin);
}

function isCacheableRequest(request) {
    return request.method === 'GET';
}

async function networkFirstWithCache(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            const responseClone = response.clone();
            // Store with timestamp header for TTL check
            const headers = new Headers(responseClone.headers);
            headers.set('sw-cached-at', String(Date.now()));
            const body = await responseClone.arrayBuffer();
            const timestampedResponse = new Response(body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers
            });
            cache.put(request, timestampedResponse);
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) {
            const cachedAt = Number(cached.headers.get('sw-cached-at') || 0);
            if (Date.now() - cachedAt < DYNAMIC_CACHE_MAX_AGE_MS) {
                return cached;
            }
        }
        return Response.error();
    }
}

async function networkFirstForAppShell(request) {
    const cache = await caches.open(STATIC_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        return Response.error();
    }
}

async function cacheFirstWithNetwork(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (!isCacheableRequest(request)) {
        return;
    }

    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirstForAppShell(request));
        return;
    }

    if (isNetworkFirst(url)) {
        event.respondWith(networkFirstWithCache(request));
        return;
    }

    event.respondWith(cacheFirstWithNetwork(request));
});
