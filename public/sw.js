const CACHE_NAME = "kidgo-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache static assets, pass through API/Supabase requests
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (url.includes("supabase.co") || url.includes("/api/")) return;

  if (
    event.request.method === "GET" &&
    (url.includes("/_next/static/") || url.includes("/icons/") || url.endsWith(".png") || url.endsWith(".svg"))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
  }
});

// Show notifications triggered from the main thread
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_REMINDER") {
    const { id, titel, ort, datum } = event.data;
    const today = new Date().toISOString().split("T")[0];
    const prefix = datum === today ? "Heute" : "Morgen";
    const body = ort ? `In ${ort.split(",")[0].trim()}` : "Kidgo-Event";
    self.registration.showNotification(`${prefix}: ${titel}`, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `kidgo-reminder-${id}`,
      data: { url: `/events/${id}` },
    });
  }

  if (event.data?.type === "SHOW_WEEKEND_PREVIEW") {
    const { events } = event.data;
    const titles = (events || []).slice(0, 3).map((e) => e.titel).join(", ");
    self.registration.showNotification("Wochenende! 3 Ideen für euch 🎉", {
      body: titles || "Entdecke Events auf kidgo",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "kidgo-weekend-preview",
      data: { url: "/" },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
