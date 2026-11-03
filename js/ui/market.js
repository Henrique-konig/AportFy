// =========================================================
// AportFy — ui/market.js
// Radar do Mercado: índices (IBOV/IFIX), maiores altas e baixas, Tesouro e renda fixa.
// =========================================================

import { fixedIncomeRanking, indexStats } from "../calc.js";
import { fmtNum } from "../format.js";
import { escapeHtml } from "./core.js";

const rEl = {
  status: document.getElementById("radar-status"),
  indices: document.getElementById("radar-indices"),
  movers: document.getElementById("radar-movers"),
  fixed: document.getElementById("radar-fixed"),
};

const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${fmtNum(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const tone = (v) => (v == null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-400" : "text-red-400");
const reais = (v) => fmtNum(v, { style: "currency", currency: "BRL" }); // dado de mercado: não é mascarado pelo modo privacidade
const unavailable = `<p class="text-xs text-slate-500 py-6 text-center">Indisponível agora. Tente de novo em instantes.</p>`;

function renderIndices(indices) {
  const cards = [
    ["IBOVESPA", "Ibovespa", indices?.ibov],
    ["IFIX", "IFIX (fundos imobiliários)", indices?.ifix],
  ].map(([code, label, series]) => {
    const s = indexStats(series);
    if (!s) return `<div class="glass-card rounded-2xl p-5"><p class="text-xs font-medium text-slate-400">${escapeHtml(label)}</p>${unavailable}</div>`;
    const cell = (name, v) => `<div class="min-w-0"><p class="text-[11px] text-slate-500">${name}</p><p class="text-sm font-bold ${tone(v)}">${pct(v)}</p></div>`;
    return `
      <div class="glass-card rounded-2xl p-5 min-w-0">
        <p class="text-xs font-medium text-slate-400">${escapeHtml(label)}</p>
        <p class="text-2xl font-extrabold tracking-tight mt-1">${fmtNum(s.value, { maximumFractionDigits: 0 })} <span class="text-xs font-semibold text-slate-500">pontos</span></p>
        <div class="grid grid-cols-3 gap-3 mt-4">${cell("Dia", s.day)}${cell("30 dias", s.month)}${cell("12 meses", s.year)}</div>
        <p class="text-[11px] text-slate-600 mt-3">Fechamento de ${s.date.split("-").reverse().join("/")} (${code})</p>
      </div>`;
  });
  rEl.indices.innerHTML = cards.join("");
}

function moverList(title, items, emptyText) {
  const rows = items.length
    ? items
        .map(
          (m) => `
        <li class="flex items-center justify-between gap-3 py-2">
          <div class="min-w-0"><p class="text-sm font-semibold">${escapeHtml(m.ticker)}</p><p class="text-[11px] text-slate-500 truncate">${escapeHtml(m.name)}</p></div>
          <div class="text-right shrink-0"><p class="text-sm font-bold ${tone(m.change)}">${pct(m.change)}</p><p class="text-[11px] text-slate-500">${reais(m.price)}</p></div>
        </li>`
        )
        .join("")
    : `<li class="text-xs text-slate-500 py-4">${emptyText}</li>`;
  return `<div class="min-w-0"><p class="text-xs font-semibold text-slate-400 mb-1">${title}</p><ul class="divide-y divide-slate-800/60">${rows}</ul></div>`;
}

function renderMovers(overview) {
  const block = (title, data) =>
    `<div class="glass-card rounded-2xl p-5 min-w-0">
      <h4 class="font-bold text-sm mb-3">${title}</h4>
      ${
        data
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">${moverList("Maiores altas", data.up, "Nenhuma em alta entre as mais negociadas.")}${moverList("Maiores baixas", data.down, "Nenhuma em queda entre as mais negociadas.")}</div>`
          : unavailable
      }
    </div>`;
  rEl.movers.innerHTML = block("Ações", overview?.acoes) + block("Fundos imobiliários (FIIs)", overview?.fiis);
}

function renderFixed(overview) {
  const t = overview?.taxas || {};
  const { rows, breakevenCdb } = fixedIncomeRanking({ cdi: t.cdi, selic: t.selic, ipca: t.ipca, tesouro: overview?.tesouro || [] });
  if (!overview || rows.length === 0) {
    rEl.fixed.innerHTML = unavailable;
    return;
  }
  const chip = (label, v) => (v == null ? "" : `<span class="px-2.5 py-1 rounded-full bg-slate-800/70 text-[11px] font-semibold">${label} ${fmtNum(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>`);
  rEl.fixed.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-4">${chip("Selic", t.selic)}${chip("CDI", t.cdi)}${chip("IPCA 12m", t.ipca)}</div>
    <div class="overflow-x-auto custom-scroll">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/60">
          <th class="py-2 pr-3 font-medium">Investimento</th><th class="py-2 px-3 font-medium text-right">Bruto a.a.</th><th class="py-2 pl-3 font-medium text-right">Líquido a.a.</th>
        </tr></thead>
        <tbody>${rows
          .map(
            (r, i) => `
          <tr class="border-b border-slate-800/40 last:border-0">
            <td class="py-3 pr-3"><p class="font-semibold ${i === 0 ? "text-emerald-400" : ""}">${i === 0 ? "★ " : ""}${escapeHtml(r.nome)}</p><p class="text-[11px] text-slate-500">${escapeHtml(r.nota)}</p></td>
            <td class="py-3 px-3 text-right text-slate-400 whitespace-nowrap">${fmtNum(r.bruto, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
            <td class="py-3 pl-3 text-right font-bold whitespace-nowrap">${fmtNum(r.liquido, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td>
          </tr>`
          )
          .join("")}</tbody>
      </table>
    </div>
    <p class="text-xs text-slate-400 mt-4">Para um CDB empatar com uma LCI/LCA de 90% do CDI (isenta de IR), ele precisa pagar cerca de <strong>${fmtNum(breakevenCdb, { maximumFractionDigits: 1 })}% do CDI</strong>.</p>
    <p class="text-[11px] text-slate-600 mt-2">Estimativa para 1 a 2 anos, com IR de 17,5% (15% nos títulos longos). Tesouro com as taxas de hoje; CDB e LCI/LCA são exemplos, as ofertas reais variam por banco. Não é recomendação de investimento.</p>`;
}

/** Marca o Radar como carregando (ou mostra o texto de aviso). */
export function setRadarStatus(text) {
  if (!rEl.status) return;
  rEl.status.textContent = text || "";
  rEl.status.classList.toggle("hidden", !text);
}

/**
 * @param {{ overview: Object|null, indices: { ibov: Array, ifix: Array }|null }} data
 *   `overview` é a resposta de /api/mercado; `indices`, a de /api/indices.
 */
export function renderRadar({ overview, indices }) {
  if (!rEl.indices) return;
  renderIndices(indices);
  renderMovers(overview);
  renderFixed(overview);
  setRadarStatus(overview?.updatedAt ? `Atualizado às ${new Date(overview.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Variações do dia, com atraso.` : "");
}
