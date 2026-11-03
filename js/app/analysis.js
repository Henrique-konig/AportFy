// =========================================================
// AportFy — app/analysis.js
// Aba Análise: busca os indicadores e guarda uma cópia no aparelho.
// =========================================================

import * as ui from "../ui.js";
import { fetchEtfs, fetchFundamentals } from "../api.js";

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

const ETF_CACHE_KEY = "aportfy_etfs";
const ETF_REFRESH_MS = 30 * 60 * 1000; // cotação e retornos mudam ao longo do dia
let loadingEtfs = false;

/** Lista de ETFs (só ao abrir a aba ETFs): cópia guardada na hora, busca de novo depois de 30 min. */
export async function loadEtfs() {
  if (loadingEtfs) return;
  let cached = null;
  try {
    cached = JSON.parse(localStorage.getItem(ETF_CACHE_KEY) || "null");
  } catch {
    /* cópia ilegível: busca de novo */
  }
  if (cached) ui.setEtfData(cached);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < ETF_REFRESH_MS) return;

  loadingEtfs = true;
  const res = await fetchEtfs();
  loadingEtfs = false;
  if (res.ok) {
    ui.setEtfData(res.data);
    try {
      localStorage.setItem(ETF_CACHE_KEY, JSON.stringify(res.data));
    } catch {
      /* sem storage ou cheio: só não guarda */
    }
  } else if (!cached) {
    ui.setEtfData(null);
  }
}
