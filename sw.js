"use strict";

const CACHE_NAME = "habitclik-static-v14";
const CACHE_PREFIX = "habitclik-static-";
const ASSETS = [
  "./",
  "./index.html",
  "./avisos.html",
  "./styles.css?v=14",
  "./alarm-sounds.js?v=14",
  "./app.js?v=14",
  "./avisos.js?v=14",
  "./phrases.js?v=14",
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
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME) .then((cache) => cache.put(
            new URL(request.url).pathname.endsWith("/avisos.html") ? "./avisos.html" : "./index.html",
            copy
          )));
        }
        return response;
      }) .catch(() => caches.match(
        new URL(request.url).pathname.endsWith("/avisos.html") ? "./avisos.html" : "./index.html"
      ))
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
