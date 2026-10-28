/*
 * Service worker cho màn bán hàng: giữ được giao diện khi mất mạng.
 * - /_next/static (JS, CSS có hash trong tên): cache-first, không bao giờ đổi nội dung.
 * - Trang /pos: network-first, mất mạng thì trả bản đã cache.
 * - /api/**: KHÔNG cache (dữ liệu bán hàng đi qua hàng đợi offline của ứng dụng).
 */
const CACHE = "vx-pos-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add("/pos")).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(event.request, copy));
      return res;
    })));
    return;
  }

  if (event.request.mode === "navigate" && url.pathname === "/pos") {
    event.respondWith(fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("/pos", copy));
      return res;
    }).catch(() => caches.match("/pos")));
  }
});
