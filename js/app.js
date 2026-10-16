// =========================================================
// AportFy — app.js
// Ponto de entrada da aplicação: conecta auth.js, db.js e
// ui.js, registrando os event listeners da página.
// =========================================================

import {
  onAuthChange,
  login,
  register,
  logout,
  translateAuthError,
  updateDisplayName,
  requestPasswordReset,
  sendVerificationEmail,
  refreshEmailVerification,
  reauthenticate,
  deleteCurrentUser,
} from "./auth.js";
import {
  listenToTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  listenToGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  listenToInvestments,
  addInvestment,
  updateInvestment,
  deleteInvestment,
  listenToDividends,
  addDividend,
  updateDividend,
  deleteDividend,
  listenToBudgets,
  listenToPortfolioSettings,
  savePortfolioSettings,
  upsertBudget,
  deleteBudget,
  listenToRecurrences,
  addRecurrence,
  updateRecurrence,
  deleteRecurrence,
  getUserProfile,
  upsertUserProfile,
  createCoupleSpace,
  getCoupleDoc,
  addCoupleMember,
  requestJoinCouple,
  listenToMyJoinRequest,
  finishJoinRequest,
  cancelJoinRequest,
  listenToJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  deleteAccountData,
  clearLocalCache,
} from "./db.js";
import { fetchQuotes, fetchDividendCalendar, fetchCryptoQuotes, fetchMarketIndices, B3_CATEGORIES, CRYPTO_CATEGORY } from "./api.js";
import { fetchPortfolioNews, fetchMarketNews } from "./news.js";
import {
  mergeInvestmentPurchase,
  recurrenceDateForMonth,
  dividendDedupeKey,
  getInvestmentPurchases,
  sharesOnDate,
  buildUpcomingDividends,
  dividendNetAmount,
  applyInvestmentSale,
  getInvestmentSales,
  passwordProblem,
} from "./calc.js";
import * as ui from "./ui.js";

/* ---------------------------------------------------------------
   Estado da aplicação
--------------------------------------------------------------- */
let unsubscribeTransactions = null;
let unsubscribeGoals = null;
let unsubscribeInvestments = null;
let unsubscribeDividends = null;
let unsubscribeBudgets = null;
let unsubscribePortfolioSettings = null;
let unsubscribeMyJoinRequest = null;
let unsubscribeJoinRequests = null;
let pendingJoinCoupleId = null;
let unsubscribeRecurrences = null;
let activeUser = null;
let activeMode = "personal";
let activeCoupleId = null;
let latestTransactions = [];
let latestGoals = [];
let latestInvestments = [];
let latestDividends = [];
let dividendsLoaded = false;
// Chaves já gravadas nesta sessão: o snapshot do Firestore demora um instante e não pode causar duplicidade.
const sessionRegisteredKeys = new Set();
let latestBudgets = [];
let latestRecurrences = [];
let recurrencesProcessing = false;
let quotesInFlight = false;

/** Últimos N pontos de preço mantidos por ativo (evita crescimento infinito do documento). */
const PRICE_HISTORY_LIMIT = 24;

/**
 * Anexa (ou atualiza, se já houver um ponto hoje) uma nova leitura de
 * preço ao histórico do ativo — é isso que alimenta o mini-gráfico de
 * "evolução do ativo" no card de detalhe.
 */
function buildPriceHistory(investment, price) {
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
   Inicialização de bindings de UI (executados uma única vez)
--------------------------------------------------------------- */
function initUIBindings() {
  ui.bindSidebarToggle();
  ui.bindTransactionModal();
  ui.bindRecurrenceModal();
  ui.bindGoalModal();
  ui.bindBudgetModal();
  ui.bindInvestmentModal();
  ui.bindPriceEditModal();
  ui.bindDividendModal();
  ui.bindImportDividends();
  ui.bindDeleteModal();
  ui.bindDatePickers();
  ui.bindCustomDropdowns();
  ui.bindSearch();
  ui.bindMobileSearch();
  ui.bindTransactionFilters();
  ui.bindDashboardFilters();
  ui.bindReportsFilters();
  ui.bindInvestmentFilters();
  ui.bindPortfolioHealth();
  ui.bindSellModal();
  ui.bindAlerts();
  ui.bindInstallApp();
  ui.bindTheme();
  ui.bindAccessibility();
  ui.bindOnboarding();
  ui.bindDividendCalendar();
  ui.bindFinancialIndependence();
  ui.bindHistory();
  ui.bindSettingsForms();
  ui.bindNewsSubtabs();

  ui.onNavChange((view) => {
    ui.setActiveView(view);
    if (view === "investments") refreshQuotes({ silent: true });
    if (view === "news") loadNewsView();
  });
  ui.onModeToggle((mode) => switchMode(mode));

  ui.onLogoutClick(async () => {
    try {
      await logout();
      ui.showToast("Sessão encerrada com sucesso.", "info");
    } catch (err) {
      ui.showToast("Erro ao sair da conta.", "error");
    }
  });

  /* -------------------- Transações -------------------- */
  ui.onTransactionFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateTransaction(activeMode, id, editingId, data);
        ui.showToast("Transação atualizada com sucesso!", "success");
      } else {
        await addTransaction(activeMode, id, data);
        ui.showToast("Transação adicionada com sucesso!", "success");
      }
      ui.closeTransactionModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar transação.", "error");
    }
  });

  ui.onEditTransaction((transaction) => ui.openTransactionModal(transaction));

  /* -------------------- Recorrências -------------------- */
  ui.onRecurrenceFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateRecurrence(activeMode, id, editingId, data);
        ui.showToast("Recorrência atualizada com sucesso!", "success");
      } else {
        await addRecurrence(activeMode, id, data);
        ui.showToast("Recorrência criada com sucesso!", "success");
      }
      ui.closeRecurrenceModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar recorrência.", "error");
    }
  });

  ui.onEditRecurrence((recurrence) => ui.openRecurrenceModal(recurrence));

  /* -------------------- Metas -------------------- */
  ui.onGoalFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateGoal(activeMode, id, editingId, data);
        ui.showToast("Meta atualizada com sucesso!", "success");
      } else {
        await addGoal(activeMode, id, data);
        ui.showToast("Meta criada com sucesso!", "success");
      }
      ui.closeGoalModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar meta.", "error");
    }
  });

  ui.onEditGoal((goal) => ui.openGoalModal(goal));

  /* -------------------- Orçamento -------------------- */
  ui.onBudgetFormSubmit(async (category, monthlyLimit) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      await upsertBudget(activeMode, id, category, monthlyLimit);
      ui.showToast("Orçamento salvo com sucesso!", "success");
      ui.closeBudgetModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar orçamento.", "error");
    }
  });

  ui.onEditBudget((budget) => ui.openBudgetModal(budget));

  /* -------------------- Investimentos -------------------- */
  ui.onInvestmentFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;

      if (editingId) {
        // Edição direta: substitui os dados da posição (ticker, categoria,
        // quantidade, preço médio, data) pelos valores informados — sem
        // mesclar com nenhuma outra compra.
        const current = latestInvestments.find((inv) => inv.id === editingId);
        const numbersChanged =
          !current ||
          Number(current.quantity) !== data.quantity ||
          Number(current.avgPrice) !== data.price ||
          current.purchaseDate !== data.purchaseDate;

        await updateInvestment(activeMode, id, editingId, {
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
        const existing = latestInvestments.find(
          (inv) => inv.ticker.toUpperCase() === data.ticker.toUpperCase()
        );

        if (existing) {
          const merged = mergeInvestmentPurchase(existing, {
            quantity: data.quantity,
            price: data.price,
            purchaseDate: data.purchaseDate,
          });

          await updateInvestment(activeMode, id, existing.id, {
            ...merged,
            category: data.category,
            purchases: [
              ...getInvestmentPurchases(existing),
              { date: data.purchaseDate, quantity: data.quantity, price: data.price },
            ],
          });
          ui.showToast(`Compra somada à posição de ${existing.ticker}. Preço médio recalculado.`, "success");
        } else {
          await addInvestment(activeMode, id, {
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
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      const investment = latestInvestments.find((inv) => inv.id === investmentId);
      if (!investment) throw new Error("Ativo não encontrado.");
      const update = applyInvestmentSale(investment, { quantity, price, date });
      await updateInvestment(activeMode, id, investmentId, update);

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
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      const investment = latestInvestments.find((inv) => inv.id === investmentId);
      await updateInvestment(activeMode, id, investmentId, {
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
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateDividend(activeMode, id, editingId, data);
        ui.showToast("Provento atualizado com sucesso!", "success");
      } else {
        await addDividend(activeMode, id, data);
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
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      await savePortfolioSettings(activeMode, id, { fiMonthlyIncome });
      ui.showToast(fiMonthlyIncome ? "Meta de renda mensal salva!" : "Meta de renda mensal removida.", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar a meta de renda mensal.", "error");
    }
  });

  ui.onPortfolioSettingsSubmit(async (settings) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      await savePortfolioSettings(activeMode, id, settings);
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

  /* -------------------- Exclusão genérica -------------------- */
  ui.onDeleteConfirm(async (id, type) => {
    try {
      const collectionId = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (type === "goal") {
        await deleteGoal(activeMode, collectionId, id);
        ui.showToast("Meta excluída.", "success");
      } else if (type === "investment") {
        await deleteInvestment(activeMode, collectionId, id);
        ui.showToast("Ativo excluído.", "success");
      } else if (type === "dividend") {
        const removed = latestDividends.find((d) => d.id === id);
        await deleteDividend(activeMode, collectionId, id);
        if (removed) ignoreDividend(dividendDedupeKey(removed.ticker, removed.date, removed.type));
        ui.showToast("Provento excluído.", "success");
      } else if (type === "budget") {
        await deleteBudget(activeMode, collectionId, id);
        ui.showToast("Orçamento excluído.", "success");
      } else if (type === "recurrence") {
        await deleteRecurrence(activeMode, collectionId, id);
        ui.showToast("Recorrência excluída.", "success");
      } else {
        await deleteTransaction(activeMode, collectionId, id);
        ui.showToast("Transação excluída.", "success");
      }
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao excluir item.", "error");
    }
  });

  /* -------------------- Configurações -------------------- */
  ui.onProfileUpdate(async (displayName) => {
    try {
      await updateDisplayName(displayName);
      await upsertUserProfile(activeUser.uid, { displayName });
      ui.showAppShell({ ...activeUser, displayName });
      ui.showToast("Perfil atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar perfil.", "error");
    }
  });

  // Entrar no espaço de outra pessoa exige aprovação do dono: aqui só se envia o pedido.
  ui.onJoinCouple(async (coupleId) => {
    if (!activeUser.emailVerified) {
      ui.showToast("Confirme seu e-mail antes de pedir entrada em um espaço de casal (veja o aviso no topo).", "error");
      return;
    }
    try {
      await requestJoinCouple(activeUser.uid, coupleId, { email: activeUser.email || "", displayName: activeUser.displayName || "" });
      watchMyJoinRequest(coupleId);
      ui.showToast("Pedido enviado! Assim que o dono do espaço aprovar, você entra.", "success");
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || "Erro ao enviar o pedido de entrada.", "error");
    }
  });

  ui.onCancelJoinRequest(async () => {
    if (!pendingJoinCoupleId) return;
    try {
      const coupleId = pendingJoinCoupleId;
      stopWatchingMyJoinRequest();
      await cancelJoinRequest(activeUser.uid, coupleId);
      ui.showToast("Pedido cancelado.", "info");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao cancelar o pedido.", "error");
    }
  });

  // Dono do espaço: aprova ou recusa pedidos de entrada.
  ui.onJoinRequestDecision(async (requesterUid, decision) => {
    try {
      if (decision === "approve") {
        await approveJoinRequest(activeUser.uid, requesterUid);
        ui.showToast("Pedido aprovado! A pessoa agora faz parte do seu espaço.", "success");
      } else {
        await rejectJoinRequest(activeUser.uid, requesterUid);
        ui.showToast("Pedido recusado.", "info");
      }
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao responder o pedido.", "error");
    }
  });

  ui.onPasswordReset(async () => {
    try {
      await requestPasswordReset(activeUser.email);
      ui.showToast("E-mail de redefinição enviado!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao enviar e-mail de redefinição.", "error");
    }
  });

  ui.bindAccountSecurity({
    onResend: async () => {
      try {
        await sendVerificationEmail();
        ui.showToast("E-mail de confirmação enviado! Confira também a caixa de spam.", "success");
      } catch (err) {
        console.error(err);
        ui.showToast(translateAuthError(err), "error");
      }
    },
    onCheck: () => checkEmailVerification({ announce: true }),
    onDelete: (password) => deleteAccountFlow(password),
  });

  ui.onExportBackup(() => exportBackup());
  ui.onImportBackup((file) => importBackup(file));

  /* -------------------- Auth screen -------------------- */
  ui.elements.toggleAuthModeBtn.addEventListener("click", () => ui.toggleAuthMode());

  ui.elements.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.clearAuthError();
    ui.setAuthLoading(true);

    const email = ui.elements.loginEmail.value.trim();
    const password = ui.elements.loginPassword.value;

    try {
      if (ui.getIsRegisterMode()) {
        const problem = passwordProblem(password);
        if (problem) {
          ui.showAuthError(problem);
          return;
        }
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      ui.showAuthError(translateAuthError(err));
    } finally {
      ui.setAuthLoading(false);
    }
  });

  ui.initCharts();
  ui.initReportsCharts();
  ui.initInvestmentCharts();
  ui.initAssetDetailChart();
  ui.initDividendsChart();
  ui.initHealthCharts();
}

/* ---------------------------------------------------------------
   Cotações automáticas da B3 (Brapi)
--------------------------------------------------------------- */
async function refreshQuotes({ silent }) {
  if (quotesInFlight) return;

  const isAutoQuoted = (inv) => B3_CATEGORIES.includes(inv.category) || inv.category === CRYPTO_CATEGORY;
  const eligible = latestInvestments.filter((inv) => isAutoQuoted(inv) && (Number(inv.quantity) || 0) > 0);
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
    const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;

    let updated = 0;
    await Promise.all(
      eligible.map(async (inv) => {
        const price = prices[inv.ticker.toUpperCase()];
        if (typeof price === "number") {
          await updateInvestment(activeMode, id, inv.id, {
            currentPrice: price,
            lastQuoteAt: new Date().toISOString(),
            lastQuoteError: false,
            priceHistory: buildPriceHistory(inv, price),
          });
          updated++;
        } else {
          // Falha nesse ticker específico: mantém o último currentPrice
          // salvo e só sinaliza o alerta visual na linha do ativo.
          await updateInvestment(activeMode, id, inv.id, { lastQuoteError: true });
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

/* ---------------------------------------------------------------
   Backup e Restauração
--------------------------------------------------------------- */
function serializeForBackup(items) {
  return items.map((item) => {
    const clean = { ...item };
    // createdAt vem como Timestamp do Firestore — vira ISO pra ficar
    // legível/portável no JSON exportado.
    if (clean.createdAt && typeof clean.createdAt.toDate === "function") {
      clean.createdAt = clean.createdAt.toDate().toISOString();
    }
    return clean;
  });
}

function exportBackup() {
  const payload = {
    app: "AportFy",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    mode: activeMode,
    transactions: serializeForBackup(latestTransactions),
    goals: serializeForBackup(latestGoals),
    investments: serializeForBackup(latestInvestments),
    dividends: serializeForBackup(latestDividends),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aportfy-backup-${activeMode}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  ui.showToast("Backup baixado com sucesso!", "success");
}

// Mapeia cada categoria do backup pra função de escrita já existente —
// reimportar cria documentos novos (id e createdAt são regenerados).
const BACKUP_IMPORTERS = {
  transactions: addTransaction,
  goals: addGoal,
  investments: addInvestment,
  dividends: addDividend,
};

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    ui.showToast("Arquivo inválido — não é um JSON de backup do AportFy.", "error");
    return;
  }

  const counts = Object.fromEntries(
    Object.keys(BACKUP_IMPORTERS).map((key) => [key, Array.isArray(data[key]) ? data[key].length : 0])
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    ui.showToast("Nenhum registro encontrado nesse arquivo.", "error");
    return;
  }

  const modeLabel = activeMode === "couple" ? "Casal" : "Pessoal";
  const confirmed = window.confirm(
    `Restaurar vai ADICIONAR ${counts.transactions} transação(ões), ${counts.goals} meta(s), ${counts.investments} ativo(s) e ${counts.dividends} provento(s) aos dados atuais do modo ${modeLabel}. Isso não apaga nada existente. Continuar?`
  );
  if (!confirmed) return;

  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  let imported = 0;
  let failed = 0;

  for (const [key, addFn] of Object.entries(BACKUP_IMPORTERS)) {
    for (const item of data[key] || []) {
      try {
        const { id: _discardId, createdAt: _discardCreatedAt, ...rest } = item;
        await addFn(activeMode, id, rest);
        imported++;
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  }

  if (failed === 0) {
    ui.showToast(`Backup restaurado: ${imported} registro(s) adicionado(s).`, "success");
  } else {
    ui.showToast(`Restaurado ${imported} registro(s), ${failed} falharam.`, "error");
  }
}

/* ---------------------------------------------------------------
   Notícias (Alpha Vantage) — mercado geral + ativos da carteira
--------------------------------------------------------------- */
function newsErrorMessage(reason, target) {
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

async function loadNewsView() {
  // Mercado Diário independe da carteira — dispara em paralelo com a busca por ativo.
  ui.renderNewsSkeletons("market", 6);
  fetchMarketNews().then((res) => {
    ui.renderNewsCards("market", res.items, res.ok ? null : newsErrorMessage(res.reason, "market"));
  });

  const tickers = latestInvestments.map((inv) => inv.ticker);
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

/* ---------------------------------------------------------------
   Proventos da B3: importação dos já pagos e calendário dos a receber
--------------------------------------------------------------- */

// Ações (Brapi) e FIIs (função serverless /api/proventos, que consulta a B3).
const DIVIDEND_IMPORT_CATEGORIES = ["Ações", "FIIs"];
const CALENDAR_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

// Data local (YYYY-MM-DD) — toISOString() viraria o dia seguinte à noite no Brasil.
const localISODate = () => new Date().toLocaleDateString("sv-SE");

/** Calendário de proventos de um ativo, com cache local de 3h pra não repetir consultas. */
async function getDividendCalendar(inv, { force = false } = {}) {
  const cacheKey = `aportfy_div_calendar_${inv.category}_${inv.ticker}`;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CALENDAR_CACHE_TTL_MS) return { dividends: cached.dividends, ok: true };
    } catch {
      /* cache indisponível: segue sem ele */
    }
  }

  const result = await fetchDividendCalendar(inv.ticker, inv.category);
  if (result.ok) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), dividends: result.dividends }));
    } catch {
      /* cota do storage cheia: ignora */
    }
  }
  return result;
}

// Calendários já carregados nesta sessão (por ticker); null = consulta falhou.
const dividendCalendars = {};

/** Atualiza o painel "Proventos a Receber" (busca só o que ainda não foi carregado, ou tudo com force). */
async function refreshUpcomingDividends({ force = false } = {}) {
  const eligible = latestInvestments.filter((inv) => DIVIDEND_IMPORT_CATEGORIES.includes(inv.category));
  const pending = eligible.filter((inv) => force || !(inv.ticker in dividendCalendars));

  if (pending.length > 0) {
    ui.setUpcomingDividendsLoading(true);
    await Promise.all(
      pending.map(async (inv) => {
        const { dividends, ok } = await getDividendCalendar(inv, { force });
        dividendCalendars[inv.ticker] = ok ? dividends : null;
      })
    );
  }

  const failed = eligible.filter((inv) => dividendCalendars[inv.ticker] === null).map((inv) => inv.ticker);
  const calendars = Object.fromEntries(Object.entries(dividendCalendars).filter(([, v]) => v));
  ui.renderUpcomingDividends(buildUpcomingDividends(eligible, calendars, localISODate()), { failed, hasEligible: eligible.length > 0 });
  autoSyncPaidDividends(eligible);
}

// Proventos que o usuário excluiu de propósito: a importação automática não os recria.
const IGNORED_DIVIDENDS_KEY = "aportfy_ignored_dividends";
const readIgnoredDividends = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGNORED_DIVIDENDS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
function ignoreDividend(key) {
  try {
    const ignored = readIgnoredDividends();
    ignored.add(key);
    localStorage.setItem(IGNORED_DIVIDENDS_KEY, JSON.stringify([...ignored]));
  } catch {
    /* storage indisponível: o provento pode voltar na próxima importação automática */
  }
}

let syncingPaidDividends = false;

/**
 * Registra os proventos já pagos que ainda não estão lançados, calculados pelas
 * cotas que o usuário tinha na data-com. `calendarFor` devolve o calendário de
 * cada ativo (ou null se a consulta falhou). Retorna quantos lançou e o total.
 */
async function registerPaidDividends(eligible, calendarFor, { skipIgnored }) {
  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  const today = localISODate();
  const ignored = skipIgnored ? readIgnoredDividends() : new Set();
  // Evita lançar o mesmo provento duas vezes (inclusive entre rodadas seguidas).
  const existingKeys = new Set([...latestDividends.map((d) => dividendDedupeKey(d.ticker, d.date, d.type)), ...sessionRegisteredKeys]);

  let imported = 0;
  let importedTotal = 0;
  let anyFailed = false;

  for (const inv of eligible) {
    const dividends = calendarFor(inv);
    if (!dividends) {
      anyFailed = true;
      continue;
    }

    for (const d of dividends) {
      // Só os já pagos — os anunciados aparecem como "a receber".
      if (d.paymentDate > today) continue;

      // Cotas que o usuário tinha na data-com (direito ao provento).
      const shares = sharesOnDate(inv, d.exDate || d.paymentDate);
      if (shares <= 0) continue;

      const key = dividendDedupeKey(inv.ticker, d.paymentDate, d.type);
      if (existingKeys.has(key) || ignored.has(key)) continue;
      existingKeys.add(key);
      sessionRegisteredKeys.add(key);

      const amount = Math.round(dividendNetAmount(d.type, d.rate, shares) * 100) / 100;
      await addDividend(activeMode, id, {
        ticker: inv.ticker,
        type: d.type,
        amount,
        date: d.paymentDate,
        rate: d.rate,
        shares,
        exDate: d.exDate || null,
      });
      imported++;
      importedTotal += amount;
    }
  }

  return { imported, importedTotal, anyFailed };
}

/** Importação automática: roda quando o calendário carrega e lança os proventos pagos que faltam. */
async function autoSyncPaidDividends(eligible) {
  if (syncingPaidDividends || !dividendsLoaded || !activeUser || eligible.length === 0) return;
  syncingPaidDividends = true;
  try {
    await registerPaidDividends(eligible, (inv) => dividendCalendars[inv.ticker] || null, { skipIgnored: true });
  } catch (err) {
    console.error("Falha na importação automática de proventos:", err);
  } finally {
    syncingPaidDividends = false;
  }
}

async function importDividendsFromB3() {
  const eligible = latestInvestments.filter((inv) => DIVIDEND_IMPORT_CATEGORIES.includes(inv.category));
  if (eligible.length === 0) {
    ui.showToast("Nenhuma ação ou FII cadastrado para importar proventos.", "info");
    return;
  }

  ui.setImportDividendsLoading(true);

  try {
    const calendars = {};
    await Promise.all(
      eligible.map(async (inv) => {
        const { dividends, ok } = await getDividendCalendar(inv, { force: true });
        calendars[inv.ticker] = ok ? dividends : null;
        dividendCalendars[inv.ticker] = ok ? dividends : null;
      })
    );

    // Importação manual: traz também o que foi excluído antes (o usuário pediu de novo).
    const { imported, importedTotal, anyFailed } = await registerPaidDividends(eligible, (inv) => calendars[inv.ticker], { skipIgnored: false });

    if (imported > 0) {
      ui.showToast(
        `${imported} provento(s) importado(s) da B3 (R$ ${importedTotal.toFixed(2).replace(".", ",")} no total).`,
        "success"
      );
    } else if (anyFailed) {
      ui.showToast("Não foi possível buscar proventos na B3 agora.", "error");
    } else {
      ui.showToast("Nenhum provento novo encontrado na B3 para importar.", "info");
    }
    refreshUpcomingDividends();
  } catch (err) {
    console.error(err);
    ui.showToast("Erro ao importar proventos da B3.", "error");
  } finally {
    ui.setImportDividendsLoading(false);
  }
}

/* ---------------------------------------------------------------
   Assinatura de dados (Firestore) de acordo com o modo ativo
--------------------------------------------------------------- */
function refreshDashboard() {
  ui.updateKPIs(latestTransactions, latestGoals);
  ui.renderTransactionsTable(latestTransactions);
  ui.renderFullTransactionsTable(latestTransactions);
  ui.updateCharts(latestTransactions);
  ui.renderReports(latestTransactions);
  ui.renderBudgets(latestBudgets, latestTransactions);
}

/**
 * Gera a transação do mês atual pra cada recorrência que ainda não foi
 * lançada nesse mês (lastGeneratedMonth != mês atual). Roda toda vez que
 * a lista de recorrências chega do Firestore — é seguro rodar de novo
 * porque cada recorrência só é processada uma vez por mês (marcada logo
 * após a escrita), e a flag local evita reentrância se dois snapshots
 * chegarem em sequência rápida.
 */
async function processRecurrences(recurrences) {
  if (recurrencesProcessing || recurrences.length === 0) return;
  recurrencesProcessing = true;

  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;

    for (const r of recurrences) {
      if (r.lastGeneratedMonth === currentMonthKey) continue;

      const date = recurrenceDateForMonth(now.getFullYear(), now.getMonth(), r.dayOfMonth);

      try {
        await addTransaction(activeMode, id, {
          description: r.description,
          amount: r.amount,
          type: r.type,
          category: r.category,
          date,
        });
        await updateRecurrence(activeMode, id, r.id, { lastGeneratedMonth: currentMonthKey });
      } catch (err) {
        console.error(`Erro ao gerar transação recorrente de "${r.description}":`, err);
      }
    }
  } finally {
    recurrencesProcessing = false;
  }
}

function subscribeToActiveCollection() {
  if (unsubscribeTransactions) {
    unsubscribeTransactions();
    unsubscribeTransactions = null;
  }
  if (unsubscribeGoals) {
    unsubscribeGoals();
    unsubscribeGoals = null;
  }
  if (unsubscribeInvestments) {
    unsubscribeInvestments();
    unsubscribeInvestments = null;
  }
  if (unsubscribeDividends) {
    unsubscribeDividends();
    unsubscribeDividends = null;
  }
  // Troca de modo/usuário: os proventos do modo anterior não podem servir de base para a importação automática.
  dividendsLoaded = false;
  sessionRegisteredKeys.clear();
  if (unsubscribeBudgets) {
    unsubscribeBudgets();
    unsubscribeBudgets = null;
  }
  if (unsubscribePortfolioSettings) {
    unsubscribePortfolioSettings();
    unsubscribePortfolioSettings = null;
  }
  if (unsubscribeRecurrences) {
    unsubscribeRecurrences();
    unsubscribeRecurrences = null;
  }

  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  if (!id) return;

  // Primeiros passos: só no espaço pessoal e depois que transações e investimentos chegaram.
  const onboardingUid = activeMode === "personal" ? activeUser.uid : null;
  const loadedForOnboarding = { transactions: false, investments: false };
  const syncOnboarding = (key) => {
    loadedForOnboarding[key] = true;
    ui.updateOnboarding({ uid: onboardingUid, ready: loadedForOnboarding.transactions && loadedForOnboarding.investments });
  };
  ui.updateOnboarding({ uid: onboardingUid, ready: false });

  unsubscribeTransactions = listenToTransactions(activeMode, id, (transactions, error) => {
    if (error) {
      ui.showToast("Erro ao carregar transações em tempo real.", "error");
      return;
    }
    latestTransactions = transactions;
    refreshDashboard();
    syncOnboarding("transactions");
  });

  unsubscribeGoals = listenToGoals(activeMode, id, (goals, error) => {
    if (error) {
      ui.showToast("Erro ao carregar metas em tempo real.", "error");
      return;
    }
    latestGoals = goals;
    ui.renderGoals(goals);
    ui.updateKPIs(latestTransactions, latestGoals);
  });

  unsubscribeInvestments = listenToInvestments(activeMode, id, (investments, error) => {
    if (error) {
      ui.showToast("Erro ao carregar investimentos em tempo real.", "error");
      return;
    }
    latestInvestments = investments;
    ui.renderInvestments(investments);
    refreshUpcomingDividends();
    refreshMarketIndices();
    syncOnboarding("investments");
  });

  unsubscribeDividends = listenToDividends(activeMode, id, (dividends, error, meta) => {
    if (error) {
      ui.showToast("Erro ao carregar proventos em tempo real.", "error");
      return;
    }
    // A importação automática só confia na lista confirmada pelo servidor (o cache local
    // pode não ter proventos lançados por outro aparelho, o que geraria duplicados).
    const firstLoad = !dividendsLoaded && !meta?.fromCache;
    latestDividends = dividends;
    if (!meta?.fromCache) dividendsLoaded = true;
    ui.renderDividendsData(dividends);
    if (firstLoad) refreshUpcomingDividends();
  });

  unsubscribePortfolioSettings = listenToPortfolioSettings(activeMode, id, (settings, error) => {
    if (error) {
      ui.showToast("Erro ao carregar as metas da carteira.", "error");
      return;
    }
    ui.setPortfolioSettings(settings);
  });

  unsubscribeBudgets = listenToBudgets(activeMode, id, (budgets, error) => {
    if (error) {
      ui.showToast("Erro ao carregar orçamentos em tempo real.", "error");
      return;
    }
    latestBudgets = budgets;
    ui.renderBudgets(latestBudgets, latestTransactions);
  });

  unsubscribeRecurrences = listenToRecurrences(activeMode, id, (recurrences, error, meta) => {
    if (error) {
      ui.showToast("Erro ao carregar recorrências em tempo real.", "error");
      return;
    }
    latestRecurrences = recurrences;
    ui.renderRecurrences(recurrences);
    // Lançar recorrências com dado do cache local poderia duplicar o que outro aparelho já lançou.
    if (!meta?.fromCache) processRecurrences(recurrences);
  });
}

/**
 * Garante que o usuário possua um coupleId associado ao seu perfil.
 * Caso não exista, cria um espaço de "casal" vinculado ao próprio
 * usuário, que pode ser compartilhado com o parceiro(a) posteriormente.
 */
async function ensureCoupleId(user) {
  const profile = await getUserProfile(user.uid);
  let coupleId = profile?.coupleId || user.uid;

  // O perfil sozinho não dá acesso ao espaço de outra pessoa: só vale se o
  // usuário for mesmo um dos membros. Caso contrário, volta ao espaço próprio.
  if (coupleId !== user.uid) {
    let isMember = false;
    try {
      isMember = (await getCoupleDoc(coupleId))?.members?.includes(user.uid) === true;
    } catch {
      isMember = false;
    }
    if (!isMember) {
      console.warn("Usuário não é membro do espaço de casal do perfil; voltando ao espaço próprio.");
      coupleId = user.uid;
      await upsertUserProfile(user.uid, { coupleId });
      ui.showToast("Você não faz parte do espaço de casal anterior. Voltamos para o seu espaço.", "info");
    }
  }

  // Espaço próprio: cria se ainda não existe (o dono sempre pode ler o próprio espaço).
  if (coupleId === user.uid) {
    const coupleDoc = await getCoupleDoc(coupleId);
    if (!coupleDoc) {
      await createCoupleSpace(coupleId, user.uid);
    } else if (!coupleDoc.members?.includes(user.uid)) {
      await addCoupleMember(coupleId, user.uid);
    }
  }

  if (!profile?.coupleId) {
    await upsertUserProfile(user.uid, { coupleId, email: user.email });
  }

  return coupleId;
}

/* -------------------- Convite ao espaço de casal -------------------- */
function stopWatchingMyJoinRequest() {
  unsubscribeMyJoinRequest?.();
  unsubscribeMyJoinRequest = null;
  pendingJoinCoupleId = null;
  ui.renderJoinStatus(null);
}

/** Acompanha o pedido de entrada enviado: aprovado -> entra no espaço; recusado -> avisa. */
function watchMyJoinRequest(coupleId) {
  unsubscribeMyJoinRequest?.();
  pendingJoinCoupleId = coupleId;
  ui.renderJoinStatus({ coupleId });

  unsubscribeMyJoinRequest = listenToMyJoinRequest(coupleId, activeUser.uid, async (request, error) => {
    if (error) return;
    if (!request) {
      stopWatchingMyJoinRequest();
      return;
    }
    if (request.status === "approved") {
      stopWatchingMyJoinRequest();
      try {
        await finishJoinRequest(activeUser.uid, coupleId, true);
        activeCoupleId = coupleId;
        ui.renderCoupleSettings(activeCoupleId);
        if (activeMode === "couple") subscribeToActiveCollection();
        ui.showToast("Seu pedido foi aprovado! Você entrou no espaço de casal.", "success");
      } catch (err) {
        console.error(err);
        ui.showToast("Pedido aprovado, mas não foi possível concluir a entrada. Recarregue a página.", "error");
      }
    } else if (request.status === "rejected") {
      stopWatchingMyJoinRequest();
      await finishJoinRequest(activeUser.uid, coupleId, false).catch(() => {});
      ui.showToast("O dono do espaço recusou o seu pedido de entrada.", "error");
    }
  });
}

/** Dono: acompanha em tempo real os pedidos de entrada no próprio espaço. */
function watchJoinRequestsToMySpace() {
  unsubscribeJoinRequests?.();
  let previousCount = null;
  unsubscribeJoinRequests = listenToJoinRequests(activeUser.uid, (requests, error) => {
    if (error) return;
    ui.renderJoinRequests(requests);
    if (previousCount !== null && requests.length > previousCount) {
      ui.showToast("Novo pedido de entrada no seu espaço de casal. Veja em Configurações.", "info");
    }
    previousCount = requests.length;
  });
}

function stopCoupleInviteListeners() {
  unsubscribeJoinRequests?.();
  unsubscribeJoinRequests = null;
  unsubscribeMyJoinRequest?.();
  unsubscribeMyJoinRequest = null;
  pendingJoinCoupleId = null;
  ui.renderJoinStatus(null);
  ui.renderJoinRequests([]);
}

/* -------------------- Carteira x Mercado -------------------- */
const INDICES_CACHE_KEY = "aportfy_market_indices";
const INDICES_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let indicesLoadedFrom = null; // data inicial das séries já carregadas nesta sessão
let indicesData = null; // as séries em si (a tela as perde ao trocar de modo e precisa recebê-las de novo)
let indicesLoading = false;

/** Busca CDI/IBOV/IFIX desde o primeiro aporte (com cache local de 6h) e entrega para a tela. */
async function refreshMarketIndices() {
  const firstFlow = latestInvestments
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

async function switchMode(mode) {
  if (mode === activeMode) return;
  activeMode = mode;
  ui.setActiveMode(mode);
  subscribeToActiveCollection();
}

/* ---------------------------------------------------------------
   Segurança da conta: e-mail confirmado e exclusão
--------------------------------------------------------------- */
async function checkEmailVerification({ announce = false } = {}) {
  try {
    const verified = await refreshEmailVerification();
    if (activeUser) ui.renderAccountSecurity(activeUser);
    if (announce) {
      ui.showToast(verified ? "E-mail confirmado! Tudo liberado." : "Ainda não consta como confirmado. Abra o link do e-mail e tente de novo.", verified ? "success" : "info");
    }
  } catch (err) {
    console.warn("Não foi possível conferir a verificação do e-mail:", err);
    if (announce) ui.showToast(translateAuthError(err), "error");
  }
}

function unsubscribeAll() {
  for (const stop of [unsubscribeTransactions, unsubscribeGoals, unsubscribeInvestments, unsubscribeDividends, unsubscribeBudgets, unsubscribePortfolioSettings, unsubscribeRecurrences]) {
    stop?.();
  }
  unsubscribeTransactions = unsubscribeGoals = unsubscribeInvestments = unsubscribeDividends = null;
  unsubscribeBudgets = unsubscribePortfolioSettings = unsubscribeRecurrences = null;
}

let deletingAccount = false;

async function deleteAccountFlow(password) {
  if (deletingAccount || !activeUser) return;
  deletingAccount = true;
  ui.setDeleteAccountBusy(true);
  try {
    await reauthenticate(password); // confirma a senha antes de apagar qualquer coisa
  } catch (err) {
    deletingAccount = false;
    ui.setDeleteAccountBusy(false);
    ui.showDeleteAccountError(err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" ? "Senha incorreta." : translateAuthError(err));
    return;
  }

  try {
    const uid = activeUser.uid;
    stopCoupleInviteListeners();
    unsubscribeAll();
    const { keptSharedSpace } = await deleteAccountData(uid);
    await deleteCurrentUser();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("aportfy_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* sem storage */
    }
    await clearLocalCache();
    ui.closeDeleteAccountModal();
    ui.showToast(keptSharedSpace ? "Conta excluída. O espaço de casal continua com o seu parceiro(a)." : "Conta e dados excluídos.", "info");
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    console.error(err);
    deletingAccount = false;
    ui.setDeleteAccountBusy(false);
    ui.showDeleteAccountError("Não foi possível concluir a exclusão. Tente de novo; se persistir, saia e entre na conta antes.");
    if (activeUser) subscribeToActiveCollection();
  }
}

/* ---------------------------------------------------------------
   Reação ao estado de autenticação
--------------------------------------------------------------- */
onAuthChange(async (user) => {
  if (user) {
    activeUser = user;
    activeMode = "personal";
    activeCoupleId = null;

    ui.showAppShell(user);
    ui.setActiveMode("personal");
    ui.setActiveView("dashboard");
    ui.renderProfileSettings(user);
    ui.renderAccountSecurity(user);
    // Quem confirmou o e-mail em outro aparelho/aba: relê o usuário para liberar o aviso e o token.
    if (!user.emailVerified) checkEmailVerification();

    try {
      await upsertUserProfile(user.uid, { email: user.email, lastLoginAt: new Date().toISOString() });
      activeCoupleId = await ensureCoupleId(user);
      ui.renderCoupleSettings(activeCoupleId);

      watchJoinRequestsToMySpace();
      const profile = await getUserProfile(user.uid);
      if (profile?.pendingCoupleId) watchMyJoinRequest(profile.pendingCoupleId);
    } catch (err) {
      console.warn("Não foi possível preparar o perfil/espaço de casal do usuário:", err);
    }

    subscribeToActiveCollection();
  } else {
    stopCoupleInviteListeners();
    activeUser = null;
    activeCoupleId = null;
    ui.updateOnboarding({ uid: null, ready: false });
    latestTransactions = [];
    latestGoals = [];
    latestInvestments = [];
    latestDividends = [];
    dividendsLoaded = false;
    sessionRegisteredKeys.clear();
    latestBudgets = [];
    latestRecurrences = [];
    unsubscribeAll();
    ui.showLoginScreen();
  }
});

/* ---------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initUIBindings();
});

/* -------------------- PWA: service worker -------------------- */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker não registrado:", err));
  });
}
