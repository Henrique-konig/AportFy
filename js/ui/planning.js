// =========================================================
// AportFy — ui/planning.js
// Cartões do Dashboard: saldo projetado do mês e reserva de emergência.
// =========================================================

import { averageMonthlyExpenses, emergencyReserve, projectMonthBalance, reserveAmount } from "../calc.js";
import { refreshDropdown, enhanceSelect } from "../dropdown.js";
import { escapeHtml, formatCurrency, formatDate, state, todayISO } from "./core.js";
import { billsState, currentUnpaidInvoices } from "./bills.js";
import { fmtNum } from "../format.js";

const plEl = {
  projValue: document.getElementById("proj-value"),
  projRealized: document.getElementById("proj-realized"),
  projIncoming: document.getElementById("proj-incoming"),
  projOutgoing: document.getElementById("proj-outgoing"),
  projUpcoming: document.getElementById("proj-upcoming"),
  reserveMonths: document.getElementById("reserve-months"),
  reserveAmount: document.getElementById("reserve-amount"),
  reserveBar: document.getElementById("reserve-bar"),
  reserveNote: document.getElementById("reserve-note"),
  reserveSubtitle: document.getElementById("reserve-subtitle"),
  reserveConfigBtn: document.getElementById("reserve-config-btn"),
  reserveModal: document.getElementById("reserve-modal"),
  reserveForm: document.getElementById("reserve-form"),
  reserveSources: document.getElementById("reserve-sources"),
  reserveExtra: document.getElementById("reserve-extra"),
  reserveTarget: document.getElementById("reserve-target"),
};

/** Recorrências e configuração da reserva (o app entrega quando mudam). */
const planning = { recurrences: [], reserve: null };
let saveReserveHandler = null;

export function setPlanningData(partial) {
  Object.assign(planning, partial);
  renderPlanning();
}

const fmtMonths = (m) => `${fmtNum(m, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${m >= 0.95 && m < 1.05 ? "mês" : "meses"}`;

export function renderPlanning() {
  if (!plEl.projValue) return;
  const today = todayISO();

  // Saldo projetado
  const proj = projectMonthBalance({
    today,
    transactions: state.lastTransactions,
    recurrences: planning.recurrences,
    bills: billsState.bills,
    invoices: currentUnpaidInvoices(),
  });
  plEl.projValue.textContent = formatCurrency(proj.projected);
  plEl.projValue.classList.toggle("text-red-400", proj.projected < 0);
  plEl.projRealized.textContent = formatCurrency(proj.realized);
  plEl.projIncoming.textContent = formatCurrency(proj.incoming);
  plEl.projOutgoing.textContent = formatCurrency(proj.outgoing);
  const next = proj.upcoming.slice(0, 4);
  plEl.projUpcoming.innerHTML =
    next.length === 0
      ? `<li class="text-slate-500">Nada mais previsto para este mês.</li>`
      : next
          .map(
            (u) => `
        <li class="flex items-center justify-between gap-3">
          <span class="truncate text-slate-400"><span class="${u.date < today ? "text-red-400" : "text-slate-500"}">${formatDate(u.date).slice(0, 5)}</span> · ${escapeHtml(u.description || "")}</span>
          <span class="font-semibold shrink-0 ${u.amount >= 0 ? "text-emerald-400" : "text-red-400"}">${u.amount >= 0 ? "+" : "−"} ${formatCurrency(Math.abs(u.amount))}</span>
        </li>`
          )
          .join("") + (proj.upcoming.length > next.length ? `<li class="text-slate-500">e mais ${proj.upcoming.length - next.length}…</li>` : "");

  // Reserva de emergência
  const cfg = planning.reserve;
  const monthly = averageMonthlyExpenses(state.lastTransactions, today);
  const hasSources = !!cfg && ((cfg.sources || []).length > 0 || Number(cfg.extra) > 0);
  if (!hasSources) {
    plEl.reserveMonths.textContent = "—";
    plEl.reserveAmount.textContent = "Escolha onde está a sua reserva em Configurar.";
    plEl.reserveBar.style.width = "0%";
    plEl.reserveNote.textContent = monthly ? `Sua média de despesas é ${formatCurrency(monthly)} por mês.` : "";
    return;
  }
  const amount = reserveAmount(cfg.sources, state.lastGoals, state.lastInvestments, cfg.extra);
  const r = emergencyReserve({ amount, monthlyExpenses: monthly, targetMonths: cfg.targetMonths || 6 });
  plEl.reserveSubtitle.textContent = `Meta: ${r.targetMonths} meses de despesas.`;
  plEl.reserveAmount.textContent = `${formatCurrency(r.amount)} guardados`;
  if (r.months == null) {
    plEl.reserveMonths.textContent = formatCurrency(r.amount);
    plEl.reserveAmount.textContent = "Registre suas despesas para calcular quantos meses a reserva cobre.";
    plEl.reserveBar.style.width = "0%";
    plEl.reserveNote.textContent = "";
    return;
  }
  plEl.reserveMonths.textContent = fmtMonths(r.months);
  plEl.reserveBar.style.width = `${r.progress}%`;
  plEl.reserveNote.textContent =
    r.missing > 0
      ? `Faltam ${formatCurrency(r.missing)} para ${r.targetMonths} meses (média de despesas: ${formatCurrency(monthly)}/mês).`
      : `Meta de ${r.targetMonths} meses atingida 🎉 (média de despesas: ${formatCurrency(monthly)}/mês).`;
}

/* ---------------- Modal de configuração ---------------- */
function openReserveModal() {
  const cfg = planning.reserve || {};
  const selected = new Set(cfg.sources || []);
  const options = [
    ...state.lastGoals.map((g) => ({ value: `goal:${g.id}`, label: g.name, detail: `Meta · ${formatCurrency(g.currentAmount)}` })),
    ...state.lastInvestments
      .filter((i) => (Number(i.quantity) || 0) > 0)
      .map((i) => ({ value: `inv:${i.id}`, label: i.ticker, detail: `${i.category} · ${formatCurrency((Number(i.quantity) || 0) * (Number(i.currentPrice) || 0))}` })),
  ];
  plEl.reserveSources.innerHTML =
    options.length === 0
      ? `<p class="text-xs text-slate-500">Nenhuma meta ou investimento cadastrado. Use o campo abaixo para informar o valor.</p>`
      : options
          .map(
            (o) => `
        <label class="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800/80 cursor-pointer">
          <input type="checkbox" value="${escapeHtml(o.value)}" ${selected.has(o.value) ? "checked" : ""} class="accent-blue-500 w-4 h-4" />
          <span class="min-w-0 flex-1"><span class="block text-sm font-medium truncate">${escapeHtml(o.label)}</span><span class="block text-[11px] text-slate-500">${escapeHtml(o.detail)}</span></span>
        </label>`
          )
          .join("");
  plEl.reserveExtra.value = cfg.extra || "";
  plEl.reserveTarget.value = String(cfg.targetMonths || 6);
  refreshDropdown("reserve-target");
  plEl.reserveModal.classList.remove("hidden");
  plEl.reserveModal.classList.add("flex");
}

function closeReserveModal() {
  plEl.reserveModal.classList.add("hidden");
  plEl.reserveModal.classList.remove("flex");
}

export function bindPlanning({ onSaveReserve }) {
  saveReserveHandler = onSaveReserve;
  if (!plEl.reserveConfigBtn) return;
  enhanceSelect("reserve-target");
  plEl.reserveConfigBtn.addEventListener("click", openReserveModal);
  document.getElementById("reserve-modal-close-btn")?.addEventListener("click", closeReserveModal);
  document.getElementById("reserve-modal-backdrop")?.addEventListener("click", closeReserveModal);
  plEl.reserveForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sources = [...plEl.reserveSources.querySelectorAll("input:checked")].map((i) => i.value);
    await saveReserveHandler?.({ sources, extra: Number(plEl.reserveExtra.value) || 0, targetMonths: Number(plEl.reserveTarget.value) || 6 });
    closeReserveModal();
  });
}
