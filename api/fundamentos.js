// =========================================================
// AportFy — api/fundamentos.js (Vercel Serverless Function)
// Indicadores de todos os FIIs e ações da B3, lidos das tabelas públicas do Fundamentus
// (ver _lib/fundamentus.js). `diag` diz quantas linhas cada fonte rendeu.
//
//   GET /api/fundamentos
//   -> { updatedAt, fiis: [{ticker, segmento, preco, dy, pvp, vacancia, ...}], acoes: [{ticker, preco, pl, pvp, dy, roe, ...}] }
// =========================================================

import { loadFundamentals } from "./_lib/fundamentus.js";

export default async function handler(req, res) {
  const { fiis, acoes } = await loadFundamentals();
  const ok = fiis != null || acoes != null;
  // Os dados mudam uma vez por dia: completo fica 6 h em cache; parcial só 1 min.
  if (ok) res.setHeader("Cache-Control", fiis && acoes ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, s-maxage=60");
  return res.status(ok ? 200 : 502).json({ updatedAt: new Date().toISOString(), fiis, acoes, diag: { fiis: fiis?.length ?? null, acoes: acoes?.length ?? null } });
}
