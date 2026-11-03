// =========================================================
// AportFy — api/fundamentos.js (Vercel Serverless Function)
// Indicadores de todos os FIIs e ações da B3, lidos das tabelas públicas do Fundamentus
// (fundamentus.com.br). É raspagem de HTML: se o site mudar o formato, a parte quebrada
// volta null (e `diag` diz quantas linhas cada fonte rendeu) sem derrubar a outra.
//
//   GET /api/fundamentos
//   -> { updatedAt, fiis: [{ticker, segmento, preco, dy, pvp, vacancia, ...}], acoes: [{ticker, preco, pl, pvp, dy, roe, ...}] }
// =========================================================

import { FUNDAMENTUS_FII_COLUMNS, FUNDAMENTUS_STOCK_COLUMNS, parseFundamentusTable } from "../js/calc.js";

const BASE = "https://www.fundamentus.com.br/";

async function getTable(page, columns) {
  const res = await fetch(BASE + page, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36", Referer: BASE, "Accept-Language": "pt-BR" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = parseFundamentusTable(new TextDecoder("latin1").decode(await res.arrayBuffer()), columns); // o site é ISO-8859-1
  if (rows.length < 20) throw new Error("tabela vazia ou em outro formato");
  return rows;
}

// Só o que a tela usa (a tabela completa pesa mais de 400 KB).
const FII_KEYS = ["ticker", "segmento", "preco", "ffo", "dy", "pvp", "mercado", "liquidez", "capRate", "vacancia"];
const STOCK_KEYS = ["ticker", "preco", "pl", "pvp", "dy", "roe", "roic", "mLiquida", "dividaPl", "cresc5a", "evEbitda", "liquidez"];
const slim = (rows, keys) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));

// Fundos de papel (CRI) não têm imóveis: vacância e cap rate vêm como 0, o que enganaria o filtro. Viram "sem valor".
const fiiRows = (rows) => slim(rows.map((r) => (r.imoveis === 0 ? { ...r, vacancia: null, capRate: null } : r)), FII_KEYS);

const settled = async (promise) => {
  try {
    return await promise;
  } catch {
    return null;
  }
};

export default async function handler(req, res) {
  const [fiis, acoes] = await Promise.all([
    settled(getTable("fii_resultado.php", FUNDAMENTUS_FII_COLUMNS).then(fiiRows)),
    settled(getTable("resultado.php", FUNDAMENTUS_STOCK_COLUMNS).then((rows) => slim(rows, STOCK_KEYS))),
  ]);
  const ok = fiis != null || acoes != null;
  // Os dados mudam uma vez por dia: completo fica 6 h em cache; parcial só 1 min.
  if (ok) res.setHeader("Cache-Control", fiis && acoes ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, s-maxage=60");
  return res.status(ok ? 200 : 502).json({ updatedAt: new Date().toISOString(), fiis, acoes, diag: { fiis: fiis?.length ?? null, acoes: acoes?.length ?? null } });
}
