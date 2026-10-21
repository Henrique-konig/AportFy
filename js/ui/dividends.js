// =========================================================
// AportFy — ui/dividends.js
// Proventos: indicadores, gráfico mensal, histórico, painel de recebidos/a receber e modal.
// =========================================================

import { setDatePickerValue, closeDatePicker } from "../datepicker.js";
import { refreshDropdown } from "../dropdown.js";
import { calcInvestmentMetrics, dividendDedupeKey, buildDividendCalendar, shiftMonth } from "../calc.js";
import { hexToRgba } from "./charts.js";
import { delegateClick, DIVIDEND_TYPE_COLORS, el, escapeHtml, formatCurrency, formatDate, getModeColor, showToast, state, todayISO, fadeInClass } from "./core.js";
import { openDeleteModal } from "./forms.js";
import { renderPortfolioHealth } from "./health.js";
import { renderHistory } from "./history.js";
import { formatQuantity, populateAssetFilter, populateDividendTickerSelect, refreshInvestmentViews, renderAssetDetail, renderInvestmentsTable } from "./investments.js";
import { scheduleAlertsRender } from "./alerts.js";
import { fmtNum, formatPerShare, monthShort } from "../format.js";

/* ---------------------------------------------------------------
   Proventos (dividendos, JCP, rendimentos)
--------------------------------------------------------------- */
export function initDividendsChart() {
  state.divChart = new Chart(el.divChartCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: "#94a3b8", boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
        y: {
          stacked: true,
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
      },
    },
  });
}

/**
 * Proventos por mês: os 6 últimos meses (até o atual) mais os meses futuros que
 * já têm pagamento anunciado, empilhando o que foi recebido e o que ainda vai cair.
 */
export function renderDividendsChart(received) {
  if (!state.divChart) return;
  const now = new Date();
  const toKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const upcoming = getPendingUpcomingDividends();

  const lastUpcomingKey = upcoming.reduce((max, i) => (i.paymentDate.slice(0, 7) > max ? i.paymentDate.slice(0, 7) : max), toKey(now.getFullYear(), now.getMonth()));
  const [endY, endM] = lastUpcomingKey.split("-").map(Number);
  const futureMonths = Math.min(6, (endY - now.getFullYear()) * 12 + (endM - 1 - now.getMonth()));

  const months = [];
  for (let i = 5; i >= -futureMonths; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: toKey(d.getFullYear(), d.getMonth()), label: monthShort(d) });
  }

  const receivedTotals = months.map(() => 0);
  const upcomingTotals = months.map(() => 0);
  received.forEach((d) => {
    const idx = months.findIndex((m) => m.key === String(d.date).slice(0, 7));
    if (idx !== -1) receivedTotals[idx] += Number(d.amount) || 0;
  });
  upcoming.forEach((i) => {
    const idx = months.findIndex((m) => m.key === i.paymentDate.slice(0, 7));
    if (idx !== -1) upcomingTotals[idx] += i.total;
  });

  const modeColor = getModeColor();
  state.divChart.data.labels = months.map((m) => m.label);
  state.divChart.data.datasets = [
    { label: "Recebido", data: receivedTotals, backgroundColor: hexToRgba(modeColor, 0.75), borderRadius: 6, barThickness: 28 },
    { label: "A receber", data: upcomingTotals, backgroundColor: "rgba(245, 158, 11, 0.55)", borderRadius: 6, barThickness: 28 },
  ];
  state.divChart.update();
}

export const MONTHS_PT_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTHS_PT_FULL[m - 1]} de ${y}`;
}

/** Repopula o filtro de mês com os meses realmente presentes no conjunto (já filtrado por ativo). */
export function populateDividendMonthFilter(dividendsForAsset) {
  const months = [...new Set(dividendsForAsset.map((d) => d.date.slice(0, 7)))].sort().reverse();
  const current = el.divMonthFilter.value;

  el.divMonthFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.divMonthFilter.value = months.includes(current) ? current : "all";
  state.divMonthFilterValue = el.divMonthFilter.value;
  refreshDropdown("div-month-filter");
}

// A tabela mostra os proventos aos poucos: milhares de linhas deixam o layout lento.
const DIV_TABLE_PAGE_SIZE = 100;
let divTableLimit = DIV_TABLE_PAGE_SIZE;

export function renderDividends(dividends, investments) {
  // Filtrado só pelo ativo — base para os KPIs, o gráfico e a lista de
  // meses disponíveis (não deve depender do filtro de mês, senão o
  // dropdown de mês encolheria conforme o próprio usuário filtra).
  const filtered = state.invAssetFilterValue === "all" ? dividends : dividends.filter((d) => d.ticker === state.invAssetFilterValue);

  populateDividendMonthFilter(filtered);

  // Filtrado por ativo + mês — só para a tabela de histórico.
  const tableRows = state.divMonthFilterValue === "all" ? filtered : filtered.filter((d) => d.date.slice(0, 7) === state.divMonthFilterValue);

  el.divCount.textContent = `${tableRows.length} registro${tableRows.length === 1 ? "" : "s"}`;

  if (tableRows.length === 0) {
    el.dividendsTbody.innerHTML = "";
    el.dividendsEmpty.classList.remove("hidden");
    el.dividendsEmpty.classList.add("flex");
  } else {
    el.dividendsEmpty.classList.add("hidden");
    el.dividendsEmpty.classList.remove("flex");

    const fade = fadeInClass(el.dividendsTbody);
    el.dividendsTbody.innerHTML = tableRows
      .slice(0, divTableLimit)
      .map((d) => {
        const color = DIVIDEND_TYPE_COLORS[d.type] || DIVIDEND_TYPE_COLORS["Outro"];
        return `
          <tr class="${fade}" data-id="${d.id}">
            <td class="px-5 sm:px-6 py-4 font-medium">${escapeHtml(d.ticker)}</td>
            <td class="px-5 sm:px-6 py-4">
              <span class="category-badge">
                <span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>
                ${escapeHtml(d.type)}
              </span>
            </td>
            <td class="px-5 sm:px-6 py-4 text-slate-400">${formatDate(d.date)}</td>
            <td class="px-5 sm:px-6 py-4 text-right font-semibold text-emerald-400">${formatCurrency(Number(d.amount) || 0)}</td>
            <td class="px-5 sm:px-6 py-4">
              <div class="flex items-center justify-end gap-1.5">
                <button class="row-action-btn edit-dividend-btn" data-id="${d.id}" title="Editar">
                  <i class="ph-bold ph-pencil-simple"></i>
                </button>
                <button class="row-action-btn delete-btn delete-dividend-btn" data-id="${d.id}" title="Excluir">
                  <i class="ph-bold ph-trash"></i>
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join("");

    delegateClick(el.dividendsTbody, ".edit-dividend-btn", (btn) => {
      const d = tableRows.find((row) => row.id === btn.dataset.id);
      if (d && dividendEditHandler) dividendEditHandler(d);
    });
    delegateClick(el.dividendsTbody, ".delete-dividend-btn", (btn) => openDeleteModal(btn.dataset.id, "dividend"));
  }

  const remaining = tableRows.length - divTableLimit;
  el.divMoreWrap.classList.toggle("hidden", remaining <= 0);
  el.divMoreWrap.classList.toggle("flex", remaining > 0);
  el.divMoreRemaining.textContent = remaining > 0 ? `(${remaining})` : "";

  // KPIs (sempre calculados sobre o conjunto filtrado só pelo ativo — o
  // filtro de mês afeta apenas a lista abaixo, não esses totais fixos)
  const now = new Date();
  const totalReceived = filtered.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const yearReceived = filtered
    .filter((d) => new Date(`${d.date}T00:00:00`).getFullYear() === now.getFullYear())
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
  const last12mReceived = filtered
    .filter((d) => new Date(`${d.date}T00:00:00`) >= twelveMonthsAgo)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const relevantInvestments =
    state.invAssetFilterValue === "all" ? investments : investments.filter((inv) => inv.ticker === state.invAssetFilterValue);
  const totalCost = relevantInvestments.reduce((sum, inv) => sum + calcInvestmentMetrics(inv).costBasis, 0);
  const yieldOnCost = totalCost > 0 ? (last12mReceived / totalCost) * 100 : 0;

  el.divKpiTotal.textContent = formatCurrency(totalReceived);
  el.divKpiYear.textContent = formatCurrency(yearReceived);
  el.divKpiYearLabel.textContent = `Ano atual (${now.getFullYear()})`;
  el.divKpi12m.textContent = formatCurrency(last12mReceived);
  el.divKpiYield.textContent = `${yieldOnCost.toFixed(2)}%`;

  renderDividendsChart(filtered);
}

/** Chamado pelo app.js sempre que os proventos mudam em tempo real. */
export function renderDividendsData(dividends) {
  scheduleAlertsRender();
  state.lastDividends = dividends;
  renderDividends(dividends, state.lastInvestments);
  renderUpcomingDividendsView();
  renderPortfolioHealth();
  renderHistory();
  renderAssetDetail(state.lastInvestments, dividends);
}

export function renderInvestments(investments) {
  scheduleAlertsRender();
  state.lastInvestments = investments;
  populateAssetFilter(investments);
  refreshInvestmentViews();
  populateDividendTickerSelect(investments);
  renderAssetDetail(investments, state.lastDividends);
  renderDividends(state.lastDividends, investments);
  renderPortfolioHealth();
  renderHistory();
}

export function setQuotesLoading(loading) {
  el.refreshQuotesBtn.disabled = loading;
  el.refreshQuotesBtn.classList.toggle("opacity-60", loading);
  el.refreshQuotesIcon.classList.toggle("animate-spin", loading);
}

export function bindInvestmentFilters() {
  el.invSearchInput.addEventListener("input", refreshInvestmentViews);
  el.invCategoryFilter.addEventListener("change", refreshInvestmentViews);
  el.invSortSelect.addEventListener("change", () => {
    state.invTypeSort = el.invSortSelect.value;
    renderInvestmentsTable(state.lastInvestments);
  });
  el.invAssetFilter.addEventListener("change", () => {
    state.invAssetFilterValue = el.invAssetFilter.value;
    refreshInvestmentViews();
    renderUpcomingDividendsView();
    renderAssetDetail(state.lastInvestments, state.lastDividends);
    renderDividends(state.lastDividends, state.lastInvestments);
  });
  el.divPanelTabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      divPanelTab = btn.dataset.divTab;
      divPanelLimit = DIV_PANEL_PAGE_SIZE;
      renderUpcomingDividendsView();
    })
  );
  el.divPanelMonthFilter?.addEventListener("change", () => {
    divPanelMonth = el.divPanelMonthFilter.value;
    divPanelLimit = DIV_PANEL_PAGE_SIZE;
    renderUpcomingDividendsView();
  });
  el.divPanelMoreBtn?.addEventListener("click", () => {
    divPanelLimit += DIV_PANEL_PAGE_SIZE;
    renderUpcomingDividendsView();
  });
  el.divMonthFilter.addEventListener("change", () => {
    state.divMonthFilterValue = el.divMonthFilter.value;
    divTableLimit = DIV_TABLE_PAGE_SIZE;
    renderDividends(state.lastDividends, state.lastInvestments);
  });
  el.divMoreBtn?.addEventListener("click", () => {
    divTableLimit += DIV_TABLE_PAGE_SIZE;
    renderDividends(state.lastDividends, state.lastInvestments);
  });
}

/* ---------------------------------------------------------------
   Modal: Registrar Provento
--------------------------------------------------------------- */
export let dividendSubmitHandler = null;
export let dividendEditHandler = null;

export function onDividendFormSubmit(handler) {
  dividendSubmitHandler = handler;
}

export function onEditDividend(handler) {
  dividendEditHandler = handler;
}

export const DIVIDEND_DATE_PLACEHOLDER = "Selecionar data";

export function openDividendModal(dividend = null) {
  el.dividendForm.reset();
  populateDividendTickerSelect(state.lastInvestments);
  if (dividend) {
    el.dividendModalTitle.textContent = "Editar Provento";
    el.dividendId.value = dividend.id;
    el.dividendTicker.value = dividend.ticker;
    el.dividendType.value = dividend.type;
    el.dividendAmount.value = dividend.amount;
    setDatePickerValue("dividend-date", "dividend-date-label", dividend.date, DIVIDEND_DATE_PLACEHOLDER);
  } else {
    el.dividendModalTitle.textContent = "Registrar Provento";
    el.dividendId.value = "";
    if (state.invAssetFilterValue !== "all") el.dividendTicker.value = state.invAssetFilterValue;
    setDatePickerValue("dividend-date", "dividend-date-label", todayISO(), DIVIDEND_DATE_PLACEHOLDER);
  }
  refreshDropdown("dividend-ticker");
  refreshDropdown("dividend-type");
  el.dividendModal.classList.remove("hidden");
  el.dividendModal.classList.add("flex");
}

export function closeDividendModal() {
  el.dividendModal.classList.add("hidden");
  el.dividendModal.classList.remove("flex");
  closeDatePicker();
}

export function bindDividendModal() {
  el.newDividendBtn?.addEventListener("click", () => openDividendModal());
  el.dividendModalCloseBtn?.addEventListener("click", closeDividendModal);
  el.dividendModalBackdrop?.addEventListener("click", closeDividendModal);

  el.dividendForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!el.dividendTicker.value) {
      showToast("Cadastre um ativo antes de registrar proventos.", "error");
      return;
    }
    if (!el.dividendDate.value) {
      showToast("Selecione a data do provento.", "error");
      return;
    }
    const data = {
      ticker: el.dividendTicker.value,
      type: el.dividendType.value,
      amount: parseFloat(el.dividendAmount.value),
      date: el.dividendDate.value,
    };
    const editingId = el.dividendId.value || null;
    dividendSubmitHandler?.(data, editingId);
  });
}

/* -------- Importar proventos automaticamente da B3 -------- */
export let importDividendsHandler = null;

export function onImportDividends(handler) {
  importDividendsHandler = handler;
}

/* -------- Painel de proventos: recebidos (lançados) e a receber (anunciados) -------- */
export let upcomingState = { items: [], failed: [], hasEligible: false, loading: false };
export let divPanelTab = "all";
export let divPanelMonth = "all";
export const DIV_PANEL_PAGE_SIZE = 30;
export let divPanelLimit = DIV_PANEL_PAGE_SIZE;

export function daysUntilLabel(isoDate) {
  const today = new Date().toLocaleDateString("sv-SE");
  const diff = Math.round((new Date(`${isoDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  if (diff <= 0) return "hoje";
  return diff === 1 ? "amanhã" : `em ${diff} dias`;
}

/** Anunciados que ainda não foram lançados como recebidos (respeitando o filtro de ativo). */
export function getPendingUpcomingDividends() {
  const registered = new Set(state.lastDividends.map((d) => dividendDedupeKey(d.ticker, d.date, d.type)));
  return upcomingState.items.filter(
    (i) => (state.invAssetFilterValue === "all" || i.ticker === state.invAssetFilterValue) && !registered.has(dividendDedupeKey(i.ticker, i.paymentDate, i.type))
  );
}

/** Linhas do painel já filtradas pelo ativo: recebidos (proventos lançados) e a receber (anunciados na B3). */
export function getDividendPanelRows() {
  const assetOk = (ticker) => state.invAssetFilterValue === "all" || ticker === state.invAssetFilterValue;
  const upcoming = getPendingUpcomingDividends().map((i) => ({ ...i, status: "upcoming" }));
  const received = state.lastDividends
    .filter((d) => assetOk(d.ticker))
    .map((d) => ({
      status: "received",
      ticker: d.ticker,
      type: d.type,
      paymentDate: d.date,
      total: Number(d.amount) || 0,
      rate: d.rate ?? null,
      shares: d.shares ?? null,
      exDate: d.exDate ?? null,
    }));
  return { upcoming, received };
}

export function populateDividendPanelMonthFilter(rows) {
  const months = [...new Set(rows.map((r) => r.paymentDate.slice(0, 7)))].sort().reverse();
  const current = el.divPanelMonthFilter.value || divPanelMonth;

  el.divPanelMonthFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.divPanelMonthFilter.value = current === "all" || months.includes(current) ? current : "all";
  divPanelMonth = el.divPanelMonthFilter.value;
  refreshDropdown("div-panel-month-filter");
}

export function renderUpcomingDividendsView() {
  const { failed, hasEligible, loading } = upcomingState;
  const { upcoming, received } = getDividendPanelRows();
  populateDividendPanelMonthFilter([...upcoming, ...received]);

  const inMonth = (r) => divPanelMonth === "all" || r.paymentDate.slice(0, 7) === divPanelMonth;
  const upcomingInMonth = upcoming.filter(inMonth);
  const receivedInMonth = received.filter(inMonth);

  el.divUpcomingTotal.textContent = formatCurrency(upcomingInMonth.reduce((sum, i) => sum + i.total, 0));
  el.divPanelReceivedTotal.textContent = formatCurrency(receivedInMonth.reduce((sum, i) => sum + i.total, 0));
  el.refreshUpcomingIcon.classList.toggle("animate-spin", loading);
  el.refreshUpcomingBtn.disabled = loading;
  el.divPanelTabs.forEach((b) => b.classList.toggle("active-filter", b.dataset.divTab === divPanelTab));

  let rows;
  if (divPanelTab === "upcoming") rows = [...upcomingInMonth].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.ticker.localeCompare(b.ticker));
  else if (divPanelTab === "received") rows = [...receivedInMonth];
  else rows = [...upcomingInMonth, ...receivedInMonth];
  if (divPanelTab !== "upcoming") rows.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || a.ticker.localeCompare(b.ticker));

  const perShare = formatPerShare;
  const fade = fadeInClass(el.divUpcomingTbody);
  el.divUpcomingTbody.innerHTML = rows
    .slice(0, divPanelLimit)
    .map((r) => {
      const color = DIVIDEND_TYPE_COLORS[r.type] || DIVIDEND_TYPE_COLORS["Outro"];
      const isUpcoming = r.status === "upcoming";
      const jcpHint = r.type === "JCP" ? ` title="Líquido de 15% de IR"` : "";
      return `
        <tr class="${fade}">
          <td class="px-5 sm:px-6 py-4 font-medium">${escapeHtml(r.ticker)}</td>
          <td class="px-5 sm:px-6 py-4">
            <span class="category-badge"${jcpHint}><span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>${escapeHtml(r.type)}</span>
          </td>
          <td class="px-5 sm:px-6 py-4 text-slate-400">${r.exDate ? formatDate(r.exDate) : "—"}</td>
          <td class="px-5 sm:px-6 py-4 text-slate-400">${formatDate(r.paymentDate)}${isUpcoming ? ` <span class="text-[11px] text-slate-600">· ${daysUntilLabel(r.paymentDate)}</span>` : ""}</td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${r.rate != null ? perShare(r.rate) : "—"}</td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${r.shares != null ? formatQuantity(r.shares) : "—"}</td>
          <td class="px-5 sm:px-6 py-4 text-right font-semibold ${isUpcoming ? "text-amber-400" : "text-emerald-400"}">${formatCurrency(r.total)}</td>
          <td class="px-5 sm:px-6 py-4">
            <span class="whitespace-nowrap text-[11px] font-semibold px-2 py-1 rounded-md ${isUpcoming ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}">${isUpcoming ? "A receber" : "Recebido"}</span>
          </td>
        </tr>`;
    })
    .join("");

  const remaining = rows.length - divPanelLimit;
  el.divPanelMoreWrap.classList.toggle("hidden", remaining <= 0);
  el.divPanelMoreWrap.classList.toggle("flex", remaining > 0);
  el.divPanelMoreRemaining.textContent = remaining > 0 ? `(${remaining})` : "";

  let message = "";
  if (loading && rows.length === 0) message = "Buscando proventos na B3…";
  else if (rows.length === 0) {
    if (!hasEligible && received.length === 0) message = "Cadastre Ações ou FIIs na carteira para acompanhar os proventos.";
    else if (divPanelTab === "upcoming") message = "Nenhum provento anunciado para os seus ativos no momento.";
    else if (divPanelTab === "received") message = "Nenhum provento recebido neste filtro.";
    else message = "Nenhum provento neste filtro.";
  }
  if (!loading && failed.length > 0) {
    message += `${message ? " " : ""}Sem resposta da B3 para: ${failed.join(", ")}. Tente atualizar.`;
  }
  el.divUpcomingStatus.textContent = message;
  el.divUpcomingStatus.classList.toggle("hidden", !message);

  renderDividendsChart(received.map((r) => ({ date: r.paymentDate, amount: r.total })));
  renderDividendCalendar();
}

export function setUpcomingDividendsLoading(loading) {
  upcomingState = { ...upcomingState, loading };
  renderUpcomingDividendsView();
}

export function renderUpcomingDividends(items, { failed = [], hasEligible = false } = {}) {
  scheduleAlertsRender();
  upcomingState = { items, failed, hasEligible, loading: false };
  renderUpcomingDividendsView();
}

export function onRefreshUpcomingDividends(handler) {
  el.refreshUpcomingBtn?.addEventListener("click", handler);
}

export function setImportDividendsLoading(loading) {
  el.importDividendsBtn.disabled = loading;
  el.importDividendsBtn.classList.toggle("opacity-60", loading);
  el.importDividendsIcon.classList.toggle("animate-spin", loading);
}

export function bindImportDividends() {
  el.importDividendsBtn?.addEventListener("click", () => importDividendsHandler?.());
}

/* -------- Calendário de proventos -------- */
const calEl = {
  prev: document.getElementById("div-cal-prev"),
  next: document.getElementById("div-cal-next"),
  today: document.getElementById("div-cal-today"),
  month: document.getElementById("div-cal-month"),
  received: document.getElementById("div-cal-received"),
  upcoming: document.getElementById("div-cal-upcoming"),
  grid: document.getElementById("div-cal-grid"),
  detail: document.getElementById("div-cal-detail"),
};
const localToday = () => new Date().toLocaleDateString("sv-SE");
let calMonth = localToday().slice(0, 7);
let calSelected = null;

const compactCurrency = (v) =>
  v >= 1000 ? `R$ ${fmtNum(v / 1000, { maximumFractionDigits: 1 })} mil` : formatCurrency(v).replace(",00", "");

export function renderDividendCalendar() {
  if (!calEl.grid) return;
  const { upcoming, received } = getDividendPanelRows();
  const events = [...upcoming, ...received];
  const cal = buildDividendCalendar(calMonth, events);
  const today = localToday();

  calEl.month.textContent = formatMonthLabel(calMonth);
  calEl.received.textContent = formatCurrency(cal.received);
  calEl.upcoming.textContent = formatCurrency(cal.upcoming);
  if (calSelected && !calSelected.startsWith(calMonth)) calSelected = null;

  calEl.grid.innerHTML = cal.weeks
    .flat()
    .map((cell) => {
      if (!cell) return `<div aria-hidden="true"></div>`;
      const total = cell.received + cell.upcoming;
      const has = cell.count > 0;
      const isToday = cell.date === today;
      const selected = cell.date === calSelected;
      const label = has
        ? `${cell.day}: ${cell.count} provento(s), ${formatCurrency(total)}${cell.upcoming > 0 ? " (a receber)" : ""}`
        : `${cell.day}: sem proventos`;
      return `
        <button type="button" data-cal-date="${cell.date}" aria-label="${label}" aria-pressed="${selected}"
          class="relative min-h-[3.25rem] sm:min-h-[4rem] rounded-lg border text-left p-1.5 transition-colors
            ${selected ? "border-blue-500 bg-blue-500/10" : has ? "border-slate-700 bg-slate-900/60 hover:bg-slate-800/60" : "border-slate-800/60 hover:bg-slate-800/30"}
            ${isToday ? "ring-1 ring-blue-400/70" : ""}">
          <span class="text-[11px] ${has ? "font-semibold text-slate-200" : "text-slate-600"}">${cell.day}</span>
          ${has ? `<span class="absolute top-1.5 right-1.5 flex gap-0.5">${cell.received > 0 ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ""}${cell.upcoming > 0 ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>' : ""}</span>
          <span class="hidden sm:block text-[10px] font-semibold mt-1.5 ${cell.upcoming > 0 && cell.received === 0 ? "text-amber-400" : "text-emerald-400"}">${compactCurrency(total)}</span>` : ""}
        </button>`;
    })
    .join("");

  const dayEvents = calSelected ? events.filter((e) => e.paymentDate === calSelected) : [];
  calEl.detail.innerHTML = !calSelected
    ? ""
    : dayEvents.length === 0
      ? `<p class="text-xs text-slate-500">Nenhum provento em ${formatDate(calSelected)}.</p>`
      : `<p class="text-xs font-semibold text-slate-300">${formatDate(calSelected)}</p>` +
        dayEvents
          .map(
            (e) => `
          <div class="flex items-center justify-between gap-3 bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-2.5">
            <p class="text-sm"><span class="font-semibold">${escapeHtml(e.ticker)}</span> <span class="text-xs text-slate-500">· ${escapeHtml(e.type || "")}</span></p>
            <p class="text-sm font-semibold ${e.status === "upcoming" ? "text-amber-400" : "text-emerald-400"}">${formatCurrency(e.total)} <span class="text-[11px] font-medium text-slate-500">${e.status === "upcoming" ? "a receber" : "recebido"}</span></p>
          </div>`
          )
          .join("");
}

export function bindDividendCalendar() {
  calEl.prev?.addEventListener("click", () => {
    calMonth = shiftMonth(calMonth, -1);
    renderDividendCalendar();
  });
  calEl.next?.addEventListener("click", () => {
    calMonth = shiftMonth(calMonth, 1);
    renderDividendCalendar();
  });
  calEl.today?.addEventListener("click", () => {
    calMonth = localToday().slice(0, 7);
    calSelected = localToday();
    renderDividendCalendar();
  });
  calEl.grid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cal-date]");
    if (!btn) return;
    calSelected = calSelected === btn.dataset.calDate ? null : btn.dataset.calDate;
    renderDividendCalendar();
  });
}
