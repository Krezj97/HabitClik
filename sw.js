"use strict";

const CACHE_NAME = "habitclik-static-v22";
const CACHE_PREFIX = "habitclik-static-";
const ASSETS = [
  "./",
  "./index.html",
  "./avisos.html",
  "./privacy.html",
  "./styles.css?v=22",
  "./alarm-sounds.js?v=22",
  "./progress.js?v=22",
  "./native-notifications.js?v=22",
  "./native-backup.js?v=22",
  "./app.js?v=22",
  "./avisos.js?v=22",
  "./phrases.js?v=22",
  "./sounds/campanas.mp3",
  "./sounds/digital.mp3",
  "./sounds/clasica.mp3",
  "./sounds/alegre.mp3",
  "./sounds/energia.mp3",
  "./fonts/nunito-sans-latin-wght-normal.woff2",
  "./art/amanecer.svg",
  "./art/enfoque.svg",
  "./art/bosque.svg",
  "./art/celebracion.svg",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin ||
      !request.url.startsWith(self.registration.scope)) return;

  // Try the network for documents; retain the last successful shell for offline access.
  if (request.mode === "navigate") {
    const path = new URL(request.url).pathname;
    const documentKey = path.endsWith("/avisos.html") ? "./avisos.html"
      : path.endsWith("/privacy.html") ? "./privacy.html" : "./index.html";
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(documentKey, copy)));
        }
        return response;
      }).catch(() => caches.match(documentKey))
    );
    return;
  }

  // Prefer fresh JavaScript/CSS after updates; fall back to cached assets offline.
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (tabs) => {
      const existing = tabs.find((tab) => tab.url.startsWith(self.registration.scope));
      if (existing && "focus" in existing) return existing.focus();
      if (self.clients.openWindow) return self.clients.openWindow(self.registration.scope);
    })
  );
});
