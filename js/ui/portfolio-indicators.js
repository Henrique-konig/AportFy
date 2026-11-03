// =========================================================
// AportFy — ui/portfolio-indicators.js
// Investimentos > "Indicadores da carteira": DY, P/VP, P/L e ROE dos seus FIIs e ações (dados do Fundamentus).
// =========================================================

import { portfolioIndicators } from "../calc.js";
import { FMT } from "./analysis.js";
import { delegateClick, escapeHtml, state } from "./core.js";

const pEl = {
  section: document.getElementById("inv-indicators"),
  kpis: document.getElementById("inv-ind-kpis"),
  table: document.getElementById("inv-ind-table"),
  note: document.getElementById("inv-ind-note"),
};

let fundamentals; // undefined = ainda carregando, null = falhou
let onOpenAsset;

const tile = (label, value) => `<div class="rounded-xl bg-slate-900/60 border border-slate-800/60 px-3 py-2.5 min-w-0"><p class="text-[11px] text-slate-500">${label}</p><p class="text-base font-bold truncate">${value}</p></div>`;
const cell = (v, fmt) => `<td class="py-2.5 px-3 text-right whitespace-nowrap">${v == null ? "—" : fmt(v)}</td>`;

export function renderPortfolioIndicators() {
  if (!pEl.section) return;
  const { rows, avg, missing } = portfolioIndicators(state.lastInvestments, fundamentals);
  const hasB3 = rows.length + missing.length > 0;
  pEl.section.classList.toggle("hidden", !hasB3);
  if (!hasB3) return;

  if (fundamentals === undefined || (fundamentals === null && rows.length === 0)) {
    pEl.kpis.innerHTML = "";
    pEl.table.innerHTML = `<p class="text-xs text-slate-500 py-6 text-center ${fundamentals === undefined ? "animate-pulse" : ""}">${fundamentals === undefined ? "Carregando indicadores…" : "Indicadores indisponíveis agora."}</p>`;
    pEl.note.textContent = "";
    return;
  }

  const kpis = [
    ["DY médio · FIIs", avg.fiis.dy, FMT.pct],
    ["P/VP médio · FIIs", avg.fiis.pvp, FMT.num],
    ["Vacância média · FIIs", avg.fiis.vacancia, FMT.pct],
    ["DY médio · Ações", avg.acoes.dy, FMT.pct],
    ["P/L médio · Ações", avg.acoes.pl, FMT.num],
    ["ROE médio · Ações", avg.acoes.roe, FMT.pct],
  ];
  pEl.kpis.innerHTML = kpis.filter(([, v]) => v != null).map(([label, v, fmt]) => tile(label, fmt(v))).join("");

  pEl.table.innerHTML = `<table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
      <th class="py-3 pr-3 font-medium">Ativo</th>${["Peso", "DY", "P/VP", "P/L", "ROE", "Vacância"].map((t) => `<th class="py-3 px-3 font-medium text-right">${t}</th>`).join("")}
    </tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr class="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
          <td class="py-2.5 pr-3 whitespace-nowrap"><button type="button" data-ind-open="${escapeHtml(r.ticker)}" class="font-semibold hover:text-blue-400 transition-colors">${escapeHtml(r.ticker)}</button></td>
          ${cell(r.weight, FMT.pct)}${cell(r.dy, FMT.pct)}${cell(r.pvp, FMT.num)}${cell(r.pl, FMT.num)}${cell(r.roe, FMT.pct)}${cell(r.vacancia, FMT.pct)}</tr>`
      )
      .join("")}</tbody></table>`;
  pEl.note.textContent =
    `Médias ponderadas pelo valor de cada posição (P/L e P/VP em média harmônica). Dados do Fundamentus, do último fechamento.` +
    (missing.length ? ` Sem dados para: ${missing.join(", ")}.` : "");
}

/** Recebe os dados de /api/fundamentos (undefined = carregando, null = falhou) e redesenha. */
export function setPortfolioFundamentals(next) {
  fundamentals = next;
  renderPortfolioIndicators();
}

/** `onOpen(ticker, kind, row, owned)` abre a ficha do ativo ao clicar num ticker. */
export function bindPortfolioIndicators({ onOpen } = {}) {
  onOpenAsset = onOpen;
  if (!pEl.table) return;
  delegateClick(pEl.table, "[data-ind-open]", (btn) => {
    const ticker = btn.dataset.indOpen;
    for (const kind of ["fiis", "acoes"]) {
      const row = fundamentals?.[kind]?.find((r) => r.ticker === ticker);
      if (row) return onOpenAsset?.(ticker, kind, row, true);
    }
  });
}
