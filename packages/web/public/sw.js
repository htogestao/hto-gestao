const CACHE_NAME = 'htogestao-v2'

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
]

// Cache-first só vale pra asset estático do build (hash no nome, imutável).
// Páginas/dados dinâmicos (ex.: navegação interna do Next para /aplicacoes,
// /estoque etc.) precisam sempre ir à rede — nunca ficar presos no cache.
function ehAssetEstatico(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e de outros domínios
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Para navegação: tenta rede primeiro, cai no offline se falhar
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/offline').then((r) => r || new Response('Offline'))
      )
    )
    return
  }

  // Tudo que não é navegação nem asset estático (ex.: fetch de RSC do Next
  // ao trocar de rota pelo menu) passa direto pra rede — não intercepta.
  if (!ehAssetEstatico(new URL(event.request.url))) return

  // Para assets estáticos: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
    })
  )
})
