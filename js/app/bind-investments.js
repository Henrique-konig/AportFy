// =========================================================
// AportFy — app/bind-investments.js
// Ligações das telas de investimentos, proventos e saúde da carteira.
// =========================================================

import * as ui from "../ui.js";
import { CRYPTO_CATEGORY, fetchCryptoQuotes, fetchQuotes } from "../api.js";
import { applyInvestmentSale, getInvestmentPurchases, getInvestmentSales, mergeInvestmentPurchase } from "../calc.js";
import { addDividend, addInvestment, savePortfolioSettings, updateDividend, updateInvestment } from "../db.js";
import { importDividendsFromB3, refreshUpcomingDividends } from "./dividend-sync.js";
import { buildPriceHistory, refreshQuotes } from "./quotes.js";
import { session } from "./session.js";

export function bindInvestments() {
  /* -------------------- Investimentos -------------------- */
  ui.onInvestmentFormSubmit(async (data, editingId) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;

      if (editingId) {
        // Edição direta: substitui os dados da posição (ticker, categoria,
        // quantidade, preço médio, data) pelos valores informados — sem
        // mesclar com nenhuma outra compra.
        const current = session.latestInvestments.find((inv) => inv.id === editingId);
        const numbersChanged =
          !current ||
          Number(current.quantity) !== data.quantity ||
          Number(current.avgPrice) !== data.price ||
          current.purchaseDate !== data.purchaseDate;

        await updateInvestment(session.activeMode, id, editingId, {
          ticker: data.ticker,
          category: data.category,
          quantity: data.quantity,
          avgPrice: data.price,
          purchaseDate: data.purchaseDate,
          // Se só ticker/categoria mudaram, o histórico de aportes é mantido;
          // se quantidade/preço/data foram sobrescritos, ele vira uma compra única.
          // As vendas registradas são mantidas; a compra única soma o que já foi vendido
          // para que compras − vendas continue batendo com a quantidade atual.
          ...(numbersChanged && {
            purchases: [
              {
                date: data.purchaseDate,
                quantity: data.quantity + getInvestmentSales(current || {}).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0),
                price: data.price,
              },
            ],
          }),
        });
        ui.showToast("Ativo atualizado com sucesso!", "success");
      } else {
        // Mesmo ativo já existe na carteira? Mescla a compra em vez de
        // criar uma posição duplicada, recalculando o preço médio:
        //   novoPM = (qtdAntiga*pmAntigo + qtdNova*precoNovo) / (qtdAntiga+qtdNova)
        const existing = session.latestInvestments.find(
          (inv) => inv.ticker.toUpperCase() === data.ticker.toUpperCase()
        );

        if (existing) {
          const merged = mergeInvestmentPurchase(existing, {
            quantity: data.quantity,
            price: data.price,
            purchaseDate: data.purchaseDate,
          });

          await updateInvestment(session.activeMode, id, existing.id, {
            ...merged,
            category: data.category,
            purchases: [
              ...getInvestmentPurchases(existing),
              { date: data.purchaseDate, quantity: data.quantity, price: data.price },
            ],
          });
          ui.showToast(`Compra somada à posição de ${existing.ticker}. Preço médio recalculado.`, "success");
        } else {
          await addInvestment(session.activeMode, id, {
            ticker: data.ticker,
            category: data.category,
            quantity: data.quantity,
            avgPrice: data.price,
            currentPrice: data.price,
            purchaseDate: data.purchaseDate,
            purchases: [{ date: data.purchaseDate, quantity: data.quantity, price: data.price }],
            lastQuoteAt: null,
            lastQuoteError: false,
          });
          ui.showToast("Investimento adicionado com sucesso!", "success");
        }
      }
      ui.closeInvestmentModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar investimento.", "error");
    }
  });

  ui.onEditInvestment((investment) => ui.openInvestmentModal(investment));

  ui.onSellSubmit(async ({ id: investmentId, quantity, price, date }) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      const investment = session.latestInvestments.find((inv) => inv.id === investmentId);
      if (!investment) throw new Error("Ativo não encontrado.");
      const update = applyInvestmentSale(investment, { quantity, price, date });
      await updateInvestment(session.activeMode, id, investmentId, update);

      const result = (price - (Number(investment.avgPrice) || 0)) * quantity;
      const resultLabel = `${result >= 0 ? "lucro" : "prejuízo"} de R$ ${Math.abs(result).toFixed(2).replace(".", ",")}`;
      ui.showToast(
        update.quantity > 0 ? `Venda de ${investment.ticker} registrada (${resultLabel}).` : `${investment.ticker} vendido por completo (${resultLabel}). Ele segue no Histórico.`,
        "success"
      );
      ui.closeSellModal();
    } catch (err) {
      console.error(err);
      ui.showToast(err.message === "Quantidade de venda inválida." ? err.message : "Erro ao registrar a venda.", "error");
    }
  });

  ui.onPriceEditSubmit(async (investmentId, price) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      const investment = session.latestInvestments.find((inv) => inv.id === investmentId);
      await updateInvestment(session.activeMode, id, investmentId, {
        currentPrice: price,
        lastQuoteError: false,
        priceHistory: investment ? buildPriceHistory(investment, price) : [{ date: new Date().toISOString().slice(0, 10), price }],
      });
      ui.showToast("Preço atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar preço.", "error");
    }
  });

  /* -------------------- Proventos -------------------- */
  ui.onDividendFormSubmit(async (data, editingId) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      if (editingId) {
        await updateDividend(session.activeMode, id, editingId, data);
        ui.showToast("Provento atualizado com sucesso!", "success");
      } else {
        await addDividend(session.activeMode, id, data);
        ui.showToast("Provento registrado com sucesso!", "success");
      }
      ui.closeDividendModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar provento.", "error");
    }
  });

  ui.onEditDividend((dividend) => ui.openDividendModal(dividend));

  ui.onImportDividends(() => importDividendsFromB3());

  /* -------------------- Saúde da Carteira -------------------- */
  ui.onFinancialIndependenceTargetChange(async (fiMonthlyIncome) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      await savePortfolioSettings(session.activeMode, id, { fiMonthlyIncome });
      ui.showToast(fiMonthlyIncome ? "Meta de renda mensal salva!" : "Meta de renda mensal removida.", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar a meta de renda mensal.", "error");
    }
  });

  ui.onPortfolioSettingsSubmit(async (settings) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      await savePortfolioSettings(session.activeMode, id, settings);
      ui.showToast("Metas de alocação salvas!", "success");
      ui.closePortfolioSettingsModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar as metas de alocação.", "error");
    }
  });
  ui.onRefreshUpcomingDividends(() => refreshUpcomingDividends({ force: true }));

  ui.elements.refreshQuotesBtn?.addEventListener("click", () => refreshQuotes({ silent: false }));

  ui.onFetchB3Price(async (ticker, category) => {
    ui.setB3PriceFetchLoading(true);
    try {
      const isCrypto = category === CRYPTO_CATEGORY;
      const { prices, networkError } = isCrypto ? await fetchCryptoQuotes([ticker]) : await fetchQuotes([ticker]);
      const price = prices[ticker.toUpperCase()];
      if (typeof price === "number") {
        ui.fillInvestmentPrice(price);
      } else if (networkError) {
        ui.showInvestmentPriceHint(`Sem conexão com ${isCrypto ? "as fontes de cotação de cripto" : "a B3"} agora. Informe o preço manualmente.`, true);
      } else if (isCrypto) {
        ui.showInvestmentPriceHint(`Não encontramos a cotação de "${ticker}". Use o símbolo da moeda (ex: BTC, ETH) ou informe o preço manualmente.`, true);
      } else {
        ui.showInvestmentPriceHint(
          `Não foi possível buscar "${ticker}" na B3${category === "FIIs" ? " (FIIs exigem token da Brapi)" : ""}. Informe o preço manualmente.`,
          true
        );
      }
    } finally {
      ui.setB3PriceFetchLoading(false);
    }
  });
}
