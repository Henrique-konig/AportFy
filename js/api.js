// =========================================================
// EcoFy — api.js
// Busca de cotações da B3 (Ações e FIIs) via Brapi API.
// Não depende de Firebase; falha de rede nunca deve quebrar
// o app — sempre retorna um resultado parcial utilizável.
// =========================================================

const BRAPI_BASE = "https://brapi.dev/api/quote";

// Opcional: cole aqui sua chave gratuita da Brapi (cadastro em brapi.dev)
// para liberar cotações de FIIs, que o plano sem token não retorna.
// Ações comuns (ex: PETR4) funcionam mesmo com este campo vazio.
const BRAPI_TOKEN = "";

/** Categorias de investimento que têm ticker negociado na B3. */
export const B3_CATEGORIES = ["Ações", "FIIs"];

/**
 * Busca a cotação de um único ticker na Brapi.
 * @param {string} symbol
 * @returns {Promise<{ symbol: string, price: number|null, networkError: boolean }>}
 */
async function fetchOneQuote(symbol) {
  try {
    const url = BRAPI_TOKEN
      ? `${BRAPI_BASE}/${encodeURIComponent(symbol)}?token=${encodeURIComponent(BRAPI_TOKEN)}`
      : `${BRAPI_BASE}/${encodeURIComponent(symbol)}`;
    const res = await fetch(url);

    if (!res.ok) {
      // Ticker inválido, limite de requisições ou (no plano gratuito da
      // Brapi) exigência de token para consultas em lote — nunca lança,
      // apenas reporta esse símbolo como falho.
      return { symbol, price: null, networkError: false };
    }

    const data = await res.json();
    const price = data.results?.[0]?.regularMarketPrice;
    return { symbol, price: typeof price === "number" ? price : null, networkError: false };
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
