// 성경지도 PWA Service Worker v4.4.0
// [변경] 네트워크 우선 요청에 cache:'no-store'를 명시해, 서비스워커의 "네트워크 우선" 의도와
// 달리 브라우저 자체 HTTP 캐시에서 오래된 사본을 받아오던 문제를 해결함.
// (fetch()만 쓰면 서비스워커 Cache API는 우회해도 브라우저 HTTP 캐시는 그대로 거칠 수 있음)
const CACHE_NAME = 'bible-map-v4.4.0';

// 핵심 캐시 대상
const CORE_ASSETS = [
  './map.html',
  './manifest.json',
  './placeDatabase.json',
  './personDatabase.json',
  // CDN 라이브러리
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js',
];

// 설치: 핵심 파일 캐시 (설치 시점에도 no-store로 받아 최신 상태로 캐싱)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] 핵심 파일 캐싱 중...');
      await Promise.all(CORE_ASSETS.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) await cache.put(url, res);
        } catch (e) {
          console.warn('[SW] 캐싱 실패(무시하고 진행):', url, e);
        }
      }));
    }).then(() => self.skipWaiting())
  );
});

// 활성화: 이전 버전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] 이전 캐시 삭제:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 요청 처리: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // placeDatabase.json, personDatabase.json은 항상 네트워크 우선 (업데이트 반영), 브라우저 캐시도 우회
  if (url.pathname.endsWith('placeDatabase.json') || url.pathname.endsWith('personDatabase.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 지도 타일은 캐시 우선 (오프라인 지원) — 타일은 자주 안 바뀌므로 그대로 유지
  if (url.hostname.includes('tile.openstreetmap.org') ||
      url.hostname.includes('server.arcgisonline.com') ||
      url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // 일반 요청(map.html 포함): 네트워크 → 캐시 폴백
  // cache:'no-store'로 브라우저 자체 HTTP 캐시까지 우회해서, "고쳤는데 안 바뀐다" 문제를 방지
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response.ok && event.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});