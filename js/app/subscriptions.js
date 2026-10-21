// =========================================================
// AportFy — app/subscriptions.js
// Assinaturas do Firestore (modo Pessoal/Casal), redesenho e recorrências.
// =========================================================

import * as ui from "../ui.js";
import { recurrenceDateForMonth } from "../calc.js";
import { addTransaction, listenToBudgets, listenToDividends, listenToGoals, listenToInvestments, listenToPortfolioSettings, listenToRecurrences, listenToTransactions, updateRecurrence } from "../db.js";
import { stopExtras, subscribeExtras } from "./bills-actions.js";
import { refreshUpcomingDividends } from "./dividend-sync.js";
import { refreshMarketIndices } from "./quotes.js";
import { gate, session } from "./session.js";

let unsubscribeTransactions = null;
let unsubscribeGoals = null;
let unsubscribeInvestments = null;
let unsubscribeDividends = null;
let unsubscribeBudgets = null;
let unsubscribePortfolioSettings = null;
let unsubscribeRecurrences = null;
let recurrencesProcessing = false;

/* ---------------------------------------------------------------
   Assinatura de dados (Firestore) de acordo com o modo ativo
--------------------------------------------------------------- */
export function refreshDashboard() {
  ui.updateKPIs(session.latestTransactions, session.latestGoals);
  ui.renderTransactionsTable(session.latestTransactions);
  ui.renderFullTransactionsTable(session.latestTransactions);
  ui.updateCharts(session.latestTransactions);
  ui.renderReports(session.latestTransactions);
  ui.renderBudgets(session.latestBudgets, session.latestTransactions);
}

/**
 * Gera a transação do mês atual pra cada recorrência que ainda não foi
 * lançada nesse mês (lastGeneratedMonth != mês atual). Roda toda vez que
 * a lista de recorrências chega do Firestore — é seguro rodar de novo
 * porque cada recorrência só é processada uma vez por mês (marcada logo
 * após a escrita), e a flag local evita reentrância se dois snapshots
 * chegarem em sequência rápida.
 */
export async function processRecurrences(recurrences) {
  if (recurrencesProcessing || recurrences.length === 0) return;
  recurrencesProcessing = true;

  try {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;

    for (const r of recurrences) {
      if (r.lastGeneratedMonth === currentMonthKey) continue;

      const date = recurrenceDateForMonth(now.getFullYear(), now.getMonth(), r.dayOfMonth);

      try {
        await addTransaction(session.activeMode, id, {
          description: r.description,
          amount: r.amount,
          type: r.type,
          category: r.category,
          date,
        });
        await updateRecurrence(session.activeMode, id, r.id, { lastGeneratedMonth: currentMonthKey });
      } catch (err) {
        console.error(`Erro ao gerar transação recorrente de "${r.description}":`, err);
      }
    }
  } finally {
    recurrencesProcessing = false;
  }
}

export function subscribeToActiveCollection() {
  stopExtras();
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
  session.dividendsLoaded = false;
  session.registeredKeys.clear();
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

  const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
  if (!id) return;
  subscribeExtras(id);

  // Primeiros passos: só no espaço pessoal e depois que transações e investimentos chegaram.
  const onboardingUid = session.activeMode === "personal" ? session.activeUser.uid : null;
  const loadedForOnboarding = { transactions: false, investments: false };
  const syncOnboarding = (key) => {
    loadedForOnboarding[key] = true;
    ui.updateOnboarding({ uid: onboardingUid, ready: loadedForOnboarding.transactions && loadedForOnboarding.investments });
  };
  ui.updateOnboarding({ uid: onboardingUid, ready: false });

  unsubscribeTransactions = listenToTransactions(session.activeMode, id, gate((transactions, error) => {
    if (error) {
      ui.showToast("Erro ao carregar transações em tempo real.", "error");
      return;
    }
    session.latestTransactions = transactions;
    refreshDashboard();
    syncOnboarding("transactions");
  }));

  unsubscribeGoals = listenToGoals(session.activeMode, id, gate((goals, error) => {
    if (error) {
      ui.showToast("Erro ao carregar metas em tempo real.", "error");
      return;
    }
    session.latestGoals = goals;
    ui.renderGoals(goals);
    ui.updateKPIs(session.latestTransactions, session.latestGoals);
  }));

  unsubscribeInvestments = listenToInvestments(session.activeMode, id, gate((investments, error) => {
    if (error) {
      ui.showToast("Erro ao carregar investimentos em tempo real.", "error");
      return;
    }
    session.latestInvestments = investments;
    ui.renderInvestments(investments);
    refreshUpcomingDividends();
    refreshMarketIndices();
    syncOnboarding("investments");
  }));

  unsubscribeDividends = listenToDividends(session.activeMode, id, gate((dividends, error, meta) => {
    if (error) {
      ui.showToast("Erro ao carregar proventos em tempo real.", "error");
      return;
    }
    // A importação automática só confia na lista confirmada pelo servidor (o cache local
    // pode não ter proventos lançados por outro aparelho, o que geraria duplicados).
    const firstLoad = !session.dividendsLoaded && !meta?.fromCache;
    session.latestDividends = dividends;
    if (!meta?.fromCache) session.dividendsLoaded = true;
    ui.renderDividendsData(dividends);
    if (firstLoad) refreshUpcomingDividends();
  }));

  unsubscribePortfolioSettings = listenToPortfolioSettings(session.activeMode, id, (settings, error) => {
    if (error) {
      ui.showToast("Erro ao carregar as metas da carteira.", "error");
      return;
    }
    ui.setPortfolioSettings(settings);
  });

  unsubscribeBudgets = listenToBudgets(session.activeMode, id, gate((budgets, error) => {
    if (error) {
      ui.showToast("Erro ao carregar orçamentos em tempo real.", "error");
      return;
    }
    session.latestBudgets = budgets;
    ui.renderBudgets(session.latestBudgets, session.latestTransactions);
  }));

  unsubscribeRecurrences = listenToRecurrences(session.activeMode, id, gate((recurrences, error, meta) => {
    if (error) {
      ui.showToast("Erro ao carregar recorrências em tempo real.", "error");
      return;
    }
    session.latestRecurrences = recurrences;
    ui.renderRecurrences(recurrences);
    ui.setPlanningData({ recurrences });
    // Lançar recorrências com dado do cache local poderia duplicar o que outro aparelho já lançou.
    if (!meta?.fromCache) processRecurrences(recurrences);
  }));
}

export async function switchMode(mode) {
  if (mode === session.activeMode) return;
  session.activeMode = mode;
  ui.setActiveMode(mode);
  subscribeToActiveCollection();
}

export function unsubscribeAll() {
  stopExtras();
  for (const stop of [unsubscribeTransactions, unsubscribeGoals, unsubscribeInvestments, unsubscribeDividends, unsubscribeBudgets, unsubscribePortfolioSettings, unsubscribeRecurrences]) {
    stop?.();
  }
  unsubscribeTransactions = unsubscribeGoals = unsubscribeInvestments = unsubscribeDividends = null;
  unsubscribeBudgets = unsubscribePortfolioSettings = unsubscribeRecurrences = null;
}

/* ---------------------------------------------------------------
   Modo privacidade: redesenha tudo com os valores (des)mascarados
--------------------------------------------------------------- */
export function rerenderAll() {
  refreshDashboard();
  ui.renderGoals(session.latestGoals);
  ui.renderRecurrences(session.latestRecurrences);
  ui.renderInvestments(session.latestInvestments);
  ui.renderDividendsData(session.latestDividends);
  ui.renderBillsData({});
  refreshUpcomingDividends();
}

/* ---------------------------------------------------------------
   Link direto para uma aba (ex: notificação abre /?view=bills)
--------------------------------------------------------------- */
export function openViewFromUrl() {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  if (view && ui.VIEW_META[view]) ui.setActiveView(view);
  if (view) history.replaceState(null, "", location.pathname);
}
