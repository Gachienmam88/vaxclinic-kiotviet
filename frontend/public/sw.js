/*
 * Service worker cho màn bán hàng: giữ được giao diện khi mất mạng.
 * - /_next/static (JS, CSS có hash trong tên): cache-first, không bao giờ đổi nội dung.
 * - Trang /sale: network-first, mất mạng thì trả bản đã cache.
 * - /data/** (danh mục tĩnh, vd. đơn vị hành chính): stale-while-revalidate → giao hàng offline vẫn chọn được khu vực.
 * - /api/**: KHÔNG cache (dữ liệu bán hàng đi qua hàng đợi offline của ứng dụng).
 */
const CACHE = "vx-sale-v2"; // đổi tên cache → bản cũ bị xóa ở "activate"
const PRECACHE = ["/sale", "/data/vn-admin-2025.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => undefined)))));
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

  if (url.pathname.startsWith("/data/")) {
    event.respondWith(caches.match(event.request).then((hit) => {
      const net = fetch(event.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); }
        return res;
      });
      if (!hit) return net;
      net.catch(() => undefined);
      return hit;
    }));
    return;
  }

  if (event.request.mode === "navigate" && url.pathname === "/sale") {
    event.respondWith(fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("/sale", copy));
      return res;
    }).catch(() => caches.match("/sale")));
  }
});
