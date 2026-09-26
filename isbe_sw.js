/* ISBE 앱 전용 서비스 워커 (2026-09-24) — 범위는 ./isbe 로 좁혀 성경지도(map.html, sw.js)와 따로 설치된다.
 * 자료(ISBE 항목)는 앱이 IndexedDB 에 두므로 여기서는 화면 파일만: 인터넷이 되면 늘 새로 받고, 안 되면 마지막 것을 쓴다. */
const CACHE = 'isbe-app-v6';   // 바꿀 때마다 올린다 — 새 워커가 옛 캐시를 지운다
const SHELL = ['./isbe.html', './isbe.webmanifest', './isbe-192.png', './isbe-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('isbe-app-') && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (!SHELL.some(s => u.pathname.endsWith(s.slice(1)))) return;          // isbe_full 조각 따위는 그대로 인터넷에서
  // 늘 새 판을 받는다 — 브라우저 캐시(no-store)와 GitHub Pages 의 중간 캐시(주소 끝 ?t=…)를 모두 건너뛴다.
  // (중간 캐시는 올린 뒤 10분쯤 곳에 따라 옛 판과 새 판을 번갈아 내주었다 — kjm 「4, 5 왔다 갔다」)
  const fresh = new URL(u); fresh.searchParams.set('t', Date.now());
  e.respondWith(fetch(fresh.toString(), { cache: 'no-store' }).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(u.origin + u.pathname, c)); }
      return r.ok ? r : caches.match(u.origin + u.pathname).then(m => m || r);
    }).catch(() => caches.match(u.origin + u.pathname)));
});
