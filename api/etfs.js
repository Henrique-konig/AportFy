// =========================================================
// AportFy — api/etfs.js (Vercel Serverless Function)
// Ranking de ETFs da B3: os mais negociados (Brapi) com retorno de 1, 6 e 12 meses, volatilidade e
// maior queda calculados do histórico de 1 ano (Yahoo Finance). ETFs não têm P/L nem DY como
// ações e FIIs, então a comparação é por desempenho e risco. Cada ETF falha sozinho.
//
//   GET /api/etfs
//   -> { updatedAt, etfs: [{ticker, nome, segmento, preco, liquidez, r1m, r6m, r12m, vol, drawdown}], diag }
// =========================================================

import { etfStats, pickEtfs } from "../js/calc.js";

const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36", Accept: "application/json" };
const round = (v) => (v == null ? null : Math.round(v * 100) / 100);

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function history(ticker) {
  const result = (await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=1y`)).chart?.result?.[0];
  const prices = result?.indicators?.quote?.[0]?.close || [];
  return (result?.timestamp || []).map((t, i) => [t, prices[i]]).filter(([, p]) => p > 0);
}

export default async function handler(req, res) {
  try {
    const token = process.env.BRAPI_TOKEN ? `&token=${encodeURIComponent(process.env.BRAPI_TOKEN)}` : "";
    const { stocks } = await getJson(`https://brapi.dev/api/quote/list?sortBy=volume&sortOrder=desc&limit=400&type=fund${token}`);
    const picked = pickEtfs(stocks);
    if (picked.length === 0) throw new Error("Brapi sem ETFs");

    const etfs = await Promise.all(
      picked.map(async (etf) => {
        try {
          const stats = etfStats(await history(etf.ticker));
          return { ...etf, liquidez: Math.round(etf.liquidez), ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, round(v)])) };
        } catch {
          return { ...etf, liquidez: Math.round(etf.liquidez), r1m: null, r6m: null, r12m: null, vol: null, drawdown: null };
        }
      })
    );
    const withHistory = etfs.filter((e) => e.r1m != null).length;
    // Sem histórico nenhum (Yahoo fora do ar) não vale guardar em cache.
    if (withHistory > 0) res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=7200");
    return res.status(200).json({ updatedAt: new Date().toISOString(), etfs, diag: { etfs: etfs.length, comHistorico: withHistory } });
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar os ETFs agora." });
  }
}
