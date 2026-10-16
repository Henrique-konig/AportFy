// =========================================================
// AportFy — api/indices.js (Vercel Serverless Function)
// Séries diárias para comparar a carteira com o mercado:
//   - CDI: Banco Central (SGS, série 12 — taxa diária em %)
//   - IBOV e IFIX: B3 (fechamento diário do índice, ano a ano)
//
//   GET /api/indices?desde=2024-03-01
//   -> { cdi: [{date, rate}], ibov: [[date, valor]], ifix: [[date, valor]] }
// =========================================================

import { parseB3IndexYear } from "../js/calc.js";

const BCB_CDI_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados";
const B3_INDEX_URL = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay";
const MAX_YEARS = 10; // limite da API do Banco Central para séries diárias

const toBr = (iso) => iso.split("-").reverse().join("/");

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let data = await res.json();
  if (typeof data === "string") data = JSON.parse(data); // a B3 às vezes devolve o JSON como string
  return data;
}

async function fetchB3Index(index, fromYear, toYear) {
  const years = [];
  for (let y = fromYear; y <= toYear; y++) years.push(y);
  const perYear = await Promise.all(
    years.map(async (year) => {
      const params = Buffer.from(JSON.stringify({ index, language: "pt-br", year: String(year) })).toString("base64");
      const data = await fetchJson(`${B3_INDEX_URL}/${params}`);
      return parseB3IndexYear(data.results, year);
    })
  );
  return perYear.flat();
}

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const minDate = `${Number(today.slice(0, 4)) - MAX_YEARS}${today.slice(4)}`;
  const desde = String(req.query?.desde || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde > today) {
    return res.status(400).json({ error: "Informe ?desde=AAAA-MM-DD (até hoje)." });
  }
  // Começa uns dias antes, para ter o valor do índice na data da primeira compra.
  const start = new Date(`${desde < minDate ? minDate : desde}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 10);
  const from = start.toISOString().slice(0, 10);

  try {
    const [cdiRows, ibov, ifix] = await Promise.all([
      fetchJson(`${BCB_CDI_URL}?formato=json&dataInicial=${toBr(from)}&dataFinal=${toBr(today)}`),
      fetchB3Index("IBOV", Number(from.slice(0, 4)), Number(today.slice(0, 4))),
      fetchB3Index("IFIX", Number(from.slice(0, 4)), Number(today.slice(0, 4))),
    ]);
    const cdi = (Array.isArray(cdiRows) ? cdiRows : []).map((r) => ({ date: String(r.data).split("/").reverse().join("-"), rate: Number(r.valor) }));

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({
      from,
      cdi: cdi.filter((r) => Number.isFinite(r.rate)),
      ibov: ibov.filter(([d]) => d >= from),
      ifix: ifix.filter(([d]) => d >= from),
    });
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível buscar os índices agora." });
  }
}
