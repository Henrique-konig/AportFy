// =========================================================
// AportFy — api/mercado.js (Vercel Serverless Function)
// Dados do "Radar do Mercado" numa chamada só (cada parte falha sozinha, sem derrubar as outras):
//   - maiores altas e baixas do dia, de ações e FIIs (Brapi, só papéis líquidos);
//   - títulos do Tesouro Direto à venda (taxas de hoje);
//   - Selic, CDI e IPCA de 12 meses (Banco Central).
// IBOV e IFIX vêm de /api/indices (já existente).
//
//   GET /api/mercado
// =========================================================

import { parseBcbLast, parseTesouro, pickMovers } from "../js/calc.js";

const BRAPI_LIST = "https://brapi.dev/api/quote/list";
const TESOURO_URL = "https://www.tesourodireto.com.br/o/rentabilidade/investir";
const bcb = (serie) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;

// Cada fonte tem pouco tempo: uma lenta (o Banco Central oscila) não pode segurar a resposta das outras.
async function getJson(url, timeoutMs = 7000) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Lista da Brapi ordenada por variação; pega bastante para sobrar papéis líquidos depois do filtro. */
async function movers(type, { limit, ...options }) {
  const token = process.env.BRAPI_TOKEN ? `&token=${encodeURIComponent(process.env.BRAPI_TOKEN)}` : "";
  // Os mais NEGOCIADOS (uma chamada só, já líquidos); as maiores altas e baixas saem dentre eles.
  // Ordenar por variação trazia primeiro papéis parados, e as altas dos líquidos ficavam de fora.
  const { stocks } = await getJson(`${BRAPI_LIST}?sortBy=volume&sortOrder=desc&limit=${limit}&type=${type}${token}`);
  if (!Array.isArray(stocks) || stocks.length === 0) throw new Error("Brapi sem resposta");
  return pickMovers(stocks, { top: 5, ...options });
}

/** Cotação de agora de um índice (Yahoo Finance, atraso de alguns minutos) e o fechamento anterior. */
async function liveIndex(symbol) {
  const json = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
  const meta = json.chart?.result?.[0]?.meta;
  if (!(meta?.regularMarketPrice > 0) || !(meta?.chartPreviousClose > 0)) throw new Error("sem cotação");
  return { price: meta.regularMarketPrice, prev: meta.chartPreviousClose, time: new Date(meta.regularMarketTime * 1000).toISOString() };
}

// FIIs e Fiagros (a lista "fund" também traz ETFs, que ficam de fora).
export const FII_NAME = /IMOBILI|\bFII\b|AGROINDUSTRI|FIAGRO/i;

const settled = async (promise) => {
  try {
    return await promise;
  } catch {
    return null; // essa parte falhou; o resto segue
  }
};

export default async function handler(req, res) {
  const diag = {}; // diagnóstico curto de cada fonte (ajuda quando uma delas muda de formato)
  const [ibov, ifix, acoes, fiis, tesouro, selicMeta, cdiAnual, ipca] = await Promise.all([
    settled(liveIndex("%5EBVSP")),
    settled(liveIndex("IFIX.SA")),
    settled(movers("stock", { limit: 100, minTurnover: 5_000_000 })),
    settled(movers("fund", { limit: 250, minTurnover: 2_000_000, nameMatch: FII_NAME })),
    settled(
      getJson(TESOURO_URL).then((json) => {
        const list = parseTesouro(json);
        diag.tesouro = { chaves: Object.keys(json || {}).slice(0, 6), legado: Array.isArray(json?.TesouroLegado) ? json.TesouroLegado.length : null, aceitos: list.length };
        return list;
      })
    ),
    settled(getJson(bcb(432)).then(parseBcbLast)), // meta da Selic, % a.a.
    settled(getJson(bcb(4389)).then(parseBcbLast)), // CDI anualizado, % a.a.
    settled(getJson(bcb(13522)).then(parseBcbLast)), // IPCA acumulado em 12 meses, %
  ]);

  // Selic e CDI andam colados (o CDI fica ~0,10 ponto abaixo): se um deles faltar, estima pelo outro.
  const selic = selicMeta ?? (cdiAnual != null ? Math.round((cdiAnual + 0.1) * 100) / 100 : null);
  const cdi = cdiAnual ?? (selicMeta != null ? Math.round((selicMeta - 0.1) * 100) / 100 : null);
  if (selicMeta == null && selic != null) diag.selic = "estimada pelo CDI";

  const ok = [acoes, fiis, tesouro, selic, cdi, ipca, ibov, ifix].some((part) => part != null);
  // Resposta completa fica 1 min em cache (os índices são ao vivo); incompleta (uma fonte falhou ou veio vazia) só 20 s,
  // para não prender o erro.
  const complete = acoes && fiis && tesouro?.length > 0 && selic != null && cdi != null && ipca != null && ibov && ifix;
  if (ok) res.setHeader("Cache-Control", complete ? "public, s-maxage=60, stale-while-revalidate=300" : "public, s-maxage=20");
  return res.status(ok ? 200 : 502).json({ updatedAt: new Date().toISOString(), indices: { ibov, ifix }, acoes, fiis, tesouro, taxas: { selic, cdi, ipca }, diag });
}
