/* global self ReadableStream Response Headers fetch caches IDBKeyRange */

const CACHE_NAME = 'chillers-cache-v7';

// ── StreamSaver map pour le streaming de téléchargement ────────
const map = new Map();

// ── IndexedDB helpers (miroir de offlineStorage.ts) ────────────
// Le SW doit pouvoir écrire dans IndexedDB indépendamment du main thread.
const IDB_NAME = 'chillers_offline_db';
const IDB_STORE = 'offline_videos';
const IDB_VERSION = 1;

function swOpenOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

async function swSaveOfflineVideo(id, blob, filename, title) {
  try {
    const db = await swOpenOfflineDB();
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(IDB_STORE, 'readwrite');
      const st  = tx.objectStore(IDB_STORE);
      const req = st.put({ id, blob, filename, title, size: blob.size, savedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[SW] swSaveOfflineVideo failed:', err);
  }
}

const OFFLINE_URL = '/offline.html';
const PRECACHE_ASSETS = [
  '/',
  '/downloads',
  '/offline.html',
  '/manifest.json',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.warn('[SW] Precache failed partially:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => {
        return Promise.all(
          keys.map(key => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ── Gestion des messages StreamSaver ──────────────────────────
self.onmessage = event => {
  if (event.data === 'ping') {
    return;
  }

  const data = event.data;
  if (!data) return;

  const downloadUrl =
    data.url ||
    self.registration.scope + Math.random() + '/' + (typeof data === 'string' ? data : data.filename);
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
    },
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
      'X-XSS-Protection': '1; mode=block',
    });

    let headers = new Headers(data.headers || {});
    if (data.size) {
      responseHeaders.set('Content-Length', String(data.size));
    }
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

  // Ne jamais intercepter les chunks HMR ou appels Next internes en dev, ni les API dynamiques et médias vidéo
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

  // 2. Cache-First pour le CSS, JS Chunks, Fonts et Actifs Statiques Next.js
  //    (uniquement même-origine : on ne touche jamais aux URL cross-origin comme les logos)
  const sameOrigin = event.request.url.startsWith(self.registration.scope);
  if (
    sameOrigin &&
    (
      url.includes('/_next/static/') ||
      /\.(css|js|woff2?|png|jpg|jpeg|svg|ico|webp|avif|json|webmanifest)$/i.test(url)
    )
  ) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        if (cachedResponse) {
          // Re-validation en arrière-plan quand la connexion est disponible
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const copy = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(err => {
            console.warn('[SW] Asset fetch failed:', url, err);
          });
      })
    );
    return;
  }

  // 3. Gestion des requêtes RSC Next.js (App Router Client-side routing data)
  if (url.includes('_rsc=') || event.request.headers.get('rsc') === '1') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // 4. Cache des images TMDB (Stale-While-Revalidate)
  if (url.includes('image.tmdb.org')) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cached => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 5. Navigation HTML (Page loads) : Network-first avec fallback sur cache ou page downloads/offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          // Si hors-ligne : tenter de servir la page demandée depuis le cache
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;

          // Si c'est la page /downloads en cache
          const cachedDownloads = await caches.match('/downloads', { ignoreSearch: true });
          if (cachedDownloads) return cachedDownloads;

          // Si c'est la racine /
          const cachedHome = await caches.match('/', { ignoreSearch: true });
          if (cachedHome) return cachedHome;

          // Sinon afficher la page offline
          const offlinePage = await caches.match(OFFLINE_URL, { ignoreSearch: true });
          return offlinePage || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })
    );
  }
});

// ── Background Fetch API (YouTube-style background download) ─────
//
// IMPORTANT : la sauvegarde doit se faire ICI dans le SW, pas dans le main
// thread. Le main thread peut être suspendu ou détruit avant la fin du
// téléchargement. Le SW reçoit cet événement même si l'onglet est fermé.
self.addEventListener('backgroundfetchsuccess', event => {
  const bgFetch = event.registration;

  // bgFetch.id = le taskId passé lors de l'appel backgroundFetch.fetch(id, ...)
  // On le décompose pour récupérer filename et title stockés en metadata.
  const taskId = bgFetch.id;

  event.waitUntil(
    (async () => {
      try {
        const records = await bgFetch.matchAll();

        for (const record of records) {
          let response;
          try {
            response = await record.responseReady;
          } catch (e) {
            console.warn('[SW] BG Fetch record not ready:', e);
            continue;
          }

          if (!response || !response.ok) continue;

          let blob;
          try {
            blob = await response.blob();
          } catch (e) {
            console.warn('[SW] BG Fetch blob extraction failed:', e);
            continue;
          }

          // Lire les métadonnées stockées dans le titre de la tâche
          // Format du titre : "CHILLERS_DL::<filename>::<title>"
          let filename = taskId + '.mp4';
          let title    = taskId;
          const rawTitle = bgFetch.title || '';
          if (rawTitle.startsWith('CHILLERS_DL::')) {
            const parts = rawTitle.slice('CHILLERS_DL::'.length).split('::');
            filename = parts[0] || filename;
            title    = parts[1] || title;
          }

          // Stocker dans IndexedDB — exactement le même schéma que offlineStorage.ts
          await swSaveOfflineVideo(taskId, blob, filename, title);
        }

        await event.updateUI({ title: 'Téléchargement terminé · CHILLERS' });

        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({ type: 'BG_FETCH_SUCCESS', id: taskId });
        }
      } catch (err) {
        console.error('[SW] Background Fetch success handling error:', err);
      }
    })()
  );
});

self.addEventListener('backgroundfetchfail', event => {
  const bgFetch = event.registration;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'BG_FETCH_FAIL',
          id: bgFetch.id,
        });
      }
    })()
  );
});

self.addEventListener('backgroundfetchabort', event => {
  const bgFetch = event.registration;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'BG_FETCH_ABORT',
          id: bgFetch.id,
        });
      }
    })()
  );
});

self.addEventListener('backgroundfetchclick', event => {
  event.waitUntil(self.clients.openWindow('/downloads'));
});
