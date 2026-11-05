// =========================================================
// AportFy — ui/networth.js
// Card de patrimônio no Dashboard: total hoje, resultado da carteira, próximo provento e evolução mensal.
// =========================================================

import { calcInvestmentMetrics, netWorthSeries } from "../calc.js";
import { baseLineOptions, hexToRgba } from "./charts.js";
import { formatCurrency, formatDate, state } from "./core.js";
import { getPendingUpcomingDividends } from "./dividends.js";

const nw = {
  card: document.getElementById("networth-card"),
  total: document.getElementById("networth-total"),
  cash: document.getElementById("networth-cash"),
  portfolio: document.getElementById("networth-portfolio"),
  result: document.getElementById("networth-result"),
  next: document.getElementById("networth-next"),
  canvas: document.getElementById("networth-chart"),
};
let chart = null;

export function renderNetWorth() {
  if (!nw.card) return;
  const investments = state.lastInvestments || [];
  const transactions = state.lastTransactions || [];
  nw.card.classList.toggle("hidden", investments.length === 0 && transactions.length === 0);

  const series = netWorthSeries(transactions, investments);
  const metrics = investments.map(calcInvestmentMetrics);
  const portfolio = metrics.reduce((s, m) => s + m.totalValue, 0);
  const profit = metrics.reduce((s, m) => s + m.profitValue, 0);
  const cash = series[series.length - 1].cash;

  nw.total.textContent = formatCurrency(cash + portfolio);
  nw.cash.textContent = formatCurrency(cash);
  nw.portfolio.textContent = formatCurrency(portfolio);
  nw.result.textContent = formatCurrency(profit);
  nw.result.classList.toggle("text-emerald-400", profit > 0);
  nw.result.classList.toggle("text-red-400", profit < 0);

  const next = getPendingUpcomingDividends()[0];
  nw.next.textContent = next ? `Próximo provento: ${next.ticker}, ${formatCurrency(next.total)} em ${formatDate(next.paymentDate)}` : "";

  if (!window.Chart || !nw.canvas) return;
  const data = {
    labels: series.map((p) => p.label),
    datasets: [{ data: series.map((p) => p.total), borderColor: "#3b82f6", backgroundColor: hexToRgba("#3b82f6", 0.15), fill: true, tension: 0.35, pointRadius: 2 }],
  };
  if (chart) {
    chart.data = data;
    chart.update("none");
  } else chart = new Chart(nw.canvas.getContext("2d"), { type: "line", data, options: baseLineOptions });
}
