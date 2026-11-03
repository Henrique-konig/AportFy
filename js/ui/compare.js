// =========================================================
// AportFy — ui/compare.js
// Comparar 2 a 4 ativos lado a lado: indicadores (o melhor de cada linha em destaque) e preço na mesma escala.
// =========================================================

import { bestIndexes, compareSeries } from "../calc.js";
import { FMT } from "./analysis.js";
import { escapeHtml } from "./core.js";

const cEl = {
  modal: document.getElementById("compare-modal"),
  closeBtn: document.getElementById("compare-close-btn"),
  backdrop: document.getElementById("compare-modal-backdrop"),
  table: document.getElementById("compare-table"),
  chartWrap: document.getElementById("compare-chart-wrap"),
  canvas: document.getElementById("compare-chart"),
  status: document.getElementById("compare-status"),
};

const COLORS = ["#3b82f6", "#f97316", "#34d399", "#eab308"];
// [chave, rótulo, formatador, melhor]: "high" = maior é melhor, "low" = menor é melhor, null = sem juízo de valor.
const ROWS = [
  ["preco", "Cotação", FMT.money, null],
  ["dy", "Dividend yield", FMT.pct, "high"],
  ["pvp", "P/VP", FMT.num, "low"],
  ["pl", "P/L", FMT.num, "low"],
  ["roe", "ROE", FMT.pct, "high"],
  ["roic", "ROIC", FMT.pct, "high"],
  ["mLiquida", "Margem líquida", FMT.pct, "high"],
  ["dividaPl", "Dívida/PL", FMT.num, "low"],
  ["vacancia", "Vacância", FMT.pct, "low"],
  ["capRate", "Cap rate", FMT.pct, "high"],
  ["r1m", "Retorno 1 mês", FMT.pct, "high"],
  ["r6m", "Retorno 6 meses", FMT.pct, "high"],
  ["r12m", "Retorno 12 meses", FMT.pct, "high"],
  ["vol", "Volatilidade", FMT.pct, "low"],
  ["drawdown", "Maior queda 12m", FMT.pct, "high"],
  ["liquidez", "Liquidez diária", FMT.big, "high"],
];

let chart = null;
let tickers = []; // ativos abertos: respostas atrasadas de outra comparação são ignoradas

export function openCompareSheet(items) {
  tickers = items.map((i) => i.ticker);
  chart?.destroy();
  chart = null;
  const head = items.map((i, n) => `<th class="py-3 px-3 text-right font-semibold whitespace-nowrap"><span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${COLORS[n]}"></span>${escapeHtml(i.ticker)}</th>`).join("");
  const body = ROWS.map(([key, label, fmt, better]) => {
    const values = items.map((i) => i.row[key] ?? null);
    if (values.every((v) => v == null)) return "";
    const best = bestIndexes(values, better);
    return `<tr class="border-b border-slate-800/40"><td class="py-2.5 pr-3 text-slate-400 whitespace-nowrap">${label}</td>${values.map((v, n) => `<td class="py-2.5 px-3 text-right whitespace-nowrap ${best.includes(n) ? "text-emerald-400 font-semibold" : ""}">${v == null ? "—" : fmt(v)}</td>`).join("")}</tr>`;
  }).join("");
  cEl.table.innerHTML = `<table class="w-full text-sm"><thead><tr class="border-b border-slate-800/60"><th></th>${head}</tr></thead><tbody>${body}</tbody></table>`;
  cEl.chartWrap.classList.add("hidden");
  cEl.status.textContent = "Carregando o gráfico de preços…";
  cEl.modal.classList.remove("hidden");
  cEl.modal.classList.add("flex");
}

/** results: [{ ticker, ok, data: { closes } }] (respostas de fetchAssetHistory). */
export function setCompareHistory(forTickers, results) {
  if (forTickers.join() !== tickers.join()) return;
  const series = results.filter((r) => r.ok).map((r) => ({ ticker: r.ticker, closes: r.data.closes }));
  const { labels, lines } = compareSeries(series);
  if (lines.length < 2 || typeof Chart === "undefined") {
    cEl.status.textContent = lines.length < 2 ? "Histórico de preço indisponível agora." : "";
    return;
  }
  cEl.status.textContent = "Preços do último ano com início em 100 (Yahoo Finance). Desempenho passado não garante o futuro.";
  cEl.chartWrap.classList.remove("hidden");
  chart = new Chart(cEl.canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: lines.map((l) => {
        const color = COLORS[tickers.indexOf(l.ticker)];
        return { label: l.ticker, data: l.data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, spanGaps: true, tension: 0.2 };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: "#94a3b8", boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${FMT.num(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 }, maxTicksLimit: 6 } },
        y: { grid: { color: "rgba(51,65,85,0.35)" }, ticks: { color: "#64748b", font: { size: 11 } } },
      },
    },
  });
}

export function closeCompareSheet() {
  tickers = [];
  chart?.destroy();
  chart = null;
  cEl.modal.classList.add("hidden");
  cEl.modal.classList.remove("flex");
}

export function bindCompareSheet() {
  if (!cEl.modal) return;
  cEl.closeBtn.addEventListener("click", closeCompareSheet);
  cEl.backdrop.addEventListener("click", closeCompareSheet);
}
