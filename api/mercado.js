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

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Lista da Brapi ordenada por variação; pega bastante para sobrar papéis líquidos depois do filtro. */
async function movers(type, options) {
  const token = process.env.BRAPI_TOKEN ? `&token=${encodeURIComponent(process.env.BRAPI_TOKEN)}` : "";
  const query = (order) => `${BRAPI_LIST}?sortBy=change&sortOrder=${order}&limit=150&type=${type}${token}`;
  // A Brapi limita chamadas simultâneas: se uma metade falhar, usa a outra em vez de perder tudo.
  const halves = await Promise.allSettled([getJson(query("desc")), getJson(query("asc"))]);
  const rows = halves.flatMap((h) => (h.status === "fulfilled" ? h.value.stocks || [] : []));
  if (rows.length === 0) throw new Error("Brapi sem resposta");
  return pickMovers(rows, { top: 5, ...options });
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
  const [acoes, fiis, tesouro, selic, cdi, ipca] = await Promise.all([
    settled(movers("stock", { minTurnover: 5_000_000 })),
    settled(movers("fund", { minTurnover: 2_000_000, nameMatch: FII_NAME })),
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

  const ok = [acoes, fiis, tesouro, selic, cdi, ipca].some((part) => part != null);
  if (ok) res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
  return res.status(ok ? 200 : 502).json({ updatedAt: new Date().toISOString(), acoes, fiis, tesouro, taxas: { selic, cdi, ipca }, diag });
}
