// =========================================================
// AportFy — ui/networth.js
// Card de patrimônio no Dashboard: contas informadas (Nubank, PicPay…) + carteira a preço de hoje,
// resultado da carteira, próximo provento e a evolução do que foi investido, mês a mês.
// =========================================================

import { calcInvestmentMetrics, netWorthSeries } from "../calc.js";
import { baseLineOptions, hexToRgba } from "./charts.js";
import { escapeHtml, formatCurrency, formatDate, showToast, state } from "./core.js";
import { getPendingUpcomingDividends } from "./dividends.js";

const nw = {
  card: document.getElementById("networth-card"),
  total: document.getElementById("networth-total"),
  cash: document.getElementById("networth-cash"),
  portfolio: document.getElementById("networth-portfolio"),
  result: document.getElementById("networth-result"),
  next: document.getElementById("networth-next"),
  canvas: document.getElementById("networth-chart"),
  chartTitle: document.getElementById("networth-chart-title"),
  edit: document.getElementById("networth-edit"),
  panel: document.getElementById("networth-accounts"),
  rows: document.getElementById("networth-account-rows"),
};
export const MAX_ACCOUNTS = 20;
const compact = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(Math.abs(v) >= 100000 ? 0 : 1).replace(".", ",")} mil` : `R$ ${v}`);
const chartOptions = () => ({
  ...baseLineOptions,
  layout: { padding: { top: 4, right: 8 } },
  plugins: {
    ...baseLineOptions.plugins,
    legend: { display: true, align: "end", labels: { color: "#94a3b8", usePointStyle: true, boxWidth: 8, boxHeight: 8, font: { size: 11 } } },
    tooltip: { ...baseLineOptions.plugins.tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y)}` } },
  },
  scales: { ...baseLineOptions.scales, y: { ...baseLineOptions.scales.y, grid: { color: "rgba(51,65,85,0.25)", drawTicks: false }, border: { display: false }, ticks: { ...baseLineOptions.scales.y.ticks, callback: compact, maxTicksLimit: 5 } } },
});
/** Degradê azul que some em direção ao eixo. */
const fadeFill = ({ chart: c }) => {
  const { ctx, chartArea } = c;
  if (!chartArea) return hexToRgba("#3b82f6", 0.15);
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, hexToRgba("#3b82f6", 0.35));
  g.addColorStop(1, hexToRgba("#3b82f6", 0));
  return g;
};
let accounts = []; // [{name, balance}] salvas em settings/portfolio
let chart = null;
let saveHandler = null;
let snapshotHandler = null;
let history = {}; // {"2026-11": patrimônio total} — um ponto por mês, gravado pelo próprio app
let settingsLoaded = false;
let lastSnapshotAt = 0;
const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;

export const onAccountsSave = (handler) => (saveHandler = handler);
export const onNetWorthSnapshot = (handler) => (snapshotHandler = handler);

/** Chamado quando as configurações salvas mudam. */
export function setNetWorthAccounts(list, savedHistory) {
  settingsLoaded = true;
  history = savedHistory && typeof savedHistory === "object" ? savedHistory : {};
  accounts = (Array.isArray(list) ? list : []).map((a) => ({ name: String(a.name || ""), balance: Number(a.balance) || 0 }));
  if (nw.panel?.classList.contains("hidden")) renderNetWorth();
}

const rowHtml = (a = { name: "", balance: "" }) => `
  <div class="flex items-center gap-2" data-nw-row>
    <input data-nw-name maxlength="40" placeholder="Ex: Nubank" value="${escapeHtml(a.name)}" class="min-w-0 flex-1 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 text-sm" />
    <input data-nw-balance type="number" step="0.01" placeholder="Saldo" value="${a.balance}" class="w-32 bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2 text-sm" />
    <button type="button" data-nw-remove aria-label="Remover conta" class="text-slate-500 hover:text-red-400 px-1"><i class="ph-bold ph-x"></i></button>
  </div>`;

export function bindNetWorth() {
  nw.edit?.addEventListener("click", () => {
    nw.rows.innerHTML = (accounts.length ? accounts : [undefined]).map(rowHtml).join("");
    nw.panel.classList.remove("hidden");
  });
  nw.panel?.addEventListener("click", (e) => {
    if (e.target.closest("[data-nw-remove]")) e.target.closest("[data-nw-row]").remove();
    else if (e.target.closest("#networth-add") && nw.rows.children.length < MAX_ACCOUNTS) nw.rows.insertAdjacentHTML("beforeend", rowHtml());
    else if (e.target.closest("#networth-cancel")) nw.panel.classList.add("hidden");
    else if (e.target.closest("#networth-save")) {
      const list = [...nw.rows.querySelectorAll("[data-nw-row]")]
        .map((r) => ({ name: r.querySelector("[data-nw-name]").value.trim(), balance: parseFloat(r.querySelector("[data-nw-balance]").value) }))
        .filter((a) => a.name || Number.isFinite(a.balance))
        .map((a) => ({ name: a.name || "Conta", balance: Number.isFinite(a.balance) ? a.balance : 0 }));
      saveHandler?.(list)
        .then(() => (nw.panel.classList.add("hidden"), showToast("Contas salvas!", "success")))
        .catch(() => showToast("Erro ao salvar as contas.", "error"));
    }
  });
}

/** Grava o patrimônio do mês (no máximo a cada 10 min, e só se mudou) para o gráfico ter histórico real. */
function saveSnapshot(month, total) {
  const value = Math.round(total * 100) / 100;
  if (!settingsLoaded || !snapshotHandler || !(value > 0) || history[month] === value) return;
  if (month in history && Date.now() - lastSnapshotAt < SNAPSHOT_EVERY_MS) return;
  lastSnapshotAt = Date.now();
  history = { ...history, [month]: value };
  snapshotHandler(month, value).catch(() => {});
}

export function renderNetWorth() {
  if (!nw.card) return;
  const investments = state.lastInvestments || [];
  const transactions = state.lastTransactions || [];
  nw.card.classList.toggle("hidden", investments.length === 0 && transactions.length === 0 && accounts.length === 0);

  const metrics = investments.map(calcInvestmentMetrics);
  const portfolio = metrics.reduce((s, m) => s + m.totalValue, 0);
  const profit = metrics.reduce((s, m) => s + m.profitValue, 0);
  const cash = accounts.reduce((s, a) => s + a.balance, 0);

  nw.total.textContent = formatCurrency(cash + portfolio);
  nw.cash.textContent = accounts.length ? formatCurrency(cash) : "Adicionar";
  nw.edit.title = accounts.map((a) => `${a.name}: ${formatCurrency(a.balance)}`).join("\n") || "Informe seus saldos (Nubank, PicPay…)";
  nw.chartTitle.textContent = "Azul: totais que o app guarda todo mês (começam agora). Tracejada: estimativa dos meses anteriores, com a carteira a custo + suas contas de hoje.";
  nw.portfolio.textContent = formatCurrency(portfolio);
  nw.result.textContent = formatCurrency(profit);
  nw.result.classList.toggle("text-emerald-400", profit > 0);
  nw.result.classList.toggle("text-red-400", profit < 0);

  const next = getPendingUpcomingDividends()[0];
  nw.next.textContent = next ? `Próximo provento: ${next.ticker}, ${formatCurrency(next.total)} em ${formatDate(next.paymentDate)}` : "";

  if (!window.Chart || !nw.canvas) return;
  const series = netWorthSeries(transactions, investments);
  const last = series.length - 1;
  const total = cash + portfolio;
  const data = {
    labels: series.map((p) => p.label),
    datasets: [
      { label: "Estimativa", data: series.map((p, i) => (i === last ? total : p.invested + cash)), borderColor: "#64748b", borderDash: [5, 5], borderWidth: 2, backgroundColor: fadeFill, fill: "origin", tension: 0.4, pointRadius: 0, pointHoverRadius: 4 },
      { label: "Patrimônio", data: series.map((p, i) => (i === last ? total : history[p.key] ?? null)), spanGaps: true, borderColor: "#60a5fa", borderWidth: 3, tension: 0.4, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: "#60a5fa", pointBorderColor: "#0f172a", pointBorderWidth: 2 },
    ],
  };
  saveSnapshot(series[last].key, total);
  if (chart) {
    chart.data = data;
    chart.update("none");
  } else chart = new Chart(nw.canvas.getContext("2d"), { type: "line", data, options: chartOptions() });
}
