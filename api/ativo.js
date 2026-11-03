// =========================================================
// AportFy — api/ativo.js (Vercel Serverless Function)
// Histórico de preço de 1 ano de uma ação ou FII, para a ficha do ativo (Yahoo Finance).
//
//   GET /api/ativo?ticker=MXRF11
//   -> { ticker, name, price, closes: [["2026-01-02", 9.7], ...] }
// =========================================================

import { TICKER_PATTERN } from "./_lib/b3.js";

export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  if (!TICKER_PATTERN.test(ticker)) return res.status(400).json({ error: "Ticker inválido." });

  try {
    const upstream = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=1y`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
    const result = (await upstream.json()).chart?.result?.[0];
    const times = result?.timestamp || [];
    const prices = result?.indicators?.quote?.[0]?.close || [];
    const closes = times.map((t, i) => [new Date(t * 1000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), Math.round(prices[i] * 100) / 100]).filter(([, p]) => p > 0);
    if (closes.length < 2) throw new Error("sem histórico");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ ticker, name: result.meta?.longName || result.meta?.shortName || ticker, price: result.meta?.regularMarketPrice ?? closes.at(-1)[1], closes });
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar o histórico agora." });
  }
}
