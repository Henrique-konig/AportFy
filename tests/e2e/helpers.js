// Ajudantes dos testes de ponta a ponta: sobem o app no Chromium real com o Firebase falso.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const fakes = join(dirname(fileURLToPath(import.meta.url)), "fakes");
const read = (name) => readFileSync(join(fakes, name), "utf8");

const FIREBASE = "https://www.gstatic.com/firebasejs/10.13.0/";

export const UID = "e2e-user";
export const pad = (n) => String(n).padStart(2, "0");
/** Data local de hoje +- dias, no formato do app (AAAA-MM-DD). */
export const iso = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Abre o app. `user`: logado de saída (null = tela de login). `seed`: documentos do Firestore falso,
 * por caminho completo ("users/e2e-user/transactions/t1": {...}). `routes`: função (page) que registra
 * respostas das funções /api/* antes de a página abrir.
 */
export async function openApp(page, { user = {}, seed = {}, routes } = {}) {
  await page.addInitScript(({ user, seed }) => {
    window.__E2E = { user, seed };
    try {
      localStorage.setItem("aportfy_onboarding_dismissed_e2e-user", "1");
    } catch {}
  }, { user, seed });

  // Firebase trocado pelas versões falsas (mesmas URLs que o app importa).
  await page.route(`${FIREBASE}firebase-app.js`, (route) => route.fulfill({ contentType: "text/javascript", body: "export const initializeApp = () => ({ fake: true });" }));
  await page.route(`${FIREBASE}firebase-auth.js`, (route) => route.fulfill({ contentType: "text/javascript", body: read("firebase-auth.js") }));
  await page.route(`${FIREBASE}firebase-firestore.js`, (route) => route.fulfill({ contentType: "text/javascript", body: read("firebase-firestore.js") }));
  await page.route(`${FIREBASE}firebase-analytics.js`, (route) =>
    route.fulfill({ contentType: "text/javascript", body: "export const getAnalytics = () => ({}); export const isSupported = async () => false;" })
  );
  await page.route(`${FIREBASE}firebase-messaging.js`, (route) => route.fulfill({ contentType: "text/javascript", body: "export const isSupported = async () => false;" }));

  // Funções serverless não existem no servidor estático: respostas combinadas.
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.includes("/api/erros")) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  // Rotas do teste (registradas por último, então valem sobre as gerais acima).
  if (routes) await routes(page);

  await page.goto("/");
}

/** Documentos de uma coleção do Firestore falso. */
export const readCollection = (page, path) =>
  page.evaluate((p) => [...(window.__fs.data.get(p)?.entries() ?? [])].map(([id, data]) => ({ id, ...data })), path);
