// =========================================================
// AportFy — api/_lib/etfs.js
// ETFs mais negociados (Brapi) com retorno, volatilidade e maior queda do último ano (Yahoo Finance).
// Lido por /api/etfs e pelos alertas do cron. Cada ETF falha sozinho.
// =========================================================

import { etfStats, pickEtfs } from "../../js/calc.js";

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

/** @returns {Promise<Array<Object>>} lança erro se a Brapi não trouxer nenhum ETF */
export async function loadEtfs() {
  const token = process.env.BRAPI_TOKEN ? `&token=${encodeURIComponent(process.env.BRAPI_TOKEN)}` : "";
  const { stocks } = await getJson(`https://brapi.dev/api/quote/list?sortBy=volume&sortOrder=desc&limit=400&type=fund${token}`);
  const picked = pickEtfs(stocks);
  if (picked.length === 0) throw new Error("Brapi sem ETFs");

  return Promise.all(
    picked.map(async (etf) => {
      try {
        const stats = etfStats(await history(etf.ticker));
        return { ...etf, liquidez: Math.round(etf.liquidez), ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, round(v)])) };
      } catch {
        return { ...etf, liquidez: Math.round(etf.liquidez), r1m: null, r6m: null, r12m: null, vol: null, drawdown: null };
      }
    })
  );
}
