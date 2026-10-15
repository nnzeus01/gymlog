// GymLog — service worker v3.14.2 (2026-10-15)
//
// Compito unico: far aprire l'app anche senza rete, dall'icona sulla Home.
// Non tocca mai i dati degli allenamenti (restano nel localStorage della
// pagina): qui si salvano solo i file dell'app.
//
// Strategia "prima la copia, poi l'aggiornamento":
// - l'app si apre subito dalla copia salvata nel telefono;
// - se c'è rete, intanto scarica la versione pubblicata e la salva;
// - quindi, dopo aver caricato una nuova versione su GitHub, la si vede
//   alla SECONDA apertura con rete (la prima scarica, la seconda mostra).
// Per aggiornare l'app non serve modificare questo file.

const CACHE = 'gymlog-cache';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Elimina solo le vecchie cache di GymLog (nomi che iniziano con
  // "gymlog-"). Le cache delle altre app pubblicate sullo stesso account
  // GitHub (es. Mind Flayer Mobile) non vengono toccate.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('gymlog-') && k !== CACHE)
            .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Solo letture dal proprio sito: tutto il resto passa senza intervento.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Ogni apertura della pagina (con o senza "/index.html", con o senza
  // parametri) usa la stessa copia salvata.
  const key = req.mode === 'navigate' ? './index.html' : req;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const fromNet = fetch(req)
        .then(res => {
          if (res && res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);               // offline: si usa la copia
      if (cached) {
        event.waitUntil(fromNet);         // aggiorna in background
        return cached;
      }
      const res = await fromNet;
      return res || Response.error();
    })
  );
});
