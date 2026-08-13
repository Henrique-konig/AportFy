// =========================================================
// EcoFy — news.js
// Busca de notícias financeiras via Alpha Vantage (NEWS_SENTIMENT).
// Não depende de Firebase; falha de rede ou limite de API nunca
// devem quebrar o app — sempre retorna um resultado tratável pela UI.
// =========================================================

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

// Cole aqui sua chave gratuita da Alpha Vantage (cadastro em
// alphavantage.co/support/#api-key). Sem ela, os dois feeds de
// notícias voltam vazios com reason:"no_key" — a UI mostra o aviso.
const ALPHA_VANTAGE_KEY = "3MAPSBYUQHHK9BYH";

// Plano gratuito é limitado (25 requisições/dia) — cache local evita
// gastar a cota toda vez que o usuário troca de aba.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas

// Alpha Vantage cobre majoritariamente tickers negociados nos EUA;
// tickers da B3 (ex: PETR4, MXRF11) raramente retornam resultado —
// isso é esperado, não é bug (a UI trata como card vazio).
const MARKET_TOPICS = "financial_markets,economy_macro";

/* ---------------------------------------------------------------
   Cache local (localStorage)
--------------------------------------------------------------- */
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Quota do localStorage estourada ou indisponível (modo privado): sem cache, sem problema.
  }
}

/* ---------------------------------------------------------------
   Normalização da resposta da Alpha Vantage
--------------------------------------------------------------- */
function formatTimePublished(raw) {
  // Formato da API: "20250101T120000"
  if (!raw || raw.length < 15) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeFeedItem(item) {
  return {
    title: item.title || "Sem título",
    url: item.url || "#",
    source: item.source || "Fonte desconhecida",
    publishedAt: formatTimePublished(item.time_published),
    image: item.banner_image || null,
    tickers: Array.isArray(item.ticker_sentiment) ? item.ticker_sentiment.map((t) => t.ticker) : [],
  };
}

/**
 * Chama o endpoint NEWS_SENTIMENT da Alpha Vantage.
 * @returns {Promise<{ items: object[], ok: boolean, reason: string|null }>}
 */
async function fetchNewsFeed(params) {
  if (!ALPHA_VANTAGE_KEY) {
    return { items: [], ok: false, reason: "no_key" };
  }

  const url = `${ALPHA_VANTAGE_BASE}?function=NEWS_SENTIMENT&apikey=${encodeURIComponent(ALPHA_VANTAGE_KEY)}&${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { items: [], ok: false, reason: "network_error" };

    const data = await res.json();
    // Limite de requisições ou chave inválida: a API responde 200 com
    // "Note"/"Information" em vez do array `feed`.
    if (data.Note || data.Information || !Array.isArray(data.feed)) {
      return { items: [], ok: false, reason: "rate_limited" };
    }

    return { items: data.feed.map(normalizeFeedItem), ok: true, reason: null };
  } catch (err) {
    console.warn("Falha ao buscar notícias na Alpha Vantage:", err.message);
    return { items: [], ok: false, reason: "network_error" };
  }
}

/**
 * Notícias específicas dos ativos da carteira do usuário.
 * @param {string[]} tickers - tickers salvos no Firestore (ex: PETR4, MXRF11)
 * @returns {Promise<{ items: object[], ok: boolean, reason: string|null }>}
 */
export async function fetchPortfolioNews(tickers) {
  const symbols = [...new Set((tickers || []).map((t) => t.toUpperCase().trim()).filter(Boolean))];
  if (symbols.length === 0) return { items: [], ok: true, reason: null };

  const cacheKey = `ecofy_news_portfolio_${symbols.slice().sort().join(",")}`;
  const cached = readCache(cacheKey);
  if (cached) return { items: cached, ok: true, reason: null };

  const result = await fetchNewsFeed(`tickers=${encodeURIComponent(symbols.join(","))}`);
  if (result.ok) writeCache(cacheKey, result.items);
  return result;
}

/**
 * Feed geral de notícias de mercado (Ibovespa, economia, mercado global).
 * @returns {Promise<{ items: object[], ok: boolean, reason: string|null }>}
 */
export async function fetchMarketNews() {
  const cacheKey = "ecofy_news_market";
  const cached = readCache(cacheKey);
  if (cached) return { items: cached, ok: true, reason: null };

  const result = await fetchNewsFeed(`topics=${encodeURIComponent(MARKET_TOPICS)}`);
  if (result.ok) writeCache(cacheKey, result.items);
  return result;
}
