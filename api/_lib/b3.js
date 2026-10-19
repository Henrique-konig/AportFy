// =========================================================
// AportFy — api/_lib/b3.js
// Busca de proventos na API pública da B3, compartilhada pela função
// /api/proventos e pelos lembretes diários (/api/notificacoes).
// (Arquivos em pastas com "_" não viram rotas na Vercel.)
// =========================================================

import { parseB3CashDividends, filterByAssetClass } from "../../js/calc.js";

const B3_FUNDS_URL = "https://sistemaswebb3-listados.b3.com.br/fundsProxy/fundsCall/GetListedSupplementFunds";
const B3_COMPANY_URL = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany";
export const TICKER_PATTERN = /^[A-Z]{4}\d{1,2}$/;
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

/**
 * Proventos (pagos e anunciados) de um ticker.
 * @param {string} ticker ex: MXRF11, TAEE11
 * @param {boolean} isStock true para ações (padrão: FII)
 * @returns {Promise<Array<{type:string, rate:number, exDate:string|null, paymentDate:string}>>}
 */
export async function fetchTickerDividends(ticker, isStock) {
  // A B3 identifica fundos e empresas pelas 4 primeiras letras (MXRF11 -> MXRF).
  const code = ticker.slice(0, 4);
  let cashDividends;
  if (isStock) {
    const data = await fetchB3Json(`${B3_COMPANY_URL}/${encodeParams({ issuingCompany: code, language: "pt-br" })}`);
    cashDividends = filterByAssetClass((Array.isArray(data) ? data[0] : data)?.cashDividends, ticker);
  } else {
    const data = await fetchB3Json(`${B3_FUNDS_URL}/${encodeParams({ identifierFund: code, typeFund: FII_TYPE_FUND, pageNumber: 1, pageSize: 40 })}`);
    cashDividends = data.cashDividends;
  }
  return parseB3CashDividends(cashDividends);
}
