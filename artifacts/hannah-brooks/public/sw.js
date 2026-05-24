self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Sophie Rain", body: event.data.text() }; }

  const title = data.title || "Sophie Rain";
  const options = {
    body: data.body || "",
    icon: data.icon || "/logo-hb.png",
    badge: "/logo-hb.png",
    tag: data.tag || "sophie-rain",
    data: { url: data.url || "/admin" },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/admin") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
