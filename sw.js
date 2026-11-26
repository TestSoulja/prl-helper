/* Офлайн-кэш. Меняй VERSION при обновлении файлов. */
const VERSION = 'opora-v0.8.6';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './content.js',
  './store.js',
  './db.js',
  './rank.js',
  './nav.js',
  './topics.js',
  './meds.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

/**
 * Свой кэш по имени, а не «любой найденный».
 *
 * `caches.match()` ищет по всем кэшам и отдаёт первый по порядку создания.
 * Пока новое поколение ставится, рядом лежит старое — и файл может прийти
 * из чужого. 25.11.2026 это дало экран, где «Версия 0.8.4» стояла рядом
 * с кодом 0.8.2: HTML пришёл по сети, а `app.js` — из старого кэша.
 */
const own = () => caches.open(VERSION);

self.addEventListener('install', (event) => {
  event.waitUntil(
    own()
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            // `cache: 'reload'` — мимо кэша браузера: у Pages
            // `Cache-Control: max-age=600`, и новый кэш иначе мог бы
            // получить байты прошлой версии и остаться с ними навсегда.
            fetch(new Request(url, { cache: 'reload' })).then((res) => {
              if (!res.ok) throw new Error(`${url}: ${res.status}`);
              return cache.put(url, res);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const fromOwn = (key) => own().then((cache) => cache.match(key));

  // Оболочка — из своего кэша: HTML и код всегда одного поколения, и старт
  // не ждёт сети (в накат это секунды). Новое поколение приходит через
  // обновление service worker, а не вперемешку с ним.
  if (req.mode === 'navigate') {
    event.respondWith(
      fromOwn('./index.html').then((hit) => hit || fetch(req).catch(() => Response.error())),
    );
    return;
  }

  event.respondWith(
    fromOwn(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            // Запись не теряется, если worker усыпят сразу после ответа.
            event.waitUntil(own().then((cache) => cache.put(req, copy)));
          }
          return res;
        })
        .catch(() => fromOwn('./index.html').then((r) => r || Response.error()));
    }),
  );
});
