// 성경 필사 + QT — PWA Service Worker v1.0.0 (2026-11-16)
// 범위(scope)는 './index' — 같은 사이트의 지도 앱(sw.js, 전체), 묵상(devo_sw.js), ISBE(isbe_sw.js)와 겹치지 않게 index.html 만 맡는다.
// 받는 방법: 네트워크 우선(늘 새 판), 끊겼을 때만 저장해 둔 사본. 성경 DB 파일(.bdb)은 건드리지 않는다.
const CACHE_NAME = 'bible-writing-v1.0.0';
const CORE_ASSETS = [
  './index.html',
  './manifest-writing.json',
  './icon-writing-192.png',
  './icon-writing-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await Promise.all(CORE_ASSETS.map(async url => {
        try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) await cache.put(url, r); }
        catch (e) { console.warn('[SW-Writing] 저장 실패(넘어감):', url); }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('bible-writing-') && k !== CACHE_NAME).map(k => caches.delete(k))   // 다른 앱 캐시는 건드리지 않음
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 성경 DB 파일·구글 서비스·번역 등은 브라우저가 직접 처리
  if (/\.bdb$/i.test(url.pathname) || /google|googleapis|gstatic/.test(url.hostname) && !/fonts\./.test(url.hostname)) return;

  // index.html — GitHub Pages 중간 캐시(약 10분)를 건너뛰려고 ?t= 를 붙여 받고, 깨끗한 주소로 저장
  if (url.origin === location.origin && (req.mode === 'navigate' || url.pathname.endsWith('/index.html'))) {
    const fresh = new URL(url); fresh.searchParams.set('t', Date.now());
    const clean = url.origin + url.pathname;
    event.respondWith(
      fetch(fresh.toString(), { cache: 'no-store' }).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE_NAME).then(ca => ca.put(clean, c)); }
        return r.ok ? r : caches.match(clean).then(m => m || r);
      }).catch(() => caches.match(clean).then(m => m || caches.match('./index.html')))
    );
    return;
  }

  // 그 밖: 네트워크 우선 → 끊기면 저장본
  event.respondWith(
    fetch(req, { cache: url.origin === location.origin ? 'no-cache' : 'default' }).then(r => {
      if (r.ok && (url.origin === location.origin || /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname))) {
        const c = r.clone(); caches.open(CACHE_NAME).then(ca => ca.put(req, c));
      }
      return r;
    }).catch(() => caches.match(req))
  );
});
