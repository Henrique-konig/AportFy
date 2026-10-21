// =========================================================
// AportFy — api.js
// Busca de cotações da B3 (Ações e FIIs) via Brapi API.
// Não depende de Firebase; falha de rede nunca deve quebrar
// o app — sempre retorna um resultado parcial utilizável.
// =========================================================

const BRAPI_DIRECT = "https://brapi.dev/api";

/**
 * Pede à Brapi pela função serverless /api/brapi, que guarda a chave (variável BRAPI_TOKEN na
 * Vercel, nunca no código do site) e mantém um cache compartilhado. Se a função não existir
 * (ex: `npx serve` local, que não tem /api), cai na Brapi direta, sem chave — o plano gratuito
 * libera Ações em /quote e FIIs em /quote/list.
 * @param {"quote"|"list"} kind
 * @param {{ symbol?: string, search?: string, dividends?: boolean }} params
 */
async function brapiFetch(kind, { symbol, search, dividends } = {}) {
  const proxyQuery = new URLSearchParams({ kind });
  if (symbol) proxyQuery.set("symbol", symbol);
  if (search) proxyQuery.set("search", search);
  if (dividends) proxyQuery.set("dividends", "true");

  try {
    const viaProxy = await fetch(`/api/brapi?${proxyQuery}`);
    if (viaProxy.headers.get("x-aportfy-proxy")) return viaProxy; // a função respondeu (mesmo que com erro da Brapi)
  } catch {
    /* sem função: segue para a Brapi direta */
  }

  const direct =
    kind === "list"
      ? `${BRAPI_DIRECT}/quote/list?search=${encodeURIComponent(search)}`
      : `${BRAPI_DIRECT}/quote/${encodeURIComponent(symbol)}${dividends ? "?dividends=true" : ""}`;
  return fetch(direct);
}

/** Categorias de investimento que têm ticker negociado na B3. */
export const B3_CATEGORIES = ["Ações", "FIIs"];

/**
 * Tenta o endpoint direto /quote/{ticker}. Funciona sem token para Ações;
 * FIIs retornam 401 (MISSING_TOKEN) nesse endpoint no plano gratuito.
 */
async function fetchViaQuoteEndpoint(symbol) {
  const res = await brapiFetch("quote", { symbol });
  if (!res.ok) return null;
  const data = await res.json();
  const price = data.results?.[0]?.regularMarketPrice;
  return typeof price === "number" ? price : null;
}

/**
 * Fallback para FIIs (e qualquer ticker que o endpoint direto rejeite sem
 * token): /quote/list é um endpoint de busca/listagem que a Brapi libera
 * sem token mesmo para fundos imobiliários, retornando o preço de
 * fechamento mais recente no campo `close`.
 */
async function fetchViaListEndpoint(symbol) {
  const res = await brapiFetch("list", { search: symbol });
  if (!res.ok) return null;
  const data = await res.json();
  const match = (data.stocks || []).find((s) => s.stock === symbol);
  return typeof match?.close === "number" ? match.close : null;
}

/**
 * Busca a cotação de um único ticker na Brapi, tentando o endpoint direto
 * primeiro (mais rápido/preciso) e caindo para o endpoint de listagem se
 * o primeiro não retornar preço (caso típico de FIIs sem token).
 * @param {string} symbol
 * @returns {Promise<{ symbol: string, price: number|null, networkError: boolean }>}
 */
async function fetchOneQuote(symbol) {
  try {
    const direct = await fetchViaQuoteEndpoint(symbol);
    if (typeof direct === "number") return { symbol, price: direct, networkError: false };

    const viaList = await fetchViaListEndpoint(symbol);
    if (typeof viaList === "number") return { symbol, price: viaList, networkError: false };

    // Ticker realmente não encontrado em nenhum dos dois endpoints.
    return { symbol, price: null, networkError: false };
  } catch (err) {
    // Sem internet, CORS bloqueado, timeout, etc.
    console.warn(`Falha ao buscar cotação de ${symbol} na Brapi:`, err.message);
    return { symbol, price: null, networkError: true };
  }
}

/**
 * Busca o preço atual de um ou mais tickers da B3.
 * A Brapi (plano gratuito) só aceita 1 ticker por requisição sem token —
 * por isso disparamos uma requisição por ticker, em paralelo, em vez de
 * uma única chamada em lote.
 * @param {string[]} tickers
 * @returns {Promise<{ prices: Record<string, number>, failedTickers: string[], networkError: boolean }>}
 */
export async function fetchQuotes(tickers) {
  const symbols = [...new Set(tickers.map((t) => t.toUpperCase().trim()).filter(Boolean))];
  if (symbols.length === 0) {
    return { prices: {}, failedTickers: [], networkError: false };
  }

  const results = await Promise.all(symbols.map(fetchOneQuote));

  const prices = {};
  const failedTickers = [];
  let networkError = false;

  results.forEach(({ symbol, price, networkError: netErr }) => {
    if (netErr) networkError = true;
    if (typeof price === "number") prices[symbol] = price;
    else failedTickers.push(symbol);
  });

  return { prices, failedTickers, networkError };
}

const DIVIDEND_LABEL_MAP = {
  "DIVIDENDO": "Dividendo",
  "JCP": "JCP",
  "JUROS SOBRE CAPITAL PRÓPRIO": "JCP",
  "JUROS SOBRE CAPITAL PROPRIO": "JCP",
  "JRS CAP PROPRIO": "JCP",
  "RENDIMENTO": "Rendimento",
};

function normalizeDividendType(label) {
  const key = (label || "").trim().toUpperCase();
  return DIVIDEND_LABEL_MAP[key] || "Outro";
}

/** Consulta a função serverless /api/proventos (que lê a B3). */
async function fetchViaB3Function(symbol, type) {
  const res = await fetch(`/api/proventos?ticker=${encodeURIComponent(symbol)}&type=${type}`);
  if (!res.ok) return { dividends: [], ok: false };
  const data = await res.json();
  const dividends = (data.dividends || []).map((d) => ({
    type: normalizeDividendType(d.label),
    rate: d.rate,
    exDate: d.exDate,
    paymentDate: d.paymentDate,
  }));
  return { dividends, ok: true };
}

/** Plano gratuito da Brapi só libera alguns tickers sem token — usada só como reserva para Ações. */
async function fetchViaBrapi(symbol) {
  const res = await brapiFetch("quote", { symbol, dividends: true });
  if (!res.ok) return { dividends: [], ok: false };

  const data = await res.json();
  const cashDividends = data.results?.[0]?.dividendsData?.cashDividends || [];
  const dividends = cashDividends
    .filter((d) => typeof d.rate === "number" && d.paymentDate)
    .map((d) => ({
      type: normalizeDividendType(d.label),
      rate: d.rate,
      exDate: d.lastDatePrior ? d.lastDatePrior.slice(0, 10) : null,
      paymentDate: d.paymentDate.slice(0, 10),
    }));
  return { dividends, ok: true };
}

/**
 * Busca o calendário de proventos de um ativo — pagos e já anunciados — na API
 * pública da B3, por meio da função serverless `/api/proventos` (a B3 não
 * libera chamada direta do navegador). Só existe quando o app está na Vercel:
 * para Ações, se a função não responder (ex: `npx serve` local), tenta a Brapi.
 * Cada item traz a data-com (exDate), usada para saber quantas cotas o usuário
 * tinha com direito ao provento.
 * @param {string} ticker
 * @param {string} category categoria do ativo ("FIIs" ou "Ações")
 * @returns {Promise<{ dividends: Array<{type:string, rate:number, exDate:string|null, paymentDate:string}>, ok: boolean }>}
 */
export async function fetchDividendCalendar(ticker, category) {
  const symbol = ticker.toUpperCase().trim();
  try {
    if (category === "FIIs") return await fetchViaB3Function(symbol, "fii");

    try {
      const viaB3 = await fetchViaB3Function(symbol, "acao");
      if (viaB3.ok) return viaB3;
    } catch {
      /* função indisponível: cai na Brapi */
    }
    return await fetchViaBrapi(symbol);
  } catch (err) {
    console.warn(`Falha ao buscar proventos de ${ticker}:`, err.message);
    return { dividends: [], ok: false };
  }
}

/* ---------------------------------------------------------------
   Cotações de criptomoedas
   Fonte principal: Binance (um único pedido traz todos os pares; moedas
   sem par em real são convertidas via USDT). Reserva: CoinGecko, para as
   moedas mais comuns. As duas liberam chamada direta do navegador.
--------------------------------------------------------------- */
export const CRYPTO_CATEGORY = "Criptomoedas";

const BINANCE_PRICES_URL = "https://api.binance.com/api/v3/ticker/price";
const COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";
const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", DOT: "polkadot", LTC: "litecoin", LINK: "chainlink", AVAX: "avalanche-2", TRX: "tron",
  SHIB: "shiba-inu", MATIC: "matic-network", POL: "polygon-ecosystem-token", USDT: "tether", USDC: "usd-coin",
  ATOM: "cosmos", UNI: "uniswap", XLM: "stellar", BCH: "bitcoin-cash", TON: "the-open-network", NEAR: "near",
};

/** "BTC", "btc-brl", "BTCUSDT" -> "BTC". */
export function cryptoBaseSymbol(ticker) {
  const t = String(ticker).toUpperCase().trim();
  const base = t.replace(/[-/]?(BRL|USDT|USD)$/, "");
  return base || t;
}

/**
 * Preço em reais de cada cripto informada (chave = ticker em maiúsculas, como cadastrado).
 * @returns {Promise<{ prices: Object<string, number>, failedTickers: string[], networkError: boolean }>}
 */
export async function fetchCryptoQuotes(tickers) {
  const wanted = [...new Set(tickers.map((t) => String(t).toUpperCase().trim()).filter(Boolean))];
  const prices = {};
  let binanceOk = false;
  let coingeckoOk = false;

  try {
    const res = await fetch(BINANCE_PRICES_URL);
    if (res.ok) {
      const map = Object.fromEntries((await res.json()).map((p) => [p.symbol, Number(p.price)]));
      const usdtBrl = map.USDTBRL;
      binanceOk = true;
      wanted.forEach((ticker) => {
        const base = cryptoBaseSymbol(ticker);
        const price = base === "USDT" ? usdtBrl : map[`${base}BRL`] ?? (map[`${base}USDT`] && usdtBrl ? map[`${base}USDT`] * usdtBrl : undefined);
        if (Number.isFinite(price) && price > 0) prices[ticker] = price;
      });
    }
  } catch (err) {
    console.warn("Falha ao buscar cotações na Binance:", err.message);
  }

  const missing = wanted.filter((t) => !(t in prices) && COINGECKO_IDS[cryptoBaseSymbol(t)]);
  if (missing.length > 0) {
    try {
      const ids = [...new Set(missing.map((t) => COINGECKO_IDS[cryptoBaseSymbol(t)]))].join(",");
      const res = await fetch(`${COINGECKO_PRICE_URL}?ids=${ids}&vs_currencies=brl`);
      if (res.ok) {
        const data = await res.json();
        coingeckoOk = true;
        missing.forEach((ticker) => {
          const price = data[COINGECKO_IDS[cryptoBaseSymbol(ticker)]]?.brl;
          if (Number.isFinite(price) && price > 0) prices[ticker] = price;
        });
      }
    } catch (err) {
      console.warn("Falha ao buscar cotações na CoinGecko:", err.message);
    }
  }

  return {
    prices,
    failedTickers: wanted.filter((t) => !(t in prices)),
    networkError: !binanceOk && !coingeckoOk,
  };
}

/* ---------------------------------------------------------------
   Índices de mercado (CDI, IBOV, IFIX) — função serverless /api/indices
--------------------------------------------------------------- */
/**
 * Séries diárias desde a data informada. Só existe com o app na Vercel.
 * @returns {Promise<{ ok: boolean, data: {from:string, cdi:Array, ibov:Array, ifix:Array}|null }>}
 */
export async function fetchMarketIndices(desde) {
  try {
    const res = await fetch(`/api/indices?desde=${encodeURIComponent(desde)}`);
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("Falha ao buscar índices de mercado:", err.message);
    return { ok: false, data: null };
  }
}
