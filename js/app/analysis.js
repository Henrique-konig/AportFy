// =========================================================
// AportFy — app/analysis.js
// Aba Análise e indicadores da carteira: busca os dados e guarda uma cópia no aparelho.
// =========================================================

import * as ui from "../ui.js";
import { fetchEtfs, fetchFundamentals } from "../api.js";

/**
 * Carregador com cópia no aparelho: mostra a cópia guardada na hora e só busca de novo depois do `ttl`
 * (ou se ela estiver incompleta). Já carregado e em dia nesta sessão, não relê nem redesenha nada.
 * Chamadas durante uma busca esperam a mesma busca.
 */
function createLoader({ key, ttl, fetchData, apply, isComplete = () => true }) {
  let inFlight = null;
  let freshUntil = 0;

  const run = async () => {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      /* cópia ilegível: busca de novo */
    }
    if (cached) apply(cached);
    const expires = cached ? new Date(cached.updatedAt).getTime() + ttl : 0;
    if (cached && isComplete(cached) && Date.now() < expires) {
      freshUntil = expires;
      return;
    }

    const res = await fetchData();
    if (res.ok) {
      apply(res.data);
      freshUntil = Date.now() + ttl;
      try {
        localStorage.setItem(key, JSON.stringify(res.data));
      } catch {
        /* sem storage ou cheio: só não guarda */
      }
    } else if (!cached) {
      apply(null);
    }
  };

  return () => {
    if (Date.now() < freshUntil) return Promise.resolve();
    return (inFlight ??= run().finally(() => (inFlight = null)));
  };
}

// Os dados do Fundamentus mudam uma vez por dia.
export const loadFundamentals = createLoader({
  key: "aportfy_analysis",
  ttl: 6 * 60 * 60 * 1000,
  fetchData: fetchFundamentals,
  isComplete: (data) => data.fiis && data.acoes,
  apply: (data) => {
    ui.setAnalysisData(data);
    ui.setPortfolioFundamentals(data);
  },
});

// Cotação e retornos dos ETFs mudam ao longo do dia.
export const loadEtfs = createLoader({
  key: "aportfy_etfs",
  ttl: 30 * 60 * 1000,
  fetchData: fetchEtfs,
  apply: (data) => {
    ui.setEtfData(data);
    ui.setPortfolioEtfs(data);
  },
});
