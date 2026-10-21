// =========================================================
// AportFy — app/news-feed.js
// Notícias da carteira e do mercado.
// =========================================================

import * as ui from "../ui.js";
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

export async function loadNewsView() {
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
