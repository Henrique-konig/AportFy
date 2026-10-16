// =========================================================
// AportFy — ui/charts.js
// Gráficos do Dashboard e helpers de gráficos compartilhados.
// =========================================================

import { buildMonthlySeries } from "../calc.js";
import { CATEGORY_COLORS, el, escapeHtml, getModeColor, state } from "./core.js";
import { dashPeriodDate } from "./dashboard.js";

/* ---------------------------------------------------------------
   Gráficos (Chart.js) — Dashboard
--------------------------------------------------------------- */
export function hexToRgba(hex, alpha) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      borderColor: "#334155",
      borderWidth: 1,
      padding: 10,
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
    y: {
      grid: { color: "rgba(51,65,85,0.35)" },
      ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
    },
  },
};

export function initCharts() {
  state.cashflowChart = new Chart(el.cashflowCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  state.categoryChart = new Chart(el.categoryCanvas.getContext("2d"), {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
    },
  });
}

export function initReportsCharts() {
  state.reportsCashflowChart = new Chart(el.reportsCashflowCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  state.reportsCategoryChart = new Chart(el.reportsCategoryCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
      scales: {
        x: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
        y: { grid: { display: false }, ticks: { color: "#cbd5e1", font: { size: 11 } } },
      },
    },
  });
}

export function buildCashflowDatasets(canvas, labels, income, expense) {
  const ctx = canvas.getContext("2d");
  const modeColor = getModeColor();

  const incomeGradient = ctx.createLinearGradient(0, 0, 0, 280);
  incomeGradient.addColorStop(0, hexToRgba(modeColor, 0.35));
  incomeGradient.addColorStop(1, hexToRgba(modeColor, 0));

  const expenseGradient = ctx.createLinearGradient(0, 0, 0, 280);
  expenseGradient.addColorStop(0, hexToRgba("#64748b", 0.25));
  expenseGradient.addColorStop(1, hexToRgba("#64748b", 0));

  return {
    labels,
    datasets: [
      {
        label: "Receitas",
        data: income,
        borderColor: modeColor,
        backgroundColor: incomeGradient,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: modeColor,
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        borderWidth: 2.5,
      },
      {
        label: "Despesas",
        data: expense,
        borderColor: "#64748b",
        backgroundColor: expenseGradient,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#64748b",
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        borderWidth: 2.5,
        borderDash: [4, 4],
      },
    ],
  };
}

export function updateCharts(transactions) {
  state.lastTransactions = transactions;
  if (!state.cashflowChart || !state.categoryChart) return;

  const { labels, income, expense } = buildMonthlySeries(transactions, 6, dashPeriodDate());
  const built = buildCashflowDatasets(el.cashflowCanvas, labels, income, expense);
  state.cashflowChart.data.labels = built.labels;
  state.cashflowChart.data.datasets = built.datasets;
  state.cashflowChart.update();

  // Categoria (despesas do período selecionado no filtro do dashboard)
  const isAllPeriod = state.dashPeriodFilterValue === "all";
  const categoryTotals = {};
  transactions
    .filter((t) => t.type === "expense" && (isAllPeriod || t.date.slice(0, 7) === state.dashPeriodFilterValue))
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (Number(t.amount) || 0);
    });

  const catLabels = Object.keys(categoryTotals);
  const catValues = Object.values(categoryTotals);
  const catColors = catLabels.map((c) => CATEGORY_COLORS[c] || CATEGORY_COLORS["Outros"]);

  state.categoryChart.data.labels = catLabels;
  state.categoryChart.data.datasets = [
    {
      data: catValues.length ? catValues : [1],
      backgroundColor: catValues.length ? catColors : ["#1e293b"],
      borderColor: "#0f172a",
      borderWidth: 3,
      hoverOffset: 6,
    },
  ];
  state.categoryChart.update();

  const total = catValues.reduce((a, b) => a + b, 0);
  el.categoryLegend.innerHTML = catLabels.length
    ? catLabels
        .map((label, i) => {
          const pct = total > 0 ? ((catValues[i] / total) * 100).toFixed(0) : 0;
          return `
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-slate-400">
              <span class="w-2.5 h-2.5 rounded-full" style="background:${catColors[i]};"></span>
              ${escapeHtml(label)}
            </span>
            <span class="font-semibold text-slate-300">${pct}%</span>
          </div>`;
        })
        .join("")
    : `<p class="text-slate-600 text-center">Sem despesas registradas.</p>`;
}

