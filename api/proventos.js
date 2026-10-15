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

import { parseB3CashDividends, filterByAssetClass } from "../js/calc.js";

const B3_FUNDS_URL = "https://sistemaswebb3-listados.b3.com.br/fundsProxy/fundsCall/GetListedSupplementFunds";
const B3_COMPANY_URL = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany";
const TICKER_PATTERN = /^[A-Z]{4}\d{1,2}$/;
const FII_TYPE_FUND = 7;

const encodeParams = (params) => Buffer.from(JSON.stringify(params)).toString("base64");

async function fetchB3Json(url) {
  const upstream = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!upstream.ok) throw new Error(`B3 respondeu ${upstream.status}`);
  let data = await upstream.json();
  // Dependendo dos headers, a B3 devolve o JSON como string (codificado duas vezes).
  if (typeof data === "string") data = JSON.parse(data);
  return data;
}

export default async function handler(req, res) {
  const ticker = String(req.query?.ticker || "").toUpperCase().trim();
  const isStock = String(req.query?.type || "").toLowerCase() === "acao";
  if (!TICKER_PATTERN.test(ticker)) {
    return res.status(400).json({ error: "Ticker inválido. Use algo como MXRF11." });
  }

  // A B3 identifica fundos e empresas pelas 4 primeiras letras (MXRF11 -> MXRF).
  const code = ticker.slice(0, 4);

  try {
    let cashDividends;
    if (isStock) {
      const data = await fetchB3Json(`${B3_COMPANY_URL}/${encodeParams({ issuingCompany: code, language: "pt-br" })}`);
      cashDividends = filterByAssetClass((Array.isArray(data) ? data[0] : data)?.cashDividends, ticker);
    } else {
      const data = await fetchB3Json(
        `${B3_FUNDS_URL}/${encodeParams({ identifierFund: code, typeFund: FII_TYPE_FUND, pageNumber: 1, pageSize: 40 })}`
      );
      cashDividends = data.cashDividends;
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ ticker, dividends: parseB3CashDividends(cashDividends) });
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível consultar a B3 agora." });
  }
}
