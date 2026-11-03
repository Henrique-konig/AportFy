// =========================================================
// AportFy — api/etfs.js (Vercel Serverless Function)
// Ranking de ETFs da B3: os mais negociados (Brapi) com retorno de 1, 6 e 12 meses, volatilidade e
// maior queda calculados do histórico de 1 ano (Yahoo Finance) — ver _lib/etfs.js. ETFs não têm P/L nem DY
// como ações e FIIs, então a comparação é por desempenho e risco.
//
//   GET /api/etfs
//   -> { updatedAt, etfs: [{ticker, nome, segmento, preco, liquidez, r1m, r6m, r12m, vol, drawdown}], diag }
// =========================================================

import { loadEtfs } from "./_lib/etfs.js";

export default async function handler(req, res) {
  try {
    const etfs = await loadEtfs();
    const withHistory = etfs.filter((e) => e.r1m != null).length;
    // Sem histórico nenhum (Yahoo fora do ar) não vale guardar em cache.
    if (withHistory > 0) res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=7200");
    return res.status(200).json({ updatedAt: new Date().toISOString(), etfs, diag: { etfs: etfs.length, comHistorico: withHistory } });
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar os ETFs agora." });
  }
}
