// =========================================================
// AportFy — ui/analysis.js
// Aba Análise: ranking de FIIs e ações com filtros e ordenação (dados do Fundamentus).
// =========================================================

import { applyScreen } from "../calc.js";
import { fmtNum } from "../format.js";
import { delegateClick, escapeHtml, state } from "./core.js";

const PAGE = 50;
// Para estes, o melhor valor é o MENOR: o 1º clique no cabeçalho ordena do menor para o maior.
const ASC_FIRST = new Set(["ticker", "nome", "segmento", "pvp", "pl", "dividaPl", "vacancia", "vol"]);
const TEXT_COLS = new Set(["segmento", "nome"]); // colunas de texto: alinhadas à esquerda

const aEl = {
  tabs: document.querySelectorAll("[data-analysis-tab]"),
  filters: document.getElementById("analysis-filters"),
  table: document.getElementById("analysis-table"),
  count: document.getElementById("analysis-count"),
  moreWrap: document.getElementById("analysis-more-wrap"),
  moreBtn: document.getElementById("analysis-more-btn"),
  status: document.getElementById("analysis-status"),
};

const num = (v) => (v == null ? "—" : fmtNum(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (v) => (v == null ? "—" : `${num(v)}%`);
const money = (v) => (v == null ? "—" : fmtNum(v, { style: "currency", currency: "BRL" }));
const ret = (v) => (v == null ? "—" : `<span class="${v >= 0 ? "text-emerald-400" : "text-red-400"}">${v > 0 ? "+" : ""}${pct(v)}</span>`);
const bigMoney =(v) => (v == null ? "—" : fmtNum(v, { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }));

// Cada aba: filtros (min/max de um indicador), colunas [chave, título, formatador] e ordenação inicial.
const CONFIG = {
  fiis: {
    segment: true,
    segmentLabel: "Segmento",
    filters: [
      { key: "dy", bound: "min", label: "DY mín. (%)", value: "" },
      { key: "pvp", bound: "max", label: "P/VP máx.", value: "" },
      { key: "vacancia", bound: "max", label: "Vacância máx. (%)", value: "" },
      { key: "liquidez", bound: "min", label: "Liquidez diária mín. (R$)", value: "500000" },
    ],
    columns: [["ticker", "Fundo"], ["segmento", "Segmento", (v) => escapeHtml(v)], ["preco", "Cotação", money], ["dy", "DY", pct], ["pvp", "P/VP", num], ["vacancia", "Vacância", pct], ["capRate", "Cap rate", pct], ["liquidez", "Liquidez/dia", bigMoney]],
    sort: { key: "dy", dir: "desc" },
  },
  etfs: {
    segment: true,
    segmentLabel: "Classe",
    filters: [
      { key: "r12m", bound: "min", label: "Retorno 12m mín. (%)", value: "" },
      { key: "vol", bound: "max", label: "Volatilidade máx. (%)", value: "" },
      { key: "liquidez", bound: "min", label: "Liquidez diária mín. (R$)", value: "500000" },
    ],
    columns: [["ticker", "ETF"], ["nome", "Nome", (v) => escapeHtml(v)], ["segmento", "Classe", (v) => escapeHtml(v)], ["preco", "Cotação", money], ["r1m", "1 mês", ret], ["r6m", "6 meses", ret], ["r12m", "12 meses", ret], ["vol", "Volatil.", pct], ["drawdown", "Maior queda", pct], ["liquidez", "Liquidez/dia", bigMoney]],
    sort: { key: "r12m", dir: "desc" },
  },
  acoes: {
    filters: [
      { key: "pl", bound: "max", label: "P/L máx.", value: "" },
      { key: "pvp", bound: "max", label: "P/VP máx.", value: "" },
      { key: "dy", bound: "min", label: "DY mín. (%)", value: "" },
      { key: "roe", bound: "min", label: "ROE mín. (%)", value: "" },
      { key: "dividaPl", bound: "max", label: "Dívida/PL máx.", value: "" },
      { key: "liquidez", bound: "min", label: "Liquidez diária mín. (R$)", value: "1000000" },
    ],
    columns: [["ticker", "Ação"], ["preco", "Cotação", money], ["pl", "P/L", num], ["pvp", "P/VP", num], ["dy", "DY", pct], ["roe", "ROE", pct], ["roic", "ROIC", pct], ["mLiquida", "Marg. líq.", pct], ["dividaPl", "Dívida/PL", num], ["cresc5a", "Cresc. 5a", pct], ["liquidez", "Liquidez/dia", bigMoney]],
    sort: { key: "dy", dir: "desc" },
  },
};

let data; // undefined = carregando, null = falhou, { fiis, acoes } (cada uma pode ser null)
let etfs; // idem, a lista de ETFs (vem de outra função, só carregada ao abrir a aba)
// Linhas de uma aba: undefined = carregando, null = indisponível.
const rowsOf = (name) => (name === "etfs" ? etfs : data === undefined ? undefined : (data?.[name] ?? null));
let tab = "fiis";
const tabState = Object.fromEntries(
  Object.entries(CONFIG).map(([name, cfg]) => [name, { sort: { ...cfg.sort }, values: Object.fromEntries(cfg.filters.map((f) => [f.key, f.value])), search: "", segmento: "", limit: PAGE }])
);

const INPUT = "w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 transition-all";

function renderFilters() {
  const cfg = CONFIG[tab];
  const st = tabState[tab];
  const segments = cfg.segment ? [...new Set((rowsOf(tab) || []).map((r) => r.segmento).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : [];
  const field = (label, control) => `<label class="block min-w-0"><span class="block text-[11px] text-slate-500 mb-1">${label}</span>${control}</label>`;
  aEl.filters.innerHTML =
    field("Buscar", `<input type="search" data-analysis-search value="${escapeHtml(st.search)}" placeholder="Ticker" class="${INPUT}" />`) +
    (cfg.segment
      ? field(cfg.segmentLabel, `<select data-analysis-segment class="${INPUT}"><option value="">Todos</option>${segments.map((s) => `<option value="${escapeHtml(s)}"${s === st.segmento ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}</select>`)
      : "") +
    cfg.filters.map((f) => field(f.label, `<input type="number" step="any" data-analysis-filter="${f.key}" value="${escapeHtml(st.values[f.key])}" class="${INPUT}" />`)).join("");
}

function limits(kind) {
  const st = tabState[tab];
  const out = {};
  CONFIG[tab].filters.filter((f) => f.bound === kind).forEach((f) => (out[f.key] = st.values[f.key] === "" ? null : Number(st.values[f.key])));
  return out;
}

function renderTable() {
  const cfg = CONFIG[tab];
  const st = tabState[tab];
  const rows = rowsOf(tab);
  if (rows === undefined) {
    aEl.table.innerHTML = `<p class="text-xs text-slate-500 py-10 text-center animate-pulse">Carregando…</p>`;
    aEl.count.textContent = "";
    aEl.moreWrap.classList.add("hidden");
    return;
  }
  if (!rows) {
    aEl.table.innerHTML = `<p class="text-xs text-slate-500 py-10 text-center">Indisponível agora. Tente de novo em instantes.</p>`;
    aEl.count.textContent = "";
    aEl.moreWrap.classList.add("hidden");
    return;
  }

  const found = applyScreen(rows, { search: st.search, segmento: st.segmento, min: limits("min"), max: limits("max"), sort: st.sort });
  const shown = found.slice(0, st.limit);
  const owned = new Set(state.lastInvestments.map((i) => i.ticker));
  const arrow = (key) => (st.sort.key === key ? (st.sort.dir === "asc" ? " ▲" : " ▼") : "");

  aEl.count.textContent = `${found.length} de ${rows.length}`;
  aEl.moreWrap.classList.toggle("hidden", found.length <= st.limit);
  aEl.moreWrap.classList.toggle("flex", found.length > st.limit);
  document.getElementById("analysis-more-remaining").textContent = `(${found.length - st.limit})`;

  aEl.table.innerHTML =
    found.length === 0
      ? `<p class="text-xs text-slate-500 py-10 text-center">Nenhum resultado com esses filtros.</p>`
      : `<table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
            ${cfg.columns.map(([key, title], i) => `<th class="py-3 ${i === 0 ? "pr-3" : "px-3"} font-medium whitespace-nowrap ${i === 0 || TEXT_COLS.has(key) ? "" : "text-right"}"><button type="button" data-analysis-sort="${key}" class="hover:text-white transition-colors uppercase">${title}${arrow(key)}</button></th>`).join("")}
          </tr></thead>
          <tbody>${shown
            .map(
              (r) => `<tr class="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">${cfg.columns
                .map(([key, , fmt], i) => {
                  if (i === 0) return `<td class="py-2.5 pr-3 font-semibold whitespace-nowrap"><button type="button" data-analysis-open="${escapeHtml(r.ticker)}" class="font-semibold hover:text-blue-400 transition-colors">${owned.has(r.ticker) ? `<span class="text-amber-400" title="Você tem este ativo">★</span> ` : ""}${escapeHtml(r.ticker)}</button></td>`;
                  return `<td class="py-2.5 px-3 whitespace-nowrap ${TEXT_COLS.has(key) ? "text-slate-400" : "text-right"}">${fmt ? fmt(r[key]) : r[key]}</td>`;
                })
                .join("")}</tr>`
            )
            .join("")}</tbody>
        </table>`;
}

let fundamentusNote = "";
const ETF_NOTE = "Retornos, volatilidade e maior queda calculados do histórico de 1 ano (Yahoo Finance), com cotação da Brapi. Desempenho passado não garante o futuro; não é recomendação.";

function renderAll() {
  aEl.tabs.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.analysisTab === tab)));
  renderFilters();
  renderTable();
  aEl.status.textContent = tab === "etfs" ? ETF_NOTE : fundamentusNote;
}

/** Recebe os dados de /api/fundamentos (undefined = carregando, null = falhou). */
export function setAnalysisData(next) {
  data = next;
  fundamentusNote = next?.updatedAt ? `Fonte: Fundamentus, dados do último fechamento (atualizado às ${new Date(next.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}). Indicadores não são recomendação de compra ou venda.` : "";
  if (aEl.table) renderAll();
}

/** Recebe a lista de ETFs de /api/etfs (undefined = carregando, null = falhou). */
export function setEtfData(next) {
  etfs = next?.etfs ?? next;
  if (aEl.table) renderAll();
}

/** `onOpen(ticker, kind, row, owned)` abre a ficha do ativo ao clicar num ticker; `onTab(nome)` avisa a troca de aba. */
export function bindAnalysis({ onOpen, onTab } = {}) {
  if (!aEl.table) return;
  aEl.tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      tab = btn.dataset.analysisTab;
      renderAll();
      onTab?.(tab);
    })
  );
  // Filtros: um ouvinte só, que lê qual campo mudou.
  aEl.filters.addEventListener("input", (e) => {
    const st = tabState[tab];
    const t = e.target;
    if (t.matches("[data-analysis-filter]")) st.values[t.dataset.analysisFilter] = t.value;
    else if (t.matches("[data-analysis-search]")) st.search = t.value;
    else if (t.matches("[data-analysis-segment]")) st.segmento = t.value;
    else return;
    st.limit = PAGE;
    renderTable();
  });
  delegateClick(aEl.table, "[data-analysis-sort]", (btn) => {
    const st = tabState[tab];
    const key = btn.dataset.analysisSort;
    st.sort = st.sort.key === key ? { key, dir: st.sort.dir === "asc" ? "desc" : "asc" } : { key, dir: ASC_FIRST.has(key) ? "asc" : "desc" };
    st.limit = PAGE;
    renderTable();
  });
  delegateClick(aEl.table, "[data-analysis-open]", (btn) => {
    const ticker = btn.dataset.analysisOpen;
    const row = rowsOf(tab)?.find((r) => r.ticker === ticker);
    if (row) onOpen?.(ticker, tab, row, state.lastInvestments.some((i) => i.ticker === ticker));
  });
  aEl.moreBtn.addEventListener("click", () => {
    tabState[tab].limit += PAGE;
    renderTable();
  });
  renderAll();
}

export const FMT = { num, pct, money, big: bigMoney };
