// =========================================================
// AportFy — news.js
// Duas fontes, uma por sub-aba:
// - "Minha Carteira": Alpha Vantage (NEWS_SENTIMENT), filtrada por
//   ticker dos ativos do usuário.
// - "Mercado Diário": RSS do Google News em pt-BR (via proxy CORS
//   público), porque a Alpha Vantage não tem cobertura de mercado
//   brasileiro (testado: retorna 0 resultado até para ADRs grandes
//   como Petrobras/Vale — só cobre bem ticker americano).
// Nenhuma depende de Firebase; falha de rede ou limite de API nunca
// devem quebrar o app — sempre retornam um resultado tratável pela UI.
// =========================================================

// A chave da Alpha Vantage fica na variável de ambiente ALPHA_VANTAGE_KEY da
// Vercel e é usada só pela função /api/noticias — nunca chega ao navegador.
// Sem ela (ou fora da Vercel), "Minha Carteira" volta vazia com reason:"no_key".
const NEWS_API = "/api/noticias";

// Plano gratuito é limitado (25 requisições/dia) — cache local evita
// gastar a cota toda vez que o usuário troca de aba.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas

// news.google.com/rss não libera CORS para fetch direto do navegador
// (testado: "Failed to fetch"). r.jina.ai é um proxy leitor público e
// gratuito que resolve isso, devolvendo a página convertida em Markdown —
// sem chave, sem limite diário fixo, mas é um serviço de terceiro sem
// SLA: se ele cair, o feed de Mercado Diário cai junto (a UI mostra o
// aviso, não quebra o app).
const READER_PROXY = "https://r.jina.ai/";
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";

// r.jina.ai converte a página em Markdown; cada manchete do RSS do
// Google News aparece como "### [Título - Fonte](url)".
const HEADLINE_RE = /^### \[(.+?) - ([^\]]+)\]\((https:\/\/news\.google\.com\/rss\/articles\/[^)]+)\)/gm;

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
   Minha Carteira — Alpha Vantage (NEWS_SENTIMENT)
--------------------------------------------------------------- */
function formatTimePublished(raw) {
  // Formato da API: "20250101T120000"
  if (!raw || raw.length < 15) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeAlphaVantageItem(item) {
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

  try {
    const res = await fetch(`${NEWS_API}?tickers=${encodeURIComponent(symbols.join(","))}`);
    if (res.status === 503) return { items: [], ok: false, reason: "no_key" };
    if (res.status === 429) return { items: [], ok: false, reason: "rate_limited" };
    if (!res.ok) return { items: [], ok: false, reason: "network_error" };

    const data = await res.json();
    if (!Array.isArray(data.feed)) return { items: [], ok: false, reason: "rate_limited" };

    const items = data.feed.map(normalizeAlphaVantageItem);
    writeCache(cacheKey, items);
    return { items, ok: true, reason: null };
  } catch (err) {
    console.warn("Falha ao buscar notícias na Alpha Vantage:", err.message);
    return { items: [], ok: false, reason: "network_error" };
  }
}

/* ---------------------------------------------------------------
   Mercado Diário — RSS do Google News (via proxy CORS)
--------------------------------------------------------------- */
function buildGoogleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: "pt-BR", gl: "BR", ceid: "BR:pt-BR" });
  return `${GOOGLE_NEWS_BASE}?${params.toString()}`;
}

async function fetchGoogleNewsRss(query, limit) {
  const proxiedUrl = `${READER_PROXY}${buildGoogleNewsUrl(query)}`;

  try {
    const res = await fetch(proxiedUrl);
    if (!res.ok) return { items: [], ok: false };

    const text = await res.text();
    const items = [];
    HEADLINE_RE.lastIndex = 0;
    let match;
    while (items.length < limit && (match = HEADLINE_RE.exec(text))) {
      const [, title, source, url] = match;
      items.push({
        title: title.trim(),
        url,
        source: source.trim(),
        publishedAt: null, // Não disponível no Markdown extraído pelo reader — o card omite a data nesse caso.
        image: null, // RSS do Google News não traz imagem de capa — o card usa o ícone padrão.
        tickers: [],
      });
    }

    return { items, ok: true };
  } catch (err) {
    console.warn("Falha ao buscar RSS do Google News:", err.message);
    return { items: [], ok: false };
  }
}

/**
 * Feed geral de notícias de mercado — majoritariamente Brasil (Ibovespa,
 * economia, mercado financeiro nacional), com uma parcela menor de fora.
 * @returns {Promise<{ items: object[], ok: boolean, reason: string|null }>}
 */
export async function fetchMarketNews() {
  // Sufixo "_v2" pra não colidir com cache antigo salvo no navegador de
  // quem visitou antes da troca de fonte (Alpha Vantage -> Google News) —
  // sem isso, o formato velho ficava valendo por até 3h após o deploy.
  const cacheKey = "ecofy_news_market_v2";
  const cached = readCache(cacheKey);
  if (cached) return { items: cached, ok: true, reason: null };

  const [brasil, global] = await Promise.all([
    fetchGoogleNewsRss('Ibovespa OR "mercado financeiro" OR economia Brasil', 9),
    fetchGoogleNewsRss("mercado financeiro internacional OR Wall Street OR economia global", 3),
  ]);

  const items = [...brasil.items, ...global.items];
  if (items.length === 0) {
    return { items: [], ok: false, reason: "network_error" };
  }

  writeCache(cacheKey, items);
  return { items, ok: true, reason: null };
}
