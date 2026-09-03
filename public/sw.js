/* global self ReadableStream Response Headers fetch caches */

const CACHE_NAME = 'chillers-cache-v3';
const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// ── StreamSaver map pour le streaming de téléchargement ────────
const map = new Map();

const OFFLINE_URL = '/offline.html';
const PRECACHE_ASSETS = [
  '/',
  '/downloads',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/android-chrome-192x192.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Precache failed partially:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Gestion des messages StreamSaver ──────────────────────────
self.onmessage = event => {
  if (event.data === 'ping') {
    return;
  }

  const data = event.data;
  if (!data) return;

  const downloadUrl = data.url || self.registration.scope + Math.random() + '/' + (typeof data === 'string' ? data : data.filename);
  const port = event.ports && event.ports[0];
  if (!port) return;

  const metadata = new Array(3); // [stream, data, port]
  metadata[1] = data;
  metadata[2] = port;

  if (event.data.readableStream) {
    metadata[0] = event.data.readableStream;
  } else if (event.data.transferringReadable) {
    port.onmessage = evt => {
      port.onmessage = null;
      metadata[0] = evt.data.readableStream;
    };
  } else {
    metadata[0] = createStream(port);
  }

  map.set(downloadUrl, metadata);
  port.postMessage({ download: downloadUrl });
};

function createStream(port) {
  return new ReadableStream({
    start(controller) {
      port.onmessage = ({ data }) => {
        if (data === 'end') {
          return controller.close();
        }
        if (data === 'abort') {
          controller.error('Aborted the download');
          return;
        }
        controller.enqueue(data);
      };
    },
    cancel(reason) {
      port.postMessage({ abort: true });
    }
  });
}

// ── Gestion des requêtes Fetch ────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Interception StreamSaver pour téléchargement local
  if (map.has(url)) {
    const [stream, data, port] = map.get(url);
    map.delete(url);

    const responseHeaders = new Headers({
      'Content-Type': 'application/octet-stream; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Security-Policy': "default-src 'none'",
      'X-WebKit-CSP': "default-src 'none'",
      'X-XSS-Protection': '1; mode=block'
    });

    let headers = new Headers(data.headers || {});
    if (headers.has('Content-Length')) {
      responseHeaders.set('Content-Length', headers.get('Content-Length'));
    }
    if (headers.has('Content-Disposition')) {
      responseHeaders.set('Content-Disposition', headers.get('Content-Disposition'));
    }

    let fileName = typeof data === 'string' ? data : data.filename;
    if (fileName) {
      fileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
      responseHeaders.set('Content-Disposition', "attachment; filename*=UTF-8''" + fileName);
    }

    event.respondWith(new Response(stream, { headers: responseHeaders }));
    if (port) port.postMessage({ debug: 'Download started' });
    return;
  }

  // Ne jamais intercepter les chunks HMR ou appels Next internes en dev, ni les API dynamiques et médias
  if (
    url.includes('/_next/webpack-hmr') ||
    url.includes('/api/') ||
    url.includes('.mp4') ||
    url.includes('.m3u8') ||
    url.includes('/proxy') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // En production/online : Cache des images TMDB (Stale-While-Revalidate)
  if (url.includes('image.tmdb.org')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navigation HTML (Page loads) : Network-first avec fallback sur cache ou page offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Si hors-ligne : tenter de servir la page depuis le cache
          const cached = await caches.match(event.request);
          if (cached) return cached;

          // Si c'est une tentative d'aller sur /downloads, essayer /downloads en cache
          const cachedDownloads = await caches.match('/downloads');
          if (cachedDownloads) return cachedDownloads;

          // Sinon afficher la page offline
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
  }
});
