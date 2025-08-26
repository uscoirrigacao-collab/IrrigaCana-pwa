// sw.js — cache básico para PWA offline (GitHub Pages compatível)
const CACHE_NAME = "irriga-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-144.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// instala e faz cache do app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((asset) =>
          fetch(asset)
            .then((res) => {
              if (res.ok) cache.put(asset, res.clone());
            })
            .catch(() => {
              console.warn("⚠ Não foi possível cachear:", asset);
            })
        )
      );
    })
  );
  self.skipWaiting();
});

// ativa e limpa caches antigos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// estratégia: cache-first para assets principais, network-first para o resto
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const requestURL = new URL(e.request.url);

  // Se o arquivo é um dos assets principais, usa cache-first
  if (CORE_ASSETS.some((asset) => requestURL.pathname.endsWith(asset.replace("./", "/")))) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        return (
          cached ||
          fetch(e.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            return res;
          })
        );
      })
    );
  } else {
    // network-first com fallback para index.html (SPA / GitHub Pages fix)
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => {
          return (
            caches.match(e.request) ||
            caches.match("./index.html") ||
            caches.match("/")
          );
        })
    );
  }
});
