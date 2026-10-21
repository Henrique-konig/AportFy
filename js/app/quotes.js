// =========================================================
// AportFy — app/quotes.js
// Cotações da B3 e cripto, preço histórico e índices (CDI/IBOV/IFIX).
// =========================================================

import * as ui from "../ui.js";
import { B3_CATEGORIES, CRYPTO_CATEGORY, fetchCryptoQuotes, fetchMarketIndices, fetchQuotes } from "../api.js";
import { getInvestmentPurchases } from "../calc.js";
import { updateInvestment } from "../db.js";
import { session } from "./session.js";

let quotesInFlight = false;

/** Últimos N pontos de preço mantidos por ativo (evita crescimento infinito do documento). */
export const PRICE_HISTORY_LIMIT = 24;

/**
 * Anexa (ou atualiza, se já houver um ponto hoje) uma nova leitura de
 * preço ao histórico do ativo — é isso que alimenta o mini-gráfico de
 * "evolução do ativo" no card de detalhe.
 */
export function buildPriceHistory(investment, price) {
  const today = new Date().toISOString().slice(0, 10);
  const history = Array.isArray(investment.priceHistory) ? [...investment.priceHistory] : [];
  if (history.length && history[history.length - 1].date === today) {
    history[history.length - 1] = { date: today, price };
  } else {
    history.push({ date: today, price });
  }
  return history.slice(-PRICE_HISTORY_LIMIT);
}

/* ---------------------------------------------------------------
   Cotações automáticas da B3 (Brapi)
--------------------------------------------------------------- */
export async function refreshQuotes({ silent }) {
  if (quotesInFlight) return;

  const isAutoQuoted = (inv) => B3_CATEGORIES.includes(inv.category) || inv.category === CRYPTO_CATEGORY;
  const eligible = session.latestInvestments.filter((inv) => isAutoQuoted(inv) && (Number(inv.quantity) || 0) > 0);
  if (eligible.length === 0) {
    if (!silent) ui.showToast("Nenhum ativo com cotação automática (Ações, FIIs ou Criptomoedas) para atualizar.", "info");
    return;
  }

  quotesInFlight = true;
  ui.setQuotesLoading(true);

  try {
    const empty = { prices: {}, failedTickers: [], networkError: false };
    const b3Tickers = eligible.filter((inv) => inv.category !== CRYPTO_CATEGORY).map((inv) => inv.ticker);
    const cryptoTickers = eligible.filter((inv) => inv.category === CRYPTO_CATEGORY).map((inv) => inv.ticker);
    const [b3, crypto] = await Promise.all([
      b3Tickers.length ? fetchQuotes(b3Tickers) : empty,
      cryptoTickers.length ? fetchCryptoQuotes(cryptoTickers) : empty,
    ]);
    const prices = { ...b3.prices, ...crypto.prices };
    const failedTickers = [...b3.failedTickers, ...crypto.failedTickers];
    const networkError = (b3Tickers.length === 0 || b3.networkError) && (cryptoTickers.length === 0 || crypto.networkError);
    const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;

    let updated = 0;
    await Promise.all(
      eligible.map(async (inv) => {
        const price = prices[inv.ticker.toUpperCase()];
        if (typeof price === "number") {
          await updateInvestment(session.activeMode, id, inv.id, {
            currentPrice: price,
            lastQuoteAt: new Date().toISOString(),
            lastQuoteError: false,
            priceHistory: buildPriceHistory(inv, price),
          });
          updated++;
        } else {
          // Falha nesse ticker específico: mantém o último currentPrice
          // salvo e só sinaliza o alerta visual na linha do ativo.
          await updateInvestment(session.activeMode, id, inv.id, { lastQuoteError: true });
        }
      })
    );

    if (networkError) {
      ui.showToast("Não foi possível conectar às fontes de cotação agora. Mantendo os últimos preços salvos.", "error");
    } else if (updated > 0) {
      const failMsg = failedTickers.length ? ` (${failedTickers.length} ticker(s) não encontrado(s))` : "";
      ui.showToast(`${updated} cotação(ões) atualizada(s)${failMsg}.`, "success");
    } else {
      ui.showToast("Não foi possível atualizar nenhuma cotação. Mantendo os últimos preços salvos.", "error");
    }
  } catch (err) {
    console.error(err);
    ui.showToast("Erro ao buscar cotações.", "error");
  } finally {
    quotesInFlight = false;
    ui.setQuotesLoading(false);
  }
}

/* -------------------- Carteira x Mercado -------------------- */
export const INDICES_CACHE_KEY = "aportfy_market_indices";
export const INDICES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let indicesLoadedFrom = null; // data inicial das séries já carregadas nesta sessão
let indicesData = null; // as séries em si (a tela as perde ao trocar de modo e precisa recebê-las de novo)
let indicesLoading = false;

/** Busca CDI/IBOV/IFIX desde o primeiro aporte (com cache local de 6h) e entrega para a tela. */
export async function refreshMarketIndices() {
  const firstFlow = session.latestInvestments
    .flatMap((inv) => getInvestmentPurchases(inv).map((p) => String(p.date).slice(0, 10)))
    .sort()[0];
  if (!firstFlow) return ui.setMarketIndices(null, "idle");
  if (indicesLoading) return;
  if (indicesData && indicesLoadedFrom <= firstFlow) return ui.setMarketIndices(indicesData, "ready");

  try {
    const cached = JSON.parse(localStorage.getItem(INDICES_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.at < INDICES_CACHE_TTL_MS && cached.desde <= firstFlow) {
      indicesLoadedFrom = cached.desde;
      indicesData = cached.data;
      return ui.setMarketIndices(cached.data, "ready");
    }
  } catch {
    /* cache indisponível */
  }

  indicesLoading = true;
  ui.setMarketIndices(null, "loading");
  const { ok, data } = await fetchMarketIndices(firstFlow);
  indicesLoading = false;
  if (!ok) return ui.setMarketIndices(null, "error");

  indicesLoadedFrom = firstFlow;
  indicesData = data;
  ui.setMarketIndices(data, "ready");
  try {
    localStorage.setItem(INDICES_CACHE_KEY, JSON.stringify({ at: Date.now(), desde: firstFlow, data }));
  } catch {
    /* cota do storage cheia: segue sem cache */
  }
}
