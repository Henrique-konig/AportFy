// =========================================================
// AportFy — errors.js
// Registro de erros em produção: erro não tratado vira um aviso para /api/erros, que o escreve nos
// Logs da Vercel (sem serviço externo). Só vai o essencial: mensagem, pilha, página e navegador —
// nada de e-mail, id de usuário nem dados financeiros. No máximo 5 avisos por visita, sem repetir.
// =========================================================

const MAX_PER_VISIT = 5;
const IGNORED = [/^Script error\.?$/i, /ResizeObserver loop/i]; // ruído de extensões e do navegador

let sent = 0;
const seen = new Set();

function report(kind, message, stack) {
  const text = String(message ?? "").slice(0, 300);
  if (!text || IGNORED.some((re) => re.test(text))) return;
  const key = `${kind}:${text}`;
  if (sent >= MAX_PER_VISIT || seen.has(key)) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({ kind, message: text, stack: String(stack ?? "").slice(0, 1500), page: location.pathname, ua: navigator.userAgent.slice(0, 160) });
  try {
    navigator.sendBeacon?.("/api/erros", new Blob([body], { type: "application/json" }));
  } catch {
    /* sem como avisar: segue sem quebrar o app */
  }
}

window.addEventListener("error", (e) => report("error", e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => report("promise", e.reason?.message ?? e.reason, e.reason?.stack));
