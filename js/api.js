// =========================================================
// AportFy — api.js
// Busca de cotações da B3 (Ações e FIIs) via Brapi API.
// Não depende de Firebase; falha de rede nunca deve quebrar
// o app — sempre retorna um resultado parcial utilizável.
// =========================================================

const BRAPI_QUOTE_BASE = "https://brapi.dev/api/quote";
const BRAPI_LIST_BASE = "https://brapi.dev/api/quote/list";

// Opcional: cole aqui sua chave gratuita da Brapi (cadastro em brapi.dev)
// para acelerar/priorizar a busca. Não é obrigatória: Ações usam o
// endpoint /quote direto e FIIs caem automaticamente no endpoint
// /quote/list (ambos liberados sem token no plano gratuito).
const BRAPI_TOKEN = "";

/** Categorias de investimento que têm ticker negociado na B3. */
export const B3_CATEGORIES = ["Ações", "FIIs"];

/**
 * Tenta o endpoint direto /quote/{ticker}. Funciona sem token para Ações;
 * FIIs retornam 401 (MISSING_TOKEN) nesse endpoint no plano gratuito.
 */
async function fetchViaQuoteEndpoint(symbol) {
  const url = BRAPI_TOKEN
    ? `${BRAPI_QUOTE_BASE}/${encodeURIComponent(symbol)}?token=${encodeURIComponent(BRAPI_TOKEN)}`
    : `${BRAPI_QUOTE_BASE}/${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
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
  const res = await fetch(`${BRAPI_LIST_BASE}?search=${encodeURIComponent(symbol)}`);
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

/**
 * Busca o calendário de proventos de um ativo — pagos e já anunciados:
 * - FIIs/Fiagros: função serverless `/api/proventos` (consulta a B3; a API
 *   da Brapi exige token pago para FIIs). Só existe quando o app está na
 *   Vercel — localmente (`npx serve`) a chamada falha e retorna ok:false.
 * - Ações: Brapi (`dividends=true`), liberado sem token.
 * Cada item traz a data-com (exDate), usada para saber quantas cotas o
 * usuário tinha com direito ao provento.
 * @param {string} ticker
 * @param {string} category categoria do ativo ("FIIs" ou "Ações")
 * @returns {Promise<{ dividends: Array<{type:string, rate:number, exDate:string|null, paymentDate:string}>, ok: boolean }>}
 */
export async function fetchDividendCalendar(ticker, category) {
  const symbol = ticker.toUpperCase().trim();
  try {
    if (category === "FIIs") {
      const res = await fetch(`/api/proventos?ticker=${encodeURIComponent(symbol)}`);
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

    const url = BRAPI_TOKEN
      ? `${BRAPI_QUOTE_BASE}/${encodeURIComponent(symbol)}?dividends=true&token=${encodeURIComponent(BRAPI_TOKEN)}`
      : `${BRAPI_QUOTE_BASE}/${encodeURIComponent(symbol)}?dividends=true`;
    const res = await fetch(url);
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
  } catch (err) {
    console.warn(`Falha ao buscar proventos de ${ticker}:`, err.message);
    return { dividends: [], ok: false };
  }
}
