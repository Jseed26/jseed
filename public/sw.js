self.addEventListener('install', (e) => {
  // מכריח את הקובץ החדש להשתלט מיד
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // מוחק את כל המטמון (Cache) הישן והתקוע
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => {
      // משמיד את ה-Service Worker לחלוטין
      self.registration.unregister();
    })
  );
});