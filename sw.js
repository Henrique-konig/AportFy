// =========================================================
// AportFy — service worker
// - Arquivos do app: rede primeiro (sempre a versão mais nova quando online),
//   com cópia em cache para abrir offline.
// - Bibliotecas de CDN (Tailwind, Chart.js, ícones, Firebase SDK): cache
//   primeiro, atualizado em segundo plano.
// - /api, Firestore e cotações: sempre pela rede (dados vivos).
// - Notificações (Firebase Cloud Messaging): mostra o lembrete e, ao tocar,
//   abre o app na aba certa.
// =========================================================

const CACHE = "aportfy-v2";
const SHELL = ["/", "/index.html", "/css/custom.css", "/js/app.js", "/js/ui.js", "/manifest.webmanifest", "/assets/images/favicon.svg", "/assets/images/icon-192.png"];
const CDN_HOSTS = ["cdn.tailwindcss.com", "cdn.jsdelivr.net", "unpkg.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = (res) => res && (res.ok || res.type === "opaque");

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl))) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) return;
    event.respondWith(networkFirst(request, request.mode === "navigate" ? "/index.html" : null));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
});

/* -------------------- Notificações -------------------- */

/** Lê a mensagem do FCM (só "data") ou uma notificação comum. */
function readPush(event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { data: { body: event.data ? event.data.text() : "" } };
  }
  const data = payload.data || {};
  const notification = payload.notification || {};
  return {
    title: data.title || notification.title || "AportFy",
    body: data.body || notification.body || "",
    tag: data.tag || undefined,
    url: data.url || "/",
  };
}

self.addEventListener("push", (event) => {
  const msg = readPush(event);
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: "/assets/images/icon-192.png",
      badge: "/assets/images/icon-192.png",
      data: { url: msg.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        open.navigate(target).catch(() => {});
        return open.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
