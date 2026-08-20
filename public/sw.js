// Minimal service worker — exists only so the browser considers ARC
// installable (milestone-4-spec.md §7). Deliberately does nothing else:
// no push handler, no notification permission request, no offline cache
// strategy (an offline write queue is explicitly deferred —
// architecture-and-ux-v1.0.md §6). Every fetch passes straight through.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: intentionally does not call event.respondWith, so the request
  // falls through to the network exactly as if there were no worker.
});
