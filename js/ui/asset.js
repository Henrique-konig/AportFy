// =========================================================
// AportFy — ui/asset.js
// Ficha do ativo: cotação, gráfico de 1 ano, indicadores e proventos de uma ação ou FII.
// =========================================================

import { ALERT_METRICS, alertLabel, dividendSummary, priceStats } from "../calc.js";
import { fmtDate } from "../format.js";
import { FMT } from "./analysis.js";
import { delegateClick, escapeHtml } from "./core.js";
import { isWatched, onWatchlistChange, saveWatchAlerts, toggleWatch, watchItem } from "./watchlist.js";

const sEl = {
  modal: document.getElementById("asset-modal"),
  closeBtn: document.getElementById("asset-close-btn"),
  backdrop: document.getElementById("asset-modal-backdrop"),
  title: document.getElementById("asset-title"),
  name: document.getElementById("asset-name"),
  price: document.getElementById("asset-price"),
  stats: document.getElementById("asset-stats"),
  chartWrap: document.getElementById("asset-chart-wrap"),
  canvas: document.getElementById("asset-chart"),
  indicators: document.getElementById("asset-indicators"),
  dividends: document.getElementById("asset-dividends"),
  watchBtn: document.getElementById("asset-watch-btn"),
  alerts: document.getElementById("asset-alerts"),
  alertsList: document.getElementById("asset-alerts-list"),
  alertMetric: document.getElementById("asset-alert-metric"),
  alertOp: document.getElementById("asset-alert-op"),
  alertValue: document.getElementById("asset-alert-value"),
  alertAddBtn: document.getElementById("asset-alert-add-btn"),
};

// Indicadores mostrados na ficha: [chave, rótulo, formatador].
const INDICATORS = {
  fiis: [["segmento", "Segmento", escapeHtml], ["dy", "Dividend yield", FMT.pct], ["pvp", "P/VP", FMT.num], ["vacancia", "Vacância", FMT.pct], ["capRate", "Cap rate", FMT.pct], ["mercado", "Valor de mercado", FMT.big], ["liquidez", "Liquidez diária", FMT.big]],
  etfs: [["segmento", "Classe", escapeHtml], ["r1m", "Retorno 1 mês", FMT.pct], ["r6m", "Retorno 6 meses", FMT.pct], ["r12m", "Retorno 12 meses", FMT.pct], ["vol", "Volatilidade", FMT.pct], ["drawdown", "Maior queda 12m", FMT.pct], ["liquidez", "Liquidez diária", FMT.big]],
  acoes: [["pl", "P/L", FMT.num], ["pvp", "P/VP", FMT.num], ["dy", "Dividend yield", FMT.pct], ["roe", "ROE", FMT.pct], ["roic", "ROIC", FMT.pct], ["mLiquida", "Margem líquida", FMT.pct], ["dividaPl", "Dívida/PL", FMT.num], ["evEbitda", "EV/EBITDA", FMT.num], ["cresc5a", "Crescimento 5 anos", FMT.pct], ["liquidez", "Liquidez diária", FMT.big]],
};

let chart = null;
let currentKind = null;
let current = null; // ticker aberto: respostas atrasadas de outro ativo são ignoradas

const tile = (label, value, tone = "") => `<div class="rounded-xl bg-slate-900/60 border border-slate-800/60 px-3 py-2.5 min-w-0"><p class="text-[11px] text-slate-500">${label}</p><p class="text-sm font-semibold truncate ${tone}">${value}</p></div>`;
const signed = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${FMT.pct(v)}`);
const tone = (v) => (v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "");
const day = (iso, options) => fmtDate(new Date(`${iso}T12:00:00`), options);
const loading = (text) => `<p class="text-xs text-slate-500 py-4 text-center animate-pulse">${text}</p>`;

/** Estrela dos favoritos e lista de alertas (alertas só para FIIs e ações: ETF não tem esses indicadores). */
function renderWatch() {
  if (!current) return;
  const watched = isWatched(current);
  sEl.watchBtn.classList.toggle("text-blue-400", watched);
  sEl.watchBtn.setAttribute("aria-pressed", String(watched));
  sEl.watchBtn.setAttribute("aria-label", watched ? "Remover dos favoritos" : "Adicionar aos favoritos");
  const metrics = ALERT_METRICS[currentKind];
  sEl.alerts.classList.toggle("hidden", !metrics);
  if (!metrics) return;
  const alerts = watchItem(current)?.alerts || [];
  sEl.alertsList.innerHTML = alerts.length
    ? `<ul class="divide-y divide-slate-800/50 text-sm">${alerts.map((a, i) => `<li class="flex items-center justify-between py-1.5"><span>${escapeHtml(alertLabel(currentKind, a))}</span><button type="button" data-alert-remove="${i}" class="text-slate-500 hover:text-red-400 transition-colors" aria-label="Remover alerta"><i class="ph-bold ph-trash"></i></button></li>`).join("")}</ul>`
    : `<p class="text-xs text-slate-500">Nenhum alerta.</p>`;
}

export function openAssetSheet({ ticker, kind, row, owned }) {
  current = ticker;
  currentKind = kind;
  sEl.alertMetric.innerHTML = (ALERT_METRICS[kind] || []).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  sEl.alertValue.value = "";
  renderWatch();
  chart?.destroy();
  chart = null;
  sEl.title.textContent = ticker;
  sEl.name.textContent = owned ? "★ Você tem este ativo" : "";
  sEl.price.textContent = FMT.money(row.preco);
  sEl.stats.innerHTML = "";
  sEl.chartWrap.classList.add("hidden");
  sEl.indicators.innerHTML = INDICATORS[kind].map(([key, label, fmt]) => tile(label, row[key] == null ? "—" : fmt(row[key]))).join("");
  sEl.dividends.innerHTML = loading("Carregando proventos…");
  sEl.modal.classList.remove("hidden");
  sEl.modal.classList.add("flex");
}

/** Gráfico e variações (res: resposta de fetchAssetHistory). */
export function setAssetHistory(ticker, res) {
  if (ticker !== current) return;
  const stats = res.ok ? priceStats(res.data.closes) : null;
  if (!stats) {
    sEl.stats.innerHTML = `<p class="col-span-full text-xs text-slate-500">Histórico de preço indisponível agora.</p>`;
    return;
  }
  sEl.name.textContent = [res.data.name, sEl.name.textContent].filter(Boolean).join(" · ");
  sEl.price.textContent = FMT.money(res.data.price);
  sEl.stats.innerHTML =
    tile("Hoje", signed(stats.day), tone(stats.day)) +
    tile("12 meses", signed(stats.year), tone(stats.year)) +
    tile("Máx. / mín. 12m", `${FMT.money(stats.high)} / ${FMT.money(stats.low)}`) +
    tile("Da máxima", signed(stats.fromHigh), tone(stats.fromHigh));
  if (typeof Chart === "undefined") return;
  sEl.chartWrap.classList.remove("hidden");
  const up = stats.year >= 0;
  chart = new Chart(sEl.canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: res.data.closes.map((c) => c[0]),
      datasets: [{ data: res.data.closes.map((c) => c[1]), borderColor: up ? "#34d399" : "#f87171", backgroundColor: up ? "rgba(52,211,153,0.10)" : "rgba(248,113,113,0.10)", borderWidth: 2, pointRadius: 0, fill: true, tension: 0.2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, callbacks: { title: (items) => day(items[0].label), label: (ctx) => ` ${FMT.money(ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 }, maxTicksLimit: 6, callback: (_, i, ticks) => day(res.data.closes[ticks[i].value][0], { month: "short" }) } },
        y: { grid: { color: "rgba(51,65,85,0.35)" }, ticks: { color: "#64748b", font: { size: 11 } } },
      },
    },
  });
}

/** Proventos (res: resposta de fetchDividendCalendar). */
export function setAssetDividends(ticker, res, price) {
  if (ticker !== current) return;
  if (!res.ok) {
    sEl.dividends.innerHTML = `<p class="text-xs text-slate-500 py-2">Proventos indisponíveis agora.</p>`;
    return;
  }
  const sum = dividendSummary(res.dividends, price);
  const recent = [...res.dividends].filter((d) => d.paymentDate).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).slice(0, 8);
  sEl.dividends.innerHTML =
    `<div class="grid grid-cols-3 gap-2 mb-3">${tile("Pago em 12 meses", `${FMT.money(sum.total)} /cota`)}${tile("Rendimento 12m", sum.yieldPct == null ? "—" : FMT.pct(sum.yieldPct))}${tile("Pagamentos", String(sum.count))}</div>` +
    (recent.length === 0
      ? `<p class="text-xs text-slate-500">Nenhum provento encontrado.</p>`
      : `<ul class="divide-y divide-slate-800/50 text-sm">${recent.map((d) => `<li class="flex justify-between py-1.5"><span class="text-slate-400">${day(d.paymentDate)} · ${escapeHtml(d.type)}</span><span class="font-semibold">${FMT.money(d.rate)}</span></li>`).join("")}</ul>`);
}

export function closeAssetSheet() {
  current = null;
  currentKind = null;
  chart?.destroy();
  chart = null;
  sEl.modal.classList.add("hidden");
  sEl.modal.classList.remove("flex");
}

export function bindAssetSheet() {
  if (!sEl.modal) return;
  sEl.closeBtn.addEventListener("click", closeAssetSheet);
  sEl.backdrop.addEventListener("click", closeAssetSheet);
  sEl.watchBtn.addEventListener("click", () => current && toggleWatch(current, currentKind));
  onWatchlistChange(renderWatch);
  sEl.alertAddBtn.addEventListener("click", () => {
    const value = Number(sEl.alertValue.value);
    const alerts = watchItem(current)?.alerts || [];
    if (!current || sEl.alertValue.value === "" || !Number.isFinite(value) || value < 0 || alerts.length >= 10) return;
    saveWatchAlerts(current, currentKind, [...alerts, { metric: sEl.alertMetric.value, op: sEl.alertOp.value, value, on: false }]);
    sEl.alertValue.value = "";
  });
  delegateClick(sEl.alertsList, "[data-alert-remove]", (btn) => {
    const alerts = watchItem(current)?.alerts || [];
    saveWatchAlerts(current, currentKind, alerts.filter((_, i) => i !== Number(btn.dataset.alertRemove)));
  });
}
