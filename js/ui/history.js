// =========================================================
// AportFy — ui/history.js
// Aba Histórico de movimentações.
// =========================================================

import { refreshDropdown } from "../dropdown.js";
import { buildInvestmentHistory, summarizeHistory } from "../calc.js";
import { escapeHtml, fadeInClass, formatCurrency, state } from "./core.js";
import { formatMonthLabel } from "./dividends.js";
import { formatQuantity } from "./investments.js";
import { formatPerShare } from "../format.js";

/* ---------------------------------------------------------------
   Histórico de movimentações (view: Histórico)
--------------------------------------------------------------- */
export const histEl = {
  totalBuy: document.getElementById("hist-total-buy"),
  totalBuyCount: document.getElementById("hist-total-buy-count"),
  totalSell: document.getElementById("hist-total-sell"),
  totalSellCount: document.getElementById("hist-total-sell-count"),
  totalDividend: document.getElementById("hist-total-dividend"),
  totalDividendCount: document.getElementById("hist-total-dividend-count"),
  totalResult: document.getElementById("hist-total-result"),
  totalResultCount: document.getElementById("hist-total-result-count"),
  tabs: document.querySelectorAll(".hist-tab-btn"),
  search: document.getElementById("hist-search-input"),
  asset: document.getElementById("hist-asset-filter"),
  month: document.getElementById("hist-month-filter"),
  list: document.getElementById("hist-list"),
  empty: document.getElementById("hist-empty"),
  emptyTitle: document.getElementById("hist-empty-title"),
  emptyDesc: document.getElementById("hist-empty-desc"),
  moreWrap: document.getElementById("hist-more-wrap"),
  moreBtn: document.getElementById("hist-more-btn"),
  moreRemaining: document.getElementById("hist-more-remaining"),
};
export const HIST_PAGE_SIZE = 40;
export let histKind = "all";
export let histLimit = HIST_PAGE_SIZE;

export const HIST_KIND_META = {
  buy: { label: "Compra", icon: "ph-shopping-cart-simple", color: "#3b82f6" },
  sell: { label: "Venda", icon: "ph-hand-coins", color: "#f59e0b" },
  dividend: { label: "Provento", icon: "ph-coins", color: "#34d399" },
};
export const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function populateHistorySelect(select, values, labelFn, allLabel) {
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${allLabel}</option>` + values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(labelFn(v))}</option>`).join("");
  select.value = current === "all" || values.includes(current) ? current : "all";
  refreshDropdown(select.id);
}

export function historyEventHtml(e, fade = "animate-fade-in") {
  const meta = HIST_KIND_META[e.kind];
  const [y, m, d] = e.date.split("-").map(Number);
  const weekday = WEEKDAYS_PT[new Date(y, m - 1, d).getDay()];
  const perShare = formatPerShare;

  let detail;
  if (e.kind === "dividend") {
    detail = [e.dividendType, e.quantity != null && e.price != null ? `${formatQuantity(e.quantity)} × ${perShare(e.price)}` : null].filter(Boolean).join(" · ");
  } else {
    detail = `${formatQuantity(e.quantity)} × ${perShare(e.price)}`;
  }
  if (e.category) detail += ` · ${e.category}`;

  let amountHtml;
  if (e.kind === "buy") {
    amountHtml = `<p class="text-sm font-bold">${formatCurrency(e.amount)}</p>`;
  } else if (e.kind === "sell") {
    const positive = e.result >= 0;
    amountHtml = `<p class="text-sm font-bold">${formatCurrency(e.amount)}</p>
      <p class="text-[11px] font-semibold ${positive ? "text-emerald-400" : "text-red-400"}">${positive ? "Lucro" : "Prejuízo"} de ${formatCurrency(Math.abs(e.result))}</p>`;
  } else {
    amountHtml = `<p class="text-sm font-bold text-emerald-400">+ ${formatCurrency(e.amount)}</p>`;
  }

  const approxTag = e.approximate
    ? ` <span class="text-[10px] font-semibold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded" title="Compra registrada antes do histórico detalhado: mostra a quantidade total na data da última compra.">aprox.</span>`
    : "";

  return `
    <div data-hist-row class="flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-3.5 hover:bg-slate-800/20 transition-colors ${fade}">
      <div class="w-10 text-center shrink-0">
        <p class="text-sm font-bold leading-none">${String(d).padStart(2, "0")}</p>
        <p class="text-[10px] text-slate-500 uppercase mt-1">${weekday}</p>
      </div>
      <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background:${meta.color}1f;">
        <i class="ph-bold ${meta.icon} text-lg" style="color:${meta.color};"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold truncate">${meta.label} · ${escapeHtml(e.ticker)}${approxTag}</p>
        <p class="text-xs text-slate-500 truncate">${escapeHtml(detail)}</p>
      </div>
      <div class="text-right shrink-0">${amountHtml}</div>
    </div>`;
}

export function renderHistory() {
  if (!histEl.list) return;
  const all = buildInvestmentHistory(state.lastInvestments, state.lastDividends);

  populateHistorySelect(histEl.asset, [...new Set(all.map((e) => e.ticker))].sort(), (t) => t, "Todos os ativos");
  populateHistorySelect(histEl.month, [...new Set(all.map((e) => e.date.slice(0, 7)))].sort().reverse(), formatMonthLabel, "Todos os meses");

  const term = (histEl.search.value || "").trim().toUpperCase();
  const asset = histEl.asset.value;
  const month = histEl.month.value;
  // Filtros de ativo, mês e busca valem para os totais; a aba de tipo só muda a lista.
  const scoped = all.filter(
    (e) => (asset === "all" || e.ticker === asset) && (month === "all" || e.date.startsWith(month)) && (!term || e.ticker.toUpperCase().includes(term))
  );
  const events = histKind === "all" ? scoped : scoped.filter((e) => e.kind === histKind);

  const totals = summarizeHistory(scoped);
  const count = (kind) => scoped.filter((e) => e.kind === kind).length;
  histEl.totalBuy.textContent = formatCurrency(totals.bought);
  histEl.totalBuyCount.textContent = plural(count("buy"), "compra", "compras");
  histEl.totalSell.textContent = formatCurrency(totals.sold);
  histEl.totalSellCount.textContent = plural(count("sell"), "venda", "vendas");
  histEl.totalDividend.textContent = formatCurrency(totals.dividends);
  histEl.totalDividendCount.textContent = plural(count("dividend"), "pagamento", "pagamentos");
  histEl.totalResult.textContent = formatCurrency(totals.realized);
  histEl.totalResult.classList.toggle("text-emerald-400", totals.realized > 0);
  histEl.totalResult.classList.toggle("text-red-400", totals.realized < 0);
  histEl.totalResultCount.textContent = count("sell") > 0 ? "Lucro/prejuízo realizado nas vendas" : "Nenhuma venda no filtro";
  histEl.tabs.forEach((b) => b.classList.toggle("active-filter", b.dataset.histKind === histKind));

  const visible = events.slice(0, histLimit);
  histEl.empty.classList.toggle("hidden", visible.length > 0);
  histEl.empty.classList.toggle("flex", visible.length === 0);
  if (visible.length === 0) {
    histEl.emptyTitle.textContent = all.length === 0 ? "Nenhuma movimentação ainda." : "Nenhuma movimentação neste filtro.";
    histEl.emptyDesc.textContent =
      all.length === 0 ? "Registre compras, vendas e proventos em Investimentos para vê-los aqui." : "Ajuste os filtros para ver outras movimentações.";
  }

  // Agrupa por mês, com o saldo de cada mês (proventos e vendas entram, compras saem).
  const groups = [];
  visible.forEach((e) => {
    const key = e.date.slice(0, 7);
    if (groups.length === 0 || groups[groups.length - 1].key !== key) groups.push({ key, events: [] });
    groups[groups.length - 1].events.push(e);
  });
  const fade = fadeInClass(histEl.list);
  histEl.list.innerHTML = groups
    .map((g) => {
      const monthEvents = events.filter((e) => e.date.startsWith(g.key));
      const t = summarizeHistory(monthEvents);
      const parts = [
        t.bought > 0 ? `Compras ${formatCurrency(t.bought)}` : null,
        t.sold > 0 ? `Vendas ${formatCurrency(t.sold)}` : null,
        t.dividends > 0 ? `Proventos ${formatCurrency(t.dividends)}` : null,
      ].filter(Boolean);
      return `
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-5 sm:px-6 py-3 bg-slate-900/60 border-y border-slate-800/80">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-300">${formatMonthLabel(g.key)}</p>
            <p class="text-[11px] text-slate-500">${parts.join(" · ")}</p>
          </div>
          <div class="divide-y divide-slate-800/50">${g.events.map((e) => historyEventHtml(e, fade)).join("")}</div>
        </div>`;
    })
    .join("");

  const remaining = events.length - histLimit;
  histEl.moreWrap.classList.toggle("hidden", remaining <= 0);
  histEl.moreWrap.classList.toggle("flex", remaining > 0);
  histEl.moreRemaining.textContent = remaining > 0 ? `(${remaining})` : "";
}

export function bindHistory() {
  const reset = () => {
    histLimit = HIST_PAGE_SIZE;
    renderHistory();
  };
  histEl.tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      histKind = btn.dataset.histKind;
      reset();
    })
  );
  histEl.search?.addEventListener("input", reset);
  histEl.asset?.addEventListener("change", reset);
  histEl.month?.addEventListener("change", reset);
  histEl.moreBtn?.addEventListener("click", () => {
    histLimit += HIST_PAGE_SIZE;
    renderHistory();
  });
}

