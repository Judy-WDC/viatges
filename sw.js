/* Service worker de «Els meus viatges».
   Objectiu: que l'app s'instal·li i que arrenqui SENSE connexió. Com que tot
   (HTML, CSS i JS) va dins d'un sol fitxer, amb desar-lo a la memòria cau ja
   n'hi ha prou perquè funcioni a fora; les dades ja tenen còpia local i
   sincronització amb Supabase quan torna la xarxa.

   Puja el número de versió (CACHE) cada cop que vulguis que els navegadors
   es baixin la versió nova de l'app. */
const CACHE = 'viatges-v2';

/* Fitxers del nucli que es desen en instal·lar. Rutes relatives: es resolen
   respecte de la carpeta on viu el service worker (…/viatges/). */
const NUCLI = [
  './',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon-16.png'
];

/* Mai no es desa a la memòria cau: els mapes, el geocodificador i l'API de
   Supabase són dinàmics o porten sessió; cachejar-los faria mal. */
const MAI_CACHE = [
  /tile\.openstreetmap\.org/,
  /nominatim\.openstreetmap\.org/,
  /\.supabase\.co/
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(NUCLI))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claus => Promise.all(claus.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (MAI_CACHE.some(re => re.test(url.href))) return;   // va directe a la xarxa

  // Navegació (obrir l'app): xarxa primer per tenir sempre l'última versió;
  // si no hi ha connexió, es serveix la còpia desada del nucli.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put('./', copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('./').then(r => r || caches.match(req)))
    );
    return;
  }

  // Resta de peticions GET (icones, fonts, biblioteques externes…):
  // memòria cau primer; si no hi és, xarxa i s'hi desa per a la propera.
  e.respondWith(
    caches.match(req).then(encert => {
      if (encert) return encert;
      return fetch(req).then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        return resp;
      });
    })
  );
});
