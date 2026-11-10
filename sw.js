// アプリ本体をスマホ内に保存して、オフラインでも起動できるようにする
// アプリを更新したら VERSION を変える（app.js の APP_VERSION も合わせる）
const VERSION = 'v2';
const CACHE = 'nippo-' + VERSION;
const FILES = [
  './',
  './index.html',
  './style.css',
  './checklist.js',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nippo-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 送信（POST）や外部サイトへの通信はそのまま通す
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 画面を開くときは、保存済みの本体を使う（オフラインでも開ける）
    event.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
