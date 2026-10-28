const APP_BASE = new URL('./', self.registration.scope);
const CACHE_NAME = `mahub-kull-v2:${APP_BASE.pathname}`;
const INDEX_URL = new URL('index.html', APP_BASE).href;
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'assets/items.png']
  .map(path => new URL(path, APP_BASE).href);

async function cacheApplication() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(SHELL);
  const html = await (await cache.match(INDEX_URL, { ignoreVary: true })).text();
  const entries = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], APP_BASE));
  const seen = new Set(SHELL);
  async function cacheAsset(url) {
    if (url.origin !== APP_BASE.origin || !url.pathname.startsWith(APP_BASE.pathname)
      || !/^https?:$/.test(url.protocol) || seen.has(url.href)) return;
    seen.add(url.href);
    const response = await fetch(url.href, { cache: 'reload' });
    if (!response.ok) throw new Error(`Cannot cache app asset: ${url.pathname}`);
    await cache.put(url.href, response.clone());
    if (url.pathname.endsWith('.css')) {
      const css = await response.text();
      // A data SVG can itself contain url(#filter). Match the entire quoted
      // outer URL first, so its internal filter is never fetched as a file.
      const dependencies = [...css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^'"\s][^)]*?))\s*\)/gs)]
        .map(match => (match[2] ?? match[3]).trim())
        .filter(value => !/^(?:data:|#)/i.test(value))
        .map(value => new URL(value, url));
      await Promise.all(dependencies.map(cacheAsset));
    }
  }
  await Promise.all(entries.map(cacheAsset));
}
self.addEventListener('install', event => {
  event.waitUntil(cacheApplication().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names
      .filter(name => name.startsWith('mahub-kull-v')
        && name.endsWith(`:${APP_BASE.pathname}`) && name !== CACHE_NAME)
      .map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== APP_BASE.origin
    || !url.pathname.startsWith(APP_BASE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(INDEX_URL, { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // The Origin header on module requests must not prevent offline cache hits.
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
