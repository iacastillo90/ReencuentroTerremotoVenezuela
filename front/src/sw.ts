/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const CACHE_STATIC = 'static-v1';
const CACHE_API = 'api-cache';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);
      const manifest = (self.__WB_MANIFEST || []).map((e) => e.url);
      await cache.addAll(manifest);
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_STATIC && k !== CACHE_API)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiCacheStrategy(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navCacheStrategy(request));
    return;
  }

  // Estrategia Cache-First para recursos estáticos (CSS, JS, imágenes)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request);
    })
  );
});

/**
 * Endpoints sensibles que NUNCA deben cachearse en el Service Worker.
 * Datos de personas, búsquedas y admin contienen PII que no debe
 * quedar expuesto en la caché del navegador.
 */
const SENSITIVE_API_PATHS = [
  '/api/persons/mine',
  '/api/admin',
  '/api/auth/me',
  '/api/contacts',
  '/api/matches',
  '/api/search',
];

function isSensitiveApiPath(pathname: string): boolean {
  return SENSITIVE_API_PATHS.some((prefix) => pathname.startsWith(prefix));
}

async function apiCacheStrategy(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // No cachear endpoints sensibles — datos PII
  if (isSensitiveApiPath(url.pathname)) {
    try {
      return await fetch(request);
    } catch {
      return new Response(JSON.stringify({ error: 'Sin conexión' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const cache = await caches.open(CACHE_API);
  const cached = await cache.match(request);

  try {
    const network = await fetch(request);
    if (network.ok) {
      await cache.put(request, network.clone());
    }
    return network;
  } catch {
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Sin conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navCacheStrategy(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const network = await fetch(request);
    if (network.ok) return network;
  } catch {}

  const fallback = await caches.match('/offline.html');
  if (fallback) return fallback;

  return new Response('Sin conexión', { status: 503 });
}

self.addEventListener('sync', ((event: Event) => {
  const syncEvent = event as ExtendableEvent & { tag: string };
  if (syncEvent.tag === 'sync-reports') {
    syncEvent.waitUntil(notifyClients({ type: 'trigger-sync' }));
  }
}) as EventListener);

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'sync-now') {
    event.waitUntil(notifyClients({ type: 'trigger-sync' }));
  }

  if (msg.type === 'skip-waiting') {
    self.skipWaiting();
  }

  if (msg.type === 'get-pending-count') {
    sendPendingCount(event.source as Client);
  }
});

async function notifyClients(data: Record<string, unknown>) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(data);
  }
}

async function sendPendingCount(client: Client) {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineReports', 'readonly');
    const store = tx.objectStore('offlineReports');
    const index = store.index('status');
    const count = await new Promise<number>((resolve, reject) => {
      const req = index.count('pending');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    client.postMessage({ type: 'pending-count', count });
  } catch {
    client.postMessage({ type: 'pending-count', count: 0 });
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ReencuentroDB', 2);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('offlineReports')) {
        const store = db.createObjectStore('offlineReports', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    req.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}
