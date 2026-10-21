// Service worker del sitio (especificación 6.16 y trampa 21). Se registra como /sw.js?v=<APP_VERSION>: la
// versión nombra las cachés, así una versión nueva nunca sirve archivos de la anterior.
// - Cache-first: /_next/static, /media e /icons (nombres únicos o inmutables).
// - Network-first para las páginas, con respaldo /offline. El HTML no se guarda (solo /offline).
// - Nunca toca /admin, /api, otros orígenes ni peticiones que no sean GET.
// La regla de cada petición es `swStrategy`; tests/unit/sw.test.ts la prueba desde este mismo archivo.

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'
const STATIC_CACHE = `cachorros-static-${VERSION}`
const OFFLINE_CACHE = `cachorros-offline-${VERSION}`
const OFFLINE_URL = '/offline'

const SW_RULES = {
  bypass: ['/admin', '/api/', '/sw.js', '/r/', '/manifest.webmanifest'],
  cacheFirst: ['/_next/static/', '/media/', '/icons/'],
}

/** 'bypass' | 'cache-first' | 'network-first' para una petición. */
function swStrategy(request, origin, rules) {
  if (request.method !== 'GET') return 'bypass'
  const url = new URL(request.url)
  if (url.origin !== origin) return 'bypass'
  if (rules.bypass.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix))) return 'bypass'
  if (rules.cacheFirst.some((prefix) => url.pathname.startsWith(prefix))) return 'cache-first'
  if (request.mode === 'navigate') return 'network-first'
  return 'bypass'
}

/** Solo se guardan respuestas completas, públicas y del mismo origen. */
function cacheable(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false
  const control = response.headers.get('Cache-Control') || ''
  return !/no-store|private/.test(control)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload', credentials: 'omit' }))),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('cachorros-') && key !== STATIC_CACHE && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// La página pide activar la versión nueva cuando la persona acepta el aviso.
self.addEventListener('message', (event) => {
  if (event.data === 'activar') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const strategy = swStrategy(event.request, self.location.origin, SW_RULES)
  if (strategy === 'cache-first') event.respondWith(cacheFirst(event.request))
  else if (strategy === 'network-first') event.respondWith(networkFirst(event.request))
})

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (cacheable(response)) cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  try {
    return await fetch(request)
  } catch {
    const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })
    return offline || Response.error()
  }
}
