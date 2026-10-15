// =========================================================
// AportFy — api/proventos.js (Vercel Serverless Function)
// Busca na API pública da B3 os proventos (inclusive os já
// anunciados e ainda não pagos) de um FII/Fiagro e devolve
// em JSON normalizado. Existe porque a B3 não libera CORS
// para chamadas diretas do navegador.
//
//   GET /api/proventos?ticker=MXRF11
// =========================================================

import { parseB3CashDividends } from "../js/calc.js";

const B3_FUNDS_URL = "https://sistemaswebb3-listados.b3.com.br/fundsProxy/fundsCall/GetListedSupplementFunds";
const TICKER_PATTERN = /^[A-Z]{4}\d{1,2}$/;
const FII_TYPE_FUND = 7;

export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  if (!TICKER_PATTERN.test(ticker)) {
    return res.status(400).json({ error: "Ticker inválido. Use algo como MXRF11." });
  }

  // A B3 identifica o fundo pelas 4 primeiras letras (MXRF11 -> MXRF).
  const params = { identifierFund: ticker.slice(0, 4), typeFund: FII_TYPE_FUND, pageNumber: 1, pageSize: 40 };
  const encoded = Buffer.from(JSON.stringify(params)).toString("base64");

  try {
    const upstream = await fetch(`${B3_FUNDS_URL}/${encoded}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) return res.status(502).json({ error: `B3 respondeu ${upstream.status}.` });

    let data = await upstream.json();
    // Dependendo dos headers, a B3 devolve o JSON como string (codificado duas vezes).
    if (typeof data === "string") data = JSON.parse(data);
    const dividends = parseB3CashDividends(data.cashDividends);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ ticker, dividends });
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível consultar a B3 agora." });
  }
}
