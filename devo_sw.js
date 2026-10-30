/* 묵상 앱 전용 서비스 워커 (2026-10-29) — 범위는 ./devo 로 좁혀 성경지도(sw.js)·ISBE(isbe_sw.js)와 따로 설치된다.
 * 화면 파일과 묵상 네 권(JSON)을 둔다: 인터넷이 되면 늘 새로 받고, 안 되면 마지막 것을 쓴다. */
const CACHE = 'devo-app-v2';   // 바꿀 때마다 올린다 — 새 워커가 옛 캐시를 지운다
const SHELL = ['./devo.html', './devo.webmanifest', './devo-192.png', './devo-512.png'];
const DATA = ['./spurgeon_me.json', './spurgeon_fc.json', './murray_hc.json', './meyer_dw.json'];
const ALL = SHELL.concat(DATA);
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ALL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('devo-app-') && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (!ALL.some(s => u.pathname.endsWith(s.slice(1)))) return;          // 그 밖(map.html 등)은 그대로 인터넷에서
  // 늘 새 판을 받는다 — 브라우저 캐시(no-store)와 GitHub Pages 중간 캐시(주소 끝 ?t=…)를 건너뛴다.
  const fresh = new URL(u); fresh.search = ''; fresh.searchParams.set('t', Date.now());
  const key = u.origin + u.pathname;
  e.respondWith(fetch(fresh.toString(), { cache: 'no-store' }).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(key, c)); }
      return r.ok ? r : caches.match(key).then(m => m || r);
    }).catch(() => caches.match(key)));
});
