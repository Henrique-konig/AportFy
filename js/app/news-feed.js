// =========================================================
// AportFy — app/news-feed.js
// Notícias da carteira e do mercado.
// =========================================================

import * as ui from "../ui.js";
import { fetchMarketIndices, fetchMarketOverview } from "../api.js";
import { fetchMarketNews, fetchPortfolioNews } from "../news.js";
import { session } from "./session.js";

/* ---------------------------------------------------------------
   Notícias (Alpha Vantage) — mercado geral + ativos da carteira
--------------------------------------------------------------- */
export function newsErrorMessage(reason, target) {
  if (reason === "no_key") {
    return {
      title: "Busca de notícias ainda não configurada.",
      desc: "Cadastre uma chave gratuita em alphavantage.co e configure a variável de ambiente ALPHA_VANTAGE_KEY na Vercel para ativar este feed.",
    };
  }
  if (reason === "rate_limited") {
    return {
      title: "Limite diário de requisições da API atingido.",
      desc: "O plano gratuito da Alpha Vantage libera 25 buscas por dia. Tente novamente amanhã.",
    };
  }
  return target === "portfolio"
    ? {
        title: "Nenhuma notícia encontrada para os ativos da sua carteira.",
        desc: "Cobertura de tickers da B3 é limitada nessa API — tente novamente mais tarde.",
      }
    : { title: "Não foi possível carregar as notícias agora.", desc: "Verifique sua conexão e tente novamente." };
}

// Radar: reabrir a aba em menos de 1 minuto não busca de novo.
const RADAR_REFRESH_MS = 60 * 1000; // os índices são ao vivo: reabrir depois de 1 min busca de novo
const RADAR_CACHE_KEY = "aportfy_radar";
let radarLoadedAt = 0;
let radarLoading = false;

const readRadarCache = () => {
  try {
    return JSON.parse(localStorage.getItem(RADAR_CACHE_KEY) || "null") || {};
  } catch {
    return {};
  }
};

/**
 * Cada parte (altas/baixas/Tesouro e índices) aparece assim que chega, em vez de esperar a mais lenta.
 * Enquanto busca, mostra os últimos dados guardados no aparelho; se a busca falhar, esses dados continuam na tela.
 */
async function loadRadar() {
  if (radarLoading || Date.now() - radarLoadedAt < RADAR_REFRESH_MS) return;
  radarLoading = true;
  const cached = readRadarCache();
  const current = { overview: cached.overview, indices: cached.indices }; // undefined = ainda sem nada (mostra "Carregando…")
  const show = () => ui.renderRadar({ ...current });
  const save = () => {
    try {
      localStorage.setItem(RADAR_CACHE_KEY, JSON.stringify(current));
    } catch {
      /* sem storage: só não guarda */
    }
  };
  show();
  if (cached.overview === undefined) ui.setRadarStatus("Carregando o radar do mercado…");

  const from = new Date(Date.now() - 400 * 86400000).toLocaleDateString("sv-SE"); // ~13 meses, para a variação de 12 meses
  const loadOverview = fetchMarketOverview().then((res) => {
    current.overview = res.ok ? res.data : (cached.overview ?? null);
    if (res.ok) save();
    show();
    return res.ok;
  });
  const loadIndices = (async () => {
    // Sem o CDI (o Radar não usa) e com uma segunda tentativa: a primeira chamada do dia, a frio, às vezes falha.
    let res = await fetchMarketIndices(from, { cdi: false });
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 2500));
      res = await fetchMarketIndices(from, { cdi: false });
    }
    current.indices = res.ok ? { ibov: res.data.ibov, ifix: res.data.ifix } : (cached.indices ?? null);
    if (res.ok) save();
    show();
    return res.ok;
  })();

  const [overviewOk, indicesOk] = await Promise.all([loadOverview, loadIndices]);
  if (overviewOk || indicesOk) radarLoadedAt = Date.now();
  radarLoading = false;
}

export async function loadNewsView() {
  loadRadar();

  // Mercado Diário independe da carteira — dispara em paralelo com a busca por ativo.
  ui.renderNewsSkeletons("market", 6);
  fetchMarketNews().then((res) => {
    ui.renderNewsCards("market", res.items, res.ok ? null : newsErrorMessage(res.reason, "market"));
  });

  const tickers = session.latestInvestments.map((inv) => inv.ticker);
  if (tickers.length === 0) {
    ui.renderNewsCards("portfolio", [], {
      title: "Nenhum ativo cadastrado ainda.",
      desc: "Adicione ativos em Investimentos para ver notícias específicas da sua carteira aqui.",
    });
    return;
  }

  ui.renderNewsSkeletons("portfolio", 6);
  const res = await fetchPortfolioNews(tickers);
  ui.renderNewsCards("portfolio", res.items, res.ok ? null : newsErrorMessage(res.reason, "portfolio"));
}
