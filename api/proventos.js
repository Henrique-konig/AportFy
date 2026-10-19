// =========================================================
// AportFy — api/proventos.js (Vercel Serverless Function)
// Busca na API pública da B3 os proventos (inclusive os já
// anunciados e ainda não pagos) de um FII/Fiagro ou de uma
// ação e devolve em JSON normalizado. Existe porque a B3 não
// libera CORS para chamadas diretas do navegador.
//
//   GET /api/proventos?ticker=MXRF11            (FII — padrão)
//   GET /api/proventos?ticker=TAEE11&type=acao  (ação)
// =========================================================

import { fetchTickerDividends, TICKER_PATTERN } from "./_lib/b3.js";

export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  const isStock = String(req.query?.type || "").toLowerCase() === "acao";
  if (!TICKER_PATTERN.test(ticker)) {
    return res.status(400).json({ error: "Ticker inválido. Use algo como MXRF11." });
  }

  try {
    const dividends = await fetchTickerDividends(ticker, isStock);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ ticker, dividends });
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível consultar a B3 agora." });
  }
}
