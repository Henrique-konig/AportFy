// =========================================================
// AportFy — app/analysis.js
// Aba Análise: busca os indicadores e guarda uma cópia no aparelho.
// =========================================================

import * as ui from "../ui.js";
import { fetchFundamentals } from "../api.js";

const CACHE_KEY = "aportfy_analysis";
const REFRESH_MS = 6 * 60 * 60 * 1000; // os dados mudam uma vez por dia
let loading = false;

const setData = (data) => {
  ui.setAnalysisData(data);
  ui.setPortfolioFundamentals(data);
};

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  } catch {
    return null;
  }
};

/** Mostra a cópia guardada na hora e só busca de novo se ela tiver mais de 6 h (ou se faltar uma das listas). */
export async function loadFundamentals() {
  if (loading) return;
  const cached = readCache();
  if (cached) setData(cached);
  const fresh = cached?.fiis && cached?.acoes && Date.now() - new Date(cached.updatedAt).getTime() < REFRESH_MS;
  if (fresh) return;

  loading = true;
  const res = await fetchFundamentals();
  loading = false;
  if (res.ok) {
    setData(res.data);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
    } catch {
      /* sem storage ou cheio: só não guarda */
    }
  } else if (!cached) {
    setData(null);
  }
}
