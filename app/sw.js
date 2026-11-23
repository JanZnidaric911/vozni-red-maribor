/* Service worker: vedno najprej sveže datoteke s spleta (samodejne posodobitve),
   brez interneta pa zadnja shranjena kopija. Oznako 20261123-143359 zamenja skripta objavi.ps1. */
const BUILD = '20261123-143359';
const CACHE = 'voznired-' + BUILD;
const CORE = ['./', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/extra.css', 'css/account.css', 'css/maps.css',
  'js/build.js', 'js/config.js', 'js/data.js', 'js/roads.js', 'js/route3d.js', 'js/map3d.js', 'js/stopmap.js', 'js/avatar.js', 'js/account.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('voznired-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const lib = url.hostname === 'unpkg.com' && url.pathname.includes('maplibre-gl@');
  if (!same && !fonts && !lib) return;               // Supabase, zemljevidi … gredo mimo
  if (same && url.pathname.endsWith('/version.json')) return;   // preverjanje posodobitev vedno z omrežja

  if (lib || fonts) {
    // knjižnice z različico in pisave: najprej iz shrambe
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    })));
    return;
  }
  // lastne datoteke: najprej omrežje (z obnovitvijo HTTP predpomnilnika), sicer shramba
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
