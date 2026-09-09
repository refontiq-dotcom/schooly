// Service Worker PWA Schooly Parent — stratégie cache-first + offline support
const CACHE_NAME = "schooly-parent-v1"
const PRECACHE_URLS = ["/", "/dashboard", "/manifest.json"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ne pas intercepter les requêtes API Supabase (données sensibles)
  if (url.hostname.includes("supabase")) return

  // GET : stratégie network-first avec fallback cache (hors-ligne)
  if (request.method === "GET") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Autres méthodes : réseau uniquement
  event.respondWith(fetch(request))
})