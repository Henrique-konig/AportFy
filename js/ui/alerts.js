// =========================================================
// AportFy — ui/alerts.js
// Central de alertas do sino no cabeçalho: proventos, orçamentos,
// metas, cotações, saúde da carteira e pedidos do espaço de casal.
// =========================================================

import { buildAlerts } from "../calc.js";
import { escapeHtml, state } from "./core.js";
import { upcomingState } from "./dividends.js";
import { lastHealthAnalysis } from "./health.js";
import { renderOnboarding } from "./onboarding.js";
import { billsState, currentUnpaidInvoices } from "./bills.js";
import { renderPlanning } from "./planning.js";
import { maskMoneyText } from "./privacy.js";

const alertsEl = {
  btn: document.getElementById("notif-btn"),
  dot: document.getElementById("notif-dot"),
  count: document.getElementById("notif-count"),
  panel: document.getElementById("notif-panel"),
  list: document.getElementById("notif-list"),
  markRead: document.getElementById("notif-mark-read"),
};

const SEEN_KEY = "aportfy_seen_alerts";
const LEVEL_STYLE = {
  critical: "text-red-400 bg-red-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  success: "text-emerald-400 bg-emerald-500/10",
  info: "text-blue-400 bg-blue-500/10",
};

let currentAlerts = [];
let renderScheduled = false;

const readSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const writeSeen = (ids) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    /* storage indisponível: os alertas só voltam a aparecer como não lidos */
  }
};

/** Alertas atuais (útil para testes e para o app). */
export function getCurrentAlerts() {
  return currentAlerts;
}

/** Recalcula os alertas logo depois que os dados da tela terminam de mudar. */
export function scheduleAlertsRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  setTimeout(() => {
    renderScheduled = false;
    renderAlerts();
  }, 0);
}

export function renderAlerts() {
  renderOnboarding(); // os primeiros passos dependem dos mesmos dados
  renderPlanning(); // saldo projetado e reserva também
  if (!alertsEl.btn) return;
  currentAlerts = buildAlerts({
    today: new Date().toLocaleDateString("sv-SE"),
    dividends: state.lastDividends,
    upcoming: upcomingState.items,
    budgets: state.lastBudgets,
    transactions: state.lastTransactions,
    investments: state.lastInvestments,
    health: lastHealthAnalysis,
    goals: state.lastGoals,
    joinRequests: state.joinRequestsCount || 0,
    bills: billsState.bills,
    invoices: currentUnpaidInvoices(),
  });

  const seen = readSeen();
  const unread = currentAlerts.filter((a) => !seen.has(a.id)).length;
  alertsEl.dot.classList.toggle("hidden", unread === 0);
  alertsEl.count.textContent = unread > 9 ? "9+" : String(unread);
  alertsEl.btn.setAttribute("aria-label", unread > 0 ? `Alertas: ${unread} não lido${unread === 1 ? "" : "s"}` : "Alertas");

  alertsEl.list.innerHTML =
    currentAlerts.length === 0
      ? `<p class="text-xs text-slate-500 text-center py-8 px-4">Nenhum alerta por enquanto. Avisaremos sobre proventos, orçamentos e metas aqui.</p>`
      : currentAlerts
          .map(
            (a) => `
        <button type="button" data-alert-view="${escapeHtml(a.view)}" class="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors ${seen.has(a.id) ? "" : "bg-slate-800/20"}">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${LEVEL_STYLE[a.level]}"><i class="ph-bold ${escapeHtml(a.icon)}" aria-hidden="true"></i></span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold">${escapeHtml(maskMoneyText(a.title))}</span>
            <span class="block text-xs text-slate-500 mt-0.5">${escapeHtml(maskMoneyText(a.detail))}</span>
          </span>
          ${seen.has(a.id) ? "" : `<span class="ml-auto mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Não lido"></span>`}
        </button>`
          )
          .join("");
}

function markAllRead() {
  const seen = readSeen();
  currentAlerts.forEach((a) => seen.add(a.id));
  writeSeen(seen);
  renderAlerts();
}

function setPanelOpen(open) {
  alertsEl.panel.classList.toggle("hidden", !open);
  alertsEl.btn.setAttribute("aria-expanded", String(open));
}

export function bindAlerts() {
  if (!alertsEl.btn) return;
  alertsEl.btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setPanelOpen(alertsEl.panel.classList.contains("hidden"));
  });
  alertsEl.markRead?.addEventListener("click", markAllRead);
  alertsEl.list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-alert-view]");
    if (!item) return;
    setPanelOpen(false);
    document.querySelector(`.nav-item[data-view="${item.dataset.alertView}"]`)?.click();
  });
  document.addEventListener("click", (e) => {
    if (!alertsEl.panel.classList.contains("hidden") && !alertsEl.panel.contains(e.target)) setPanelOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !alertsEl.panel.classList.contains("hidden")) {
      setPanelOpen(false);
      alertsEl.btn.focus();
    }
  });
  renderAlerts();
}
