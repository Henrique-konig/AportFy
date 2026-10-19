// =========================================================
// AportFy — push.js
// Notificações com o app fechado (Firebase Cloud Messaging).
// O aparelho gera um token, que fica em users/{uid}/pushTokens; uma
// função agendada na Vercel (api/notificacoes.js) manda os lembretes
// uma vez por dia. As mensagens chegam no service worker (sw.js).
// =========================================================

import app from "./firebase-config.js";

const MESSAGING_URL = "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";

/** O navegador consegue receber notificações? (iPhone: só com o app instalado, iOS 16.4+) */
export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

async function messagingParts() {
  const mod = await import(MESSAGING_URL);
  if (!(await mod.isSupported())) throw new Error("Notificações não suportadas neste navegador.");
  return { mod, messaging: mod.getMessaging(app), registration: await navigator.serviceWorker.ready };
}

/** Token deste aparelho, sem pedir permissão (null se ainda não autorizado). */
export async function currentPushToken() {
  if (pushPermission() !== "granted") return null;
  try {
    const { mod, messaging, registration } = await messagingParts();
    return await mod.getToken(messaging, { serviceWorkerRegistration: registration });
  } catch (err) {
    console.warn("Não foi possível ler o token de notificação:", err);
    return null;
  }
}

/** Pede permissão e devolve o token do aparelho. */
export async function enablePush() {
  if (!pushSupported()) throw new Error("Este navegador não recebe notificações.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Permissão negada no navegador." : "Permissão não concedida.");
  const { mod, messaging, registration } = await messagingParts();
  return mod.getToken(messaging, { serviceWorkerRegistration: registration });
}

/** Apaga o token deste aparelho (para de receber). */
export async function disablePush() {
  const { mod, messaging } = await messagingParts();
  await mod.deleteToken(messaging).catch(() => {});
}

/** Notificação local de teste (confirma que a permissão e o service worker funcionam). */
export async function showTestNotification() {
  const registration = await navigator.serviceWorker.ready;
  return registration.showNotification("AportFy", {
    body: "Tudo certo! Os lembretes de contas, faturas e proventos vão chegar assim.",
    icon: "/assets/images/icon-192.png",
    badge: "/assets/images/icon-192.png",
    tag: "aportfy-test",
    data: { url: "/" },
  });
}
