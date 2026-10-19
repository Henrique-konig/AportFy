// =========================================================
// AportFy — ui/core.js
// Referências do DOM, estado compartilhado entre telas, constantes, helpers, toasts, login e navegação.
// =========================================================

import { formatBRL } from "../format.js";

/* ---------------------------------------------------------------
   Estado compartilhado entre telas (lido e alterado pelos módulos)
--------------------------------------------------------------- */
export const state = {
  currentMode: "personal",
  isRegisterMode: false,
  lastTransactions: [],
  lastGoals: [],
  lastBudgets: [],
  pendingDeleteId: null,
  pendingDeleteType: "transaction",
  txnTypeFilter: "all",
  txnMonthFilterValue: "all",
  dashPeriodFilterValue: todayISO().slice(0, 7),
  reportsPeriodFilterValue: todayISO().slice(0, 7),
  txnVisibleCount: 100,
  lastInvestments: [],
  lastDividends: [],
  invAssetFilterValue: "all",
  divMonthFilterValue: "all",
  cashflowChart: null,
  categoryChart: null,
  reportsCashflowChart: null,
  reportsCategoryChart: null,
  invEvolutionChart: null,
  invContribChart: null,
  invAllocationChart: null,
  assetDetailChart: null,
  divChart: null,
  lastNewsPortfolio: [],
  lastNewsMarket: [],
  invTypeSort: "recent",
};

/* ---------------------------------------------------------------
   Referências de elementos
--------------------------------------------------------------- */
export const el = {
  // Telas
  loginScreen: document.getElementById("login-screen"),
  appShell: document.getElementById("app-shell"),

  // Auth
  authError: document.getElementById("auth-error"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  loginSubmitBtn: document.getElementById("login-submit-btn"),
  toggleAuthModeBtn: document.getElementById("toggle-auth-mode"),

  // Sidebar
  sidebar: document.getElementById("sidebar"),
  sidebarCollapseBtn: document.getElementById("sidebar-collapse-btn"),
  sidebarMobileCloseBtn: document.getElementById("sidebar-mobile-close-btn"),
  sidebarMobileBackdrop: document.getElementById("sidebar-mobile-backdrop"),
  mobileSidebarToggle: document.getElementById("mobile-sidebar-toggle"),
  navItems: document.querySelectorAll(".nav-item"),
  profileName: document.getElementById("profile-name"),
  profileEmail: document.getElementById("profile-email"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileFooter: document.getElementById("profile-footer"),
  logoutBtn: document.getElementById("logout-btn"),

  // Header
  searchInput: document.getElementById("search-input"),
  mobileSearchBtn: document.getElementById("mobile-search-btn"),
  mobileSearchRow: document.getElementById("mobile-search-row"),
  mobileSearchInput: document.getElementById("mobile-search-input"),
  modeToggle: document.getElementById("mode-toggle"),
  modeBtns: document.querySelectorAll(".mode-btn"),
  modeBadge: document.getElementById("mode-badge"),
  newTransactionBtn: document.getElementById("new-transaction-btn"),

  // Page header
  pageTitle: document.getElementById("page-title"),
  pageSubtitle: document.getElementById("page-subtitle"),
  viewSections: document.querySelectorAll(".view-section"),

  // Dashboard period filter
  dashboardPeriodFilter: document.getElementById("dashboard-period-filter"),

  // KPIs
  kpiBalance: document.getElementById("kpi-balance"),
  kpiBalanceLabel: document.getElementById("kpi-balance-label"),
  kpiBalanceChange: document.getElementById("kpi-balance-change"),
  kpiBalanceChangeRow: document.getElementById("kpi-balance-change-row"),
  kpiIncome: document.getElementById("kpi-income"),
  kpiIncomeLabel: document.getElementById("kpi-income-label"),
  kpiIncomeChange: document.getElementById("kpi-income-change"),
  kpiIncomeChangeRow: document.getElementById("kpi-income-change-row"),
  kpiExpense: document.getElementById("kpi-expense"),
  kpiExpenseLabel: document.getElementById("kpi-expense-label"),
  kpiExpenseChange: document.getElementById("kpi-expense-change"),
  kpiExpenseChangeRow: document.getElementById("kpi-expense-change-row"),
  kpiGoals: document.getElementById("kpi-goals"),
  kpiGoalsBar: document.getElementById("kpi-goals-bar"),

  // Dashboard charts
  cashflowCanvas: document.getElementById("cashflow-chart"),
  categoryCanvas: document.getElementById("category-chart"),
  categoryLegend: document.getElementById("category-legend"),

  // Dashboard preview table
  transactionsTbody: document.getElementById("transactions-tbody"),
  transactionsEmpty: document.getElementById("transactions-empty"),

  // Transactions view
  txnFilterBtns: document.querySelectorAll(".txn-filter-btn"),
  txnCategoryFilter: document.getElementById("txn-category-filter"),
  txnMonthFilter: document.getElementById("txn-month-filter"),
  transactionsFullTbody: document.getElementById("transactions-full-tbody"),
  transactionsFullEmpty: document.getElementById("transactions-full-empty"),
  txnFullCount: document.getElementById("txn-full-count"),
  txnFullTotal: document.getElementById("txn-full-total"),
  txnLoadMoreWrap: document.getElementById("txn-load-more-wrap"),
  txnLoadMoreBtn: document.getElementById("txn-load-more-btn"),
  txnLoadMoreRemaining: document.getElementById("txn-load-more-remaining"),

  // Goals view
  newGoalBtn: document.getElementById("new-goal-btn"),
  goalsGrid: document.getElementById("goals-grid"),
  goalsEmpty: document.getElementById("goals-empty"),

  // Budget view (Orçamento)
  newBudgetBtn: document.getElementById("new-budget-btn"),
  budgetGrid: document.getElementById("budget-grid"),
  budgetEmpty: document.getElementById("budget-empty"),
  budgetModal: document.getElementById("budget-modal"),
  budgetModalBackdrop: document.getElementById("budget-modal-backdrop"),
  budgetModalTitle: document.getElementById("budget-modal-title"),
  budgetModalCloseBtn: document.getElementById("budget-modal-close-btn"),
  budgetForm: document.getElementById("budget-form"),
  budgetCategory: document.getElementById("budget-category"),
  budgetLimit: document.getElementById("budget-limit"),

  // Reports view
  reportsPeriodFilter: document.getElementById("reports-period-filter"),
  reportTotalIncome: document.getElementById("report-total-income"),
  reportIncomePeriodLabel: document.getElementById("report-income-period-label"),
  reportTotalExpense: document.getElementById("report-total-expense"),
  reportExpensePeriodLabel: document.getElementById("report-expense-period-label"),
  reportNet: document.getElementById("report-net"),
  reportTopCategory: document.getElementById("report-top-category"),
  reportsCashflowCanvas: document.getElementById("reports-cashflow-chart"),
  reportsCategoryCanvas: document.getElementById("reports-category-chart"),
  reportTopExpenses: document.getElementById("report-top-expenses"),

  // Settings view
  settingsProfileForm: document.getElementById("settings-profile-form"),
  settingsNameInput: document.getElementById("settings-name-input"),
  settingsEmailDisplay: document.getElementById("settings-email-display"),
  settingsCoupleId: document.getElementById("settings-couple-id"),
  settingsCopyCoupleBtn: document.getElementById("settings-copy-couple-btn"),
  settingsJoinForm: document.getElementById("settings-join-form"),
  settingsJoinInput: document.getElementById("settings-join-input"),
  settingsJoinStatus: document.getElementById("settings-join-status"),
  settingsJoinRequests: document.getElementById("settings-join-requests"),
  settingsJoinRequestsList: document.getElementById("settings-join-requests-list"),
  settingsResetPasswordBtn: document.getElementById("settings-reset-password-btn"),
  settingsExportBackupBtn: document.getElementById("settings-export-backup-btn"),
  settingsImportBackupBtn: document.getElementById("settings-import-backup-btn"),
  settingsImportBackupInput: document.getElementById("settings-import-backup-input"),

  // Transaction modal
  transactionModal: document.getElementById("transaction-modal"),
  transactionModalBackdrop: document.getElementById("transaction-modal-backdrop"),
  modalTitle: document.getElementById("modal-title"),
  modalCloseBtn: document.getElementById("modal-close-btn"),
  transactionForm: document.getElementById("transaction-form"),
  transactionId: document.getElementById("transaction-id"),
  typeBtns: document.querySelectorAll(".type-btn"),
  transactionType: document.getElementById("transaction-type"),
  transactionDesc: document.getElementById("transaction-desc"),
  transactionAmount: document.getElementById("transaction-amount"),
  transactionDate: document.getElementById("transaction-date"),
  transactionCategory: document.getElementById("transaction-category"),
  transactionSubmitBtn: document.getElementById("transaction-submit-btn"),

  // Recurrence view (dentro de Transações) + modal
  newRecurrenceBtn: document.getElementById("new-recurrence-btn"),
  recurrencesList: document.getElementById("recurrences-list"),
  recurrencesEmpty: document.getElementById("recurrences-empty"),
  recurrenceModal: document.getElementById("recurrence-modal"),
  recurrenceModalBackdrop: document.getElementById("recurrence-modal-backdrop"),
  recurrenceModalTitle: document.getElementById("recurrence-modal-title"),
  recurrenceModalCloseBtn: document.getElementById("recurrence-modal-close-btn"),
  recurrenceForm: document.getElementById("recurrence-form"),
  recurrenceId: document.getElementById("recurrence-id"),
  recurrenceTypeBtns: document.querySelectorAll("#recurrence-form .type-btn"),
  recurrenceType: document.getElementById("recurrence-type"),
  recurrenceDesc: document.getElementById("recurrence-desc"),
  recurrenceAmount: document.getElementById("recurrence-amount"),
  recurrenceDay: document.getElementById("recurrence-day"),
  recurrenceCategory: document.getElementById("recurrence-category"),

  // Goal modal
  goalModal: document.getElementById("goal-modal"),
  goalModalBackdrop: document.getElementById("goal-modal-backdrop"),
  goalModalTitle: document.getElementById("goal-modal-title"),
  goalModalCloseBtn: document.getElementById("goal-modal-close-btn"),
  goalForm: document.getElementById("goal-form"),
  goalId: document.getElementById("goal-id"),
  goalName: document.getElementById("goal-name"),
  goalCurrent: document.getElementById("goal-current"),
  goalTarget: document.getElementById("goal-target"),
  goalDeadline: document.getElementById("goal-deadline"),

  // Delete modal (genérico)
  deleteModal: document.getElementById("delete-modal"),
  deleteModalBackdrop: document.getElementById("delete-modal-backdrop"),
  deleteModalTitle: document.getElementById("delete-modal-title"),
  deleteModalDesc: document.getElementById("delete-modal-desc"),
  deleteCancelBtn: document.getElementById("delete-cancel-btn"),
  deleteConfirmBtn: document.getElementById("delete-confirm-btn"),

  // Investments view (toolbar, KPIs, gráficos, tabela)
  invSearchInput: document.getElementById("inv-search-input"),
  invCategoryFilter: document.getElementById("inv-category-filter"),
  invSortSelect: document.getElementById("inv-sort-select"),
  invAssetFilter: document.getElementById("inv-asset-filter"),
  refreshQuotesBtn: document.getElementById("refresh-quotes-btn"),
  refreshQuotesIcon: document.getElementById("refresh-quotes-icon"),
  newInvestmentBtn: document.getElementById("new-investment-btn"),
  invKpiTotal: document.getElementById("inv-kpi-total"),
  invKpiProfit: document.getElementById("inv-kpi-profit"),
  invKpiProfitPct: document.getElementById("inv-kpi-profit-pct"),
  invKpiMonth: document.getElementById("inv-kpi-month"),
  invKpiBestTicker: document.getElementById("inv-kpi-best-ticker"),
  invKpiBestPct: document.getElementById("inv-kpi-best-pct"),
  invEvolutionCanvas: document.getElementById("inv-evolution-chart"),
  invEvolutionLegend: document.getElementById("inv-evolution-legend"),
  invContribCanvas: document.getElementById("inv-contrib-chart"),
  invContribTbody: document.getElementById("inv-contrib-tbody"),
  invContribTotal: document.getElementById("inv-contrib-total"),
  invContribAvg: document.getElementById("inv-contrib-avg"),
  invContribSubtitle: document.getElementById("inv-contrib-subtitle"),
  invAllocationCanvas: document.getElementById("inv-allocation-chart"),
  invAllocationLegend: document.getElementById("inv-allocation-legend"),
  investmentsTbody: document.getElementById("investments-tbody"),
  investmentsEmpty: document.getElementById("investments-empty"),
  invCount: document.getElementById("inv-count"),

  // Detalhe do ativo (reage ao filtro de ativo)
  assetDetailCard: document.getElementById("asset-detail-card"),
  assetDetailIcon: document.getElementById("asset-detail-icon"),
  assetDetailTicker: document.getElementById("asset-detail-ticker"),
  assetDetailCategory: document.getElementById("asset-detail-category"),
  assetDetailQty: document.getElementById("asset-detail-qty"),
  assetDetailAvg: document.getElementById("asset-detail-avg"),
  assetDetailTotal: document.getElementById("asset-detail-total"),
  assetDetailDividends: document.getElementById("asset-detail-dividends"),
  assetDetailCanvas: document.getElementById("asset-detail-chart"),
  assetDetailChartWrap: document.getElementById("asset-detail-chart-wrap"),
  assetDetailEmptyHint: document.getElementById("asset-detail-empty-hint"),

  // Proventos
  newDividendBtn: document.getElementById("new-dividend-btn"),
  importDividendsBtn: document.getElementById("import-dividends-btn"),
  importDividendsIcon: document.getElementById("import-dividends-icon"),
  divKpiTotal: document.getElementById("div-kpi-total"),
  divKpiYear: document.getElementById("div-kpi-year"),
  divKpiYearLabel: document.getElementById("div-kpi-year-label"),
  divKpi12m: document.getElementById("div-kpi-12m"),
  divKpiYield: document.getElementById("div-kpi-yield"),
  divMonthFilter: document.getElementById("div-month-filter"),
  divUpcomingTotal: document.getElementById("div-upcoming-total"),
  divPanelReceivedTotal: document.getElementById("div-panel-received-total"),
  divPanelMonthFilter: document.getElementById("div-panel-month-filter"),
  divPanelTabs: document.querySelectorAll(".div-tab-btn"),
  divPanelMoreWrap: document.getElementById("div-panel-more-wrap"),
  divPanelMoreBtn: document.getElementById("div-panel-more-btn"),
  divPanelMoreRemaining: document.getElementById("div-panel-more-remaining"),
  divUpcomingTbody: document.getElementById("div-upcoming-tbody"),
  divUpcomingStatus: document.getElementById("div-upcoming-status"),
  refreshUpcomingBtn: document.getElementById("refresh-upcoming-btn"),
  refreshUpcomingIcon: document.getElementById("refresh-upcoming-icon"),
  divChartCanvas: document.getElementById("div-chart"),
  dividendsTbody: document.getElementById("dividends-tbody"),
  dividendsEmpty: document.getElementById("dividends-empty"),
  divCount: document.getElementById("div-count"),

  // Modal: Registrar Provento
  dividendModal: document.getElementById("dividend-modal"),
  dividendModalBackdrop: document.getElementById("dividend-modal-backdrop"),
  dividendModalCloseBtn: document.getElementById("dividend-modal-close-btn"),
  dividendModalTitle: document.getElementById("dividend-modal-title"),
  dividendForm: document.getElementById("dividend-form"),
  dividendId: document.getElementById("dividend-id"),
  dividendTicker: document.getElementById("dividend-ticker"),
  dividendType: document.getElementById("dividend-type"),
  dividendAmount: document.getElementById("dividend-amount"),
  dividendDate: document.getElementById("dividend-date"),

  // Investment modal (novo ativo / editar ativo)
  investmentModal: document.getElementById("investment-modal"),
  investmentModalBackdrop: document.getElementById("investment-modal-backdrop"),
  investmentModalTitle: document.getElementById("investment-modal-title"),
  investmentModalCloseBtn: document.getElementById("investment-modal-close-btn"),
  investmentForm: document.getElementById("investment-form"),
  investmentId: document.getElementById("investment-id"),
  investmentTicker: document.getElementById("investment-ticker"),
  investmentCategory: document.getElementById("investment-category"),
  investmentDate: document.getElementById("investment-date"),
  investmentQuantity: document.getElementById("investment-quantity"),
  investmentPrice: document.getElementById("investment-price"),
  investmentFetchPriceBtn: document.getElementById("investment-fetch-price-btn"),
  investmentFetchPriceIcon: document.getElementById("investment-fetch-price-icon"),
  investmentPriceHint: document.getElementById("investment-price-hint"),
  investmentMergeHint: document.getElementById("investment-merge-hint"),
  investmentSubmitLabel: document.getElementById("investment-submit-label"),

  // Price edit modal (editar preço atual)
  priceEditModal: document.getElementById("price-edit-modal"),
  priceEditModalBackdrop: document.getElementById("price-edit-modal-backdrop"),
  priceEditModalCloseBtn: document.getElementById("price-edit-modal-close-btn"),
  priceEditForm: document.getElementById("price-edit-form"),
  priceEditId: document.getElementById("price-edit-id"),
  priceEditTickerDisplay: document.getElementById("price-edit-ticker-display"),
  priceEditValue: document.getElementById("price-edit-value"),

  // Toasts
  toastContainer: document.getElementById("toast-container"),

  // News view (sub-abas Minha Carteira / Mercado Diário)
  newsTabBtns: document.querySelectorAll(".news-tab-btn"),
  newsPanelPortfolio: document.getElementById("news-panel-portfolio"),
  newsPanelMarket: document.getElementById("news-panel-market"),
  newsPortfolioGrid: document.getElementById("news-portfolio-grid"),
  newsPortfolioEmpty: document.getElementById("news-portfolio-empty"),
  newsPortfolioEmptyTitle: document.getElementById("news-portfolio-empty-title"),
  newsPortfolioEmptyDesc: document.getElementById("news-portfolio-empty-desc"),
  newsMarketGrid: document.getElementById("news-market-grid"),
  newsMarketEmpty: document.getElementById("news-market-empty"),
  newsMarketEmptyTitle: document.getElementById("news-market-empty-title"),
  newsMarketEmptyDesc: document.getElementById("news-market-empty-desc"),
};

/* ---------------------------------------------------------------
   Estado interno do módulo
--------------------------------------------------------------- */
export const TXN_PAGE_SIZE = 100;

export const CATEGORY_COLORS = {
  "Salário": "#3b82f6",
  "Freelance": "#22d3ee",
  "Investimentos": "#34d399",
  "Alimentação": "#f97316",
  "Transporte": "#eab308",
  "Moradia": "#f43f5e",
  "Lazer": "#a855f7",
  "Saúde": "#ec4899",
  "Educação": "#6366f1",
  "Outros": "#64748b",
};

export const INVESTMENT_CATEGORY_COLORS = {
  "Ações": "#3b82f6",
  "FIIs": "#f97316",
  "Renda Fixa": "#34d399",
  "Criptomoedas": "#eab308",
  "Tesouro": "#6366f1",
  "Imóveis": "#ec4899",
  "Outros": "#64748b",
};

export const B3_CATEGORIES = ["Ações", "FIIs"];

// Categorias com cotação automática (B3 via Brapi; cripto via Binance/CoinGecko).
export const AUTO_QUOTE_CATEGORIES = [...B3_CATEGORIES, "Criptomoedas"];

export const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Visão geral das suas finanças" },
  transactions: { title: "Transações", subtitle: "Histórico completo de receitas e despesas" },
  goals: { title: "Metas", subtitle: "Acompanhe o progresso dos seus objetivos financeiros" },
  budget: { title: "Orçamento", subtitle: "Acompanhe seus limites de gasto por categoria" },
  bills: { title: "Contas e Cartões", subtitle: "Contas a pagar, cartões de crédito e faturas" },
  investments: { title: "Investimentos", subtitle: "Acompanhe o rendimento da sua carteira de ativos" },
  history: { title: "Histórico", subtitle: "Compras, vendas e proventos dos seus investimentos" },
  news: { title: "Notícias", subtitle: "Fique por dentro do mercado e dos ativos da sua carteira" },
  reports: { title: "Relatórios", subtitle: "Análise detalhada do seu fluxo de caixa" },
  health: { title: "Saúde da Carteira", subtitle: "Diagnóstico, projeção e onde aportar na sua carteira" },
  settings: { title: "Configurações", subtitle: "Preferências da sua conta AportFy" },
};

export const DELETE_META = {
  transaction: { title: "Excluir transação?", desc: "Essa ação não pode ser desfeita. Deseja continuar?" },
  goal: { title: "Excluir meta?", desc: "O progresso dessa meta será perdido. Deseja continuar?" },
  investment: { title: "Excluir ativo?", desc: "O histórico dessa posição será perdido. Deseja continuar?" },
  dividend: { title: "Excluir provento?", desc: "Esse registro não pode ser recuperado. Deseja continuar?" },
  budget: { title: "Excluir orçamento?", desc: "O limite definido para essa categoria será removido. Você pode recriar depois se quiser." },
  recurrence: { title: "Excluir recorrência?", desc: "Deixa de ser lançada automaticamente. As transações já geradas continuam existindo." },
  bill: { title: "Excluir conta?", desc: "A conta sai da lista. Se já foi paga, a despesa lançada nas transações continua." },
  purchase: { title: "Excluir compra?", desc: "Todas as parcelas dessa compra saem das faturas. Despesas de faturas já pagas continuam nas transações." },
  card: { title: "Excluir cartão?", desc: "O cartão, as compras e os registros de fatura dele serão apagados. Despesas de faturas já pagas continuam nas transações." },
};

export const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Outros"];

export const DIVIDEND_TYPE_COLORS = {
  "Dividendo": "#3b82f6",
  "JCP": "#a855f7",
  "Rendimento": "#f97316",
  "Outro": "#64748b",
};

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
const delegatedClicks = new WeakMap();

/**
 * Um único ouvinte de clique por lista, em vez de um por botão a cada vez que a lista é redesenhada
 * (uma lista de 600 proventos criava 1.200 ouvintes por redesenho). O `handler` mais recente vale,
 * então ele pode usar os dados atuais da lista. Chame a cada redesenho: só o primeiro liga o ouvinte.
 * @param {Element} container lista que contém os botões
 * @param {string} selector seletor do botão (ex: ".edit-row-btn")
 * @param {(button: Element) => void} handler
 */
export function delegateClick(container, selector, handler) {
  if (!container) return;
  let handlers = delegatedClicks.get(container);
  if (!handlers) {
    handlers = new Map();
    delegatedClicks.set(container, handlers);
    container.addEventListener("click", (e) => {
      for (const [sel, fn] of handlers) {
        const button = e.target.closest?.(sel);
        if (button && container.contains(button)) {
          fn(button);
          return;
        }
      }
    });
  }
  handlers.set(selector, handler);
}

/**
 * Classe de entrada (fade) das linhas de uma lista: só na primeira vez que ela aparece. Nos redesenhos
 * seguintes (dados em tempo real, filtros, "carregar mais") as linhas já estão na tela, e refazer o fade
 * de todas a cada atualização fazia a lista inteira piscar.
 */
export const fadeInClass = (container) => (container && container.childElementCount > 0 ? "" : "animate-fade-in");

export function formatCurrency(value) {
  // Modo privacidade (botão do olho no cabeçalho): nenhum valor em reais aparece.
  if (document.documentElement.classList.contains("privacy-on")) return "R$ •••••";
  return formatBRL(value);
}

export function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function getModeColor(mode = state.currentMode) {
  return mode === "couple" ? "#a855f7" : "#3b82f6";
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------------------------------------------------------
   Toasts
--------------------------------------------------------------- */
export function showToast(message, type = "success") {
  const icons = {
    success: "ph-fill ph-check-circle text-emerald-400",
    error: "ph-fill ph-x-circle text-red-400",
    info: "ph-fill ph-info text-blue-400",
  };
  const toast = document.createElement("div");
  toast.className =
    "animate-toast-in glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 text-sm font-medium min-w-[260px] shadow-2xl";
  toast.innerHTML = `<i class="${icons[type] || icons.info} text-lg shrink-0"></i><span>${escapeHtml(message)}</span>`;
  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(24px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------------------------------------------------------------
   Telas de Autenticação
--------------------------------------------------------------- */
export function showLoginScreen() {
  el.loginScreen.classList.remove("hidden");
  el.appShell.classList.add("hidden");
}

export function showAppShell(user) {
  el.loginScreen.classList.add("hidden");
  el.appShell.classList.remove("hidden");

  const name = user.displayName || user.email.split("@")[0];
  el.profileName.textContent = name;
  el.profileEmail.textContent = user.email;
  el.profileAvatar.textContent = name.charAt(0).toUpperCase();
}

export function showAuthError(message) {
  el.authError.textContent = message;
  el.authError.classList.remove("hidden");
}

export function clearAuthError() {
  el.authError.classList.add("hidden");
  el.authError.textContent = "";
}

export function setAuthLoading(loading) {
  el.loginSubmitBtn.disabled = loading;
  el.loginSubmitBtn.classList.toggle("opacity-60", loading);
  const label = el.loginSubmitBtn.querySelector(".btn-label");
  label.textContent = loading ? "Aguarde..." : state.isRegisterMode ? "Criar conta" : "Entrar";
}

export function toggleAuthMode() {
  state.isRegisterMode = !state.isRegisterMode;
  const label = el.loginSubmitBtn.querySelector(".btn-label");
  label.textContent = state.isRegisterMode ? "Criar conta" : "Entrar";
  el.toggleAuthModeBtn.innerHTML = state.isRegisterMode
    ? `Já tem uma conta? <span class="text-blue-400 font-semibold">Entrar</span>`
    : `Não tem uma conta? <span class="text-blue-400 font-semibold">Criar conta</span>`;
  // Cadastro: senha nova e regra visível. Login: sem regra (contas antigas podem ter senha curta).
  const hint = document.getElementById("password-hint");
  hint?.classList.toggle("hidden", !state.isRegisterMode);
  el.loginPassword.setAttribute("autocomplete", state.isRegisterMode ? "new-password" : "current-password");
  clearAuthError();
}

export function getIsRegisterMode() {
  return state.isRegisterMode;
}

/* ---------------------------------------------------------------
   Sidebar / Navegação
--------------------------------------------------------------- */
export function openMobileSidebar() {
  el.sidebar.classList.add("mobile-open");
  el.sidebarMobileBackdrop.classList.remove("hidden");
}

export function closeMobileSidebar() {
  el.sidebar.classList.remove("mobile-open");
  el.sidebarMobileBackdrop.classList.add("hidden");
}

export function bindSidebarToggle() {
  el.sidebarCollapseBtn.addEventListener("click", () => {
    el.sidebar.classList.toggle("collapsed");
  });

  el.mobileSidebarToggle?.addEventListener("click", () => openMobileSidebar());
  el.sidebarMobileCloseBtn?.addEventListener("click", () => closeMobileSidebar());
  el.sidebarMobileBackdrop?.addEventListener("click", () => closeMobileSidebar());
}

export function setActiveView(view) {
  el.navItems.forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active-nav", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  el.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.id !== `view-${view}`);
  });

  const meta = VIEW_META[view] || VIEW_META.dashboard;
  el.pageTitle.textContent = meta.title;
  el.pageSubtitle.textContent = state.currentMode === "couple" ? `${meta.subtitle} do casal` : meta.subtitle;

  closeMobileSidebar();
}

export function getActiveView() {
  return document.querySelector(".nav-item.active-nav")?.dataset.view || "dashboard";
}

export function onNavChange(handler) {
  el.navItems.forEach((btn) => {
    btn.addEventListener("click", () => handler(btn.dataset.view));
  });
  document.querySelectorAll(".nav-item-link").forEach((btn) => {
    btn.addEventListener("click", () => handler(btn.dataset.view));
  });
  el.profileFooter?.addEventListener("click", () => handler(el.profileFooter.dataset.view));
}

export function onLogoutClick(handler) {
  el.logoutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handler();
  });
}

