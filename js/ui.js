// =========================================================
// AportFy — ui.js
// Manipulação do DOM, modais, toasts, gráficos (Chart.js)
// e alternância visual entre os modos Pessoal / Casal.
//
// Este módulo não conhece Firebase: ele apenas renderiza dados
// recebidos e expõe callbacks (padrão pub/sub) para que app.js
// conecte as ações de UI às operações reais (auth.js / db.js).
// =========================================================

import { attachDatePicker, setDatePickerValue, closeDatePicker } from "./datepicker.js";
import { enhanceSelect, refreshDropdown } from "./dropdown.js";
import { calcInvestmentMetrics, pctChange, buildMonthlySeries, calcBudgetSpent, buildMonthlyContributions } from "./calc.js";

/* ---------------------------------------------------------------
   Referências de elementos
--------------------------------------------------------------- */
const el = {
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
let currentMode = "personal";
let isRegisterMode = false;
let lastTransactions = [];
let lastGoals = [];
let lastBudgets = [];
let pendingDeleteId = null;
let pendingDeleteType = "transaction";
let txnTypeFilter = "all";
let txnMonthFilterValue = "all";
let dashPeriodFilterValue = todayISO().slice(0, 7);
let reportsPeriodFilterValue = todayISO().slice(0, 7);
let txnVisibleCount = 100;
const TXN_PAGE_SIZE = 100;
let lastInvestments = [];
let lastDividends = [];
let invAssetFilterValue = "all";
let divMonthFilterValue = "all";
let cashflowChart = null;
let categoryChart = null;
let reportsCashflowChart = null;
let reportsCategoryChart = null;
let invEvolutionChart = null;
let invContribChart = null;
let invAllocationChart = null;
let assetDetailChart = null;
let divChart = null;
let lastNewsPortfolio = [];
let lastNewsMarket = [];

const CATEGORY_COLORS = {
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

const INVESTMENT_CATEGORY_COLORS = {
  "Ações": "#3b82f6",
  "FIIs": "#f97316",
  "Renda Fixa": "#34d399",
  "Criptomoedas": "#eab308",
  "Tesouro": "#6366f1",
  "Imóveis": "#ec4899",
  "Outros": "#64748b",
};

const B3_CATEGORIES = ["Ações", "FIIs"];

const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Visão geral das suas finanças" },
  transactions: { title: "Transações", subtitle: "Histórico completo de receitas e despesas" },
  goals: { title: "Metas", subtitle: "Acompanhe o progresso dos seus objetivos financeiros" },
  budget: { title: "Orçamento", subtitle: "Acompanhe seus limites de gasto por categoria" },
  investments: { title: "Investimentos", subtitle: "Acompanhe o rendimento da sua carteira de ativos" },
  news: { title: "Notícias", subtitle: "Fique por dentro do mercado e dos ativos da sua carteira" },
  reports: { title: "Relatórios", subtitle: "Análise detalhada do seu fluxo de caixa" },
  settings: { title: "Configurações", subtitle: "Preferências da sua conta AportFy" },
};

const DELETE_META = {
  transaction: { title: "Excluir transação?", desc: "Essa ação não pode ser desfeita. Deseja continuar?" },
  goal: { title: "Excluir meta?", desc: "O progresso dessa meta será perdido. Deseja continuar?" },
  investment: { title: "Excluir ativo?", desc: "O histórico dessa posição será perdido. Deseja continuar?" },
  dividend: { title: "Excluir provento?", desc: "Esse registro não pode ser recuperado. Deseja continuar?" },
  budget: { title: "Excluir orçamento?", desc: "O limite definido para essa categoria será removido. Você pode recriar depois se quiser." },
  recurrence: { title: "Excluir recorrência?", desc: "Deixa de ser lançada automaticamente. As transações já geradas continuam existindo." },
};

const EXPENSE_CATEGORIES = ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Outros"];

const DIVIDEND_TYPE_COLORS = {
  "Dividendo": "#3b82f6",
  "JCP": "#a855f7",
  "Rendimento": "#f97316",
  "Outro": "#64748b",
};

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function getModeColor(mode = currentMode) {
  return mode === "couple" ? "#a855f7" : "#3b82f6";
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function escapeHtml(str) {
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
  label.textContent = loading ? "Aguarde..." : isRegisterMode ? "Criar conta" : "Entrar";
}

export function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  const label = el.loginSubmitBtn.querySelector(".btn-label");
  label.textContent = isRegisterMode ? "Criar conta" : "Entrar";
  el.toggleAuthModeBtn.innerHTML = isRegisterMode
    ? `Já tem uma conta? <span class="text-blue-400 font-semibold">Entrar</span>`
    : `Não tem uma conta? <span class="text-blue-400 font-semibold">Criar conta</span>`;
  clearAuthError();
}

export function getIsRegisterMode() {
  return isRegisterMode;
}

/* ---------------------------------------------------------------
   Sidebar / Navegação
--------------------------------------------------------------- */
function openMobileSidebar() {
  el.sidebar.classList.add("mobile-open");
  el.sidebarMobileBackdrop.classList.remove("hidden");
}

function closeMobileSidebar() {
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
    btn.classList.toggle("active-nav", btn.dataset.view === view);
  });

  el.viewSections.forEach((section) => {
    section.classList.toggle("hidden", section.id !== `view-${view}`);
  });

  const meta = VIEW_META[view] || VIEW_META.dashboard;
  el.pageTitle.textContent = meta.title;
  el.pageSubtitle.textContent = currentMode === "couple" ? `${meta.subtitle} do casal` : meta.subtitle;

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

/* ---------------------------------------------------------------
   Alternância de Modo (Pessoal / Casal)
--------------------------------------------------------------- */
export function setActiveMode(mode) {
  currentMode = mode;
  document.body.classList.toggle("mode-couple", mode === "couple");

  el.modeBtns.forEach((btn) => {
    btn.classList.toggle("active-mode", btn.dataset.mode === mode);
  });

  if (mode === "couple") {
    el.modeBadge.innerHTML = `<i class="ph-fill ph-heart"></i> Modo Casal`;
    el.modeBadge.classList.remove("bg-blue-500/10", "border-blue-500/30", "text-blue-400");
  } else {
    el.modeBadge.innerHTML = `<i class="ph-fill ph-user"></i> Modo Pessoal`;
    el.modeBadge.classList.add("bg-blue-500/10", "border-blue-500/30", "text-blue-400");
  }

  setActiveView(getActiveView());

  // Re-renderiza gráficos e cards com a cor do novo modo
  updateCharts(lastTransactions);
  renderGoals(lastGoals);
  renderBudgets(lastBudgets, lastTransactions);
  renderInvestments(lastInvestments);
  renderNewsCards("portfolio", lastNewsPortfolio);
  renderNewsCards("market", lastNewsMarket);
}

export function onModeToggle(handler) {
  el.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => handler(btn.dataset.mode));
  });
}

export function getCurrentMode() {
  return currentMode;
}

/* ---------------------------------------------------------------
   KPIs
--------------------------------------------------------------- */
function renderChangeBadge(elNode, pct, invert = false) {
  const positive = invert ? pct <= 0 : pct >= 0;
  elNode.classList.toggle("text-emerald-400", positive);
  elNode.classList.toggle("text-red-400", !positive);
  const icon = pct >= 0 ? "ph-arrow-up" : "ph-arrow-down";
  elNode.innerHTML = `<i class="ph-bold ${icon}"></i> ${Math.abs(pct).toFixed(1)}%`;
}

function dashPeriodDate() {
  if (dashPeriodFilterValue === "all") return new Date();
  const [y, m] = dashPeriodFilterValue.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Repopula o filtro de período do dashboard com "Todos os meses" + o mês atual + os meses com transações. */
function populateDashboardPeriodFilter(transactions) {
  if (!el.dashboardPeriodFilter) return;
  const currentMonth = todayISO().slice(0, 7);
  const months = [...new Set([currentMonth, ...transactions.map((t) => t.date.slice(0, 7))])].sort().reverse();
  const current = el.dashboardPeriodFilter.value || dashPeriodFilterValue;

  el.dashboardPeriodFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.dashboardPeriodFilter.value = current === "all" || months.includes(current) ? current : currentMonth;
  dashPeriodFilterValue = el.dashboardPeriodFilter.value;
  refreshDropdown("dashboard-period-filter");
}

export function bindDashboardFilters() {
  el.dashboardPeriodFilter?.addEventListener("change", () => {
    dashPeriodFilterValue = el.dashboardPeriodFilter.value;
    updateKPIs(lastTransactions, lastGoals);
    updateCharts(lastTransactions);
  });
}

export function updateKPIs(transactions, goals = []) {
  lastGoals = goals;
  populateDashboardPeriodFilter(transactions);

  const isAllPeriod = dashPeriodFilterValue === "all";
  const periodDate = dashPeriodDate();
  const thisMonth = periodDate.getMonth();
  const thisYear = periodDate.getFullYear();
  const prevDate = new Date(thisYear, thisMonth - 1, 1);

  let currentIncome = 0, currentExpense = 0, prevIncome = 0, prevExpense = 0, totalBalance = 0;

  transactions.forEach((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    const amount = Number(t.amount) || 0;
    const signedAmount = t.type === "income" ? amount : -amount;
    totalBalance += signedAmount;

    if (isAllPeriod || (d.getFullYear() === thisYear && d.getMonth() === thisMonth)) {
      if (t.type === "income") currentIncome += amount;
      else currentExpense += amount;
    } else if (d.getFullYear() === prevDate.getFullYear() && d.getMonth() === prevDate.getMonth()) {
      if (t.type === "income") prevIncome += amount;
      else prevExpense += amount;
    }
  });

  const currBalance = currentIncome - currentExpense;

  el.kpiBalance.textContent = formatCurrency(isAllPeriod ? totalBalance : currBalance);
  el.kpiIncome.textContent = formatCurrency(currentIncome);
  el.kpiExpense.textContent = formatCurrency(currentExpense);
  el.kpiBalanceLabel.textContent = isAllPeriod ? "Saldo Atual" : "Saldo do Mês";
  el.kpiIncomeLabel.textContent = isAllPeriod ? "Receitas Totais" : "Receitas do Mês";
  el.kpiExpenseLabel.textContent = isAllPeriod ? "Despesas Totais" : "Despesas do Mês";

  el.kpiBalanceChangeRow.classList.toggle("hidden", isAllPeriod);
  el.kpiIncomeChangeRow.classList.toggle("hidden", isAllPeriod);
  el.kpiExpenseChangeRow.classList.toggle("hidden", isAllPeriod);

  if (!isAllPeriod) {
    const prevBalance = prevIncome - prevExpense;
    renderChangeBadge(el.kpiBalanceChange, pctChange(currBalance, prevBalance));
    renderChangeBadge(el.kpiIncomeChange, pctChange(currentIncome, prevIncome));
    renderChangeBadge(el.kpiExpenseChange, pctChange(currentExpense, prevExpense), true);
  }

  let goalsProgress;
  if (goals.length > 0) {
    const avg =
      goals.reduce((sum, g) => {
        const target = Number(g.targetAmount) || 0;
        const current = Number(g.currentAmount) || 0;
        const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        return sum + pct;
      }, 0) / goals.length;
    goalsProgress = avg;
  } else {
    // Sem metas cadastradas: usa a taxa de poupança do mês como indicador
    goalsProgress = currentIncome > 0 ? Math.max(0, Math.min(100, ((currentIncome - currentExpense) / currentIncome) * 100)) : 0;
  }

  el.kpiGoals.textContent = `${goalsProgress.toFixed(0)}%`;
  el.kpiGoalsBar.style.width = `${goalsProgress}%`;
}

/* ---------------------------------------------------------------
   Tabela de Transações (Dashboard + view completa)
--------------------------------------------------------------- */
let editHandler = null;
let deleteHandler = null;

export function onEditTransaction(handler) {
  editHandler = handler;
}

export function onDeleteTransaction(handler) {
  deleteHandler = handler;
}

function buildRowHtml(t) {
  const color = CATEGORY_COLORS[t.category] || CATEGORY_COLORS["Outros"];
  const isIncome = t.type === "income";
  const amountLabel = `${isIncome ? "+" : "-"} ${formatCurrency(Math.abs(Number(t.amount) || 0))}`;
  return `
    <tr class="animate-fade-in" data-id="${t.id}">
      <td class="px-5 sm:px-6 py-4 font-medium">
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background:${color}22;">
            <i class="ph-bold ${isIncome ? "ph-arrow-down-left" : "ph-arrow-up-right"}" style="color:${color};"></i>
          </span>
          <span class="truncate max-w-[180px] sm:max-w-xs">${escapeHtml(t.description)}</span>
        </div>
      </td>
      <td class="px-5 sm:px-6 py-4">
        <span class="category-badge">
          <span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>
          ${escapeHtml(t.category)}
        </span>
      </td>
      <td class="px-5 sm:px-6 py-4 text-slate-400">${formatDate(t.date)}</td>
      <td class="px-5 sm:px-6 py-4 text-right font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}">${amountLabel}</td>
      <td class="px-5 sm:px-6 py-4">
        <div class="flex items-center justify-end gap-1.5">
          <button class="row-action-btn edit-row-btn" data-id="${t.id}" title="Editar">
            <i class="ph-bold ph-pencil-simple"></i>
          </button>
          <button class="row-action-btn delete-btn delete-row-btn" data-id="${t.id}" title="Excluir">
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

function wireRowActions(tbody, transactions) {
  tbody.querySelectorAll(".edit-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = transactions.find((tr) => tr.id === btn.dataset.id);
      if (t && editHandler) editHandler(t);
    });
  });
  tbody.querySelectorAll(".delete-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "transaction"));
  });
}

function getSearchTerm() {
  return (el.searchInput.value || el.mobileSearchInput?.value || "").toLowerCase().trim();
}

export function renderTransactionsTable(transactions) {
  lastTransactions = transactions;
  const term = getSearchTerm();
  const filtered = term
    ? transactions.filter(
        (t) => t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term)
      )
    : transactions;

  if (filtered.length === 0) {
    el.transactionsTbody.innerHTML = "";
    el.transactionsEmpty.classList.remove("hidden");
    el.transactionsEmpty.classList.add("flex");
    return;
  }

  el.transactionsEmpty.classList.add("hidden");
  el.transactionsEmpty.classList.remove("flex");

  const rows = filtered.slice(0, 5);
  el.transactionsTbody.innerHTML = rows.map(buildRowHtml).join("");
  wireRowActions(el.transactionsTbody, transactions);
}

/** Repopula o filtro de mês com os meses realmente presentes nas transações. */
function populateTransactionMonthFilter(transactions) {
  if (!el.txnMonthFilter) return;
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const current = el.txnMonthFilter.value;

  el.txnMonthFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.txnMonthFilter.value = months.includes(current) ? current : "all";
  txnMonthFilterValue = el.txnMonthFilter.value;
  refreshDropdown("txn-month-filter");
}

export function renderFullTransactionsTable(transactions) {
  lastTransactions = transactions;
  populateTransactionMonthFilter(transactions);

  const term = getSearchTerm();
  const categoryFilter = el.txnCategoryFilter?.value || "all";

  let filtered = transactions;
  if (txnTypeFilter !== "all") filtered = filtered.filter((t) => t.type === txnTypeFilter);
  if (txnMonthFilterValue !== "all") filtered = filtered.filter((t) => t.date.slice(0, 7) === txnMonthFilterValue);
  if (categoryFilter !== "all") filtered = filtered.filter((t) => t.category === categoryFilter);
  if (term) {
    filtered = filtered.filter(
      (t) => t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term)
    );
  }

  el.txnFullCount.textContent = `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`;
  if (el.txnFullTotal) {
    const totalSpent = filtered.filter((t) => t.type === "expense").reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    el.txnFullTotal.textContent = totalSpent > 0 ? `Gasto: ${formatCurrency(totalSpent)}` : "";
  }

  if (filtered.length === 0) {
    el.transactionsFullTbody.innerHTML = "";
    el.transactionsFullEmpty.classList.remove("hidden");
    el.transactionsFullEmpty.classList.add("flex");
    return;
  }

  el.transactionsFullEmpty.classList.add("hidden");
  el.transactionsFullEmpty.classList.remove("flex");

  el.transactionsFullTbody.innerHTML = filtered.slice(0, txnVisibleCount).map(buildRowHtml).join("");
  wireRowActions(el.transactionsFullTbody, transactions);

  const remaining = filtered.length - txnVisibleCount;
  if (remaining > 0) {
    el.txnLoadMoreWrap.classList.remove("hidden");
    el.txnLoadMoreWrap.classList.add("flex");
    el.txnLoadMoreRemaining.textContent = `(${remaining})`;
  } else {
    el.txnLoadMoreWrap.classList.add("hidden");
    el.txnLoadMoreWrap.classList.remove("flex");
  }
}

function refreshTransactionViews() {
  txnVisibleCount = TXN_PAGE_SIZE;
  renderTransactionsTable(lastTransactions);
  renderFullTransactionsTable(lastTransactions);
}

export function bindSearch() {
  el.searchInput.addEventListener("input", () => {
    if (el.mobileSearchInput) el.mobileSearchInput.value = el.searchInput.value;
    refreshTransactionViews();
  });
  el.mobileSearchInput?.addEventListener("input", () => {
    el.searchInput.value = el.mobileSearchInput.value;
    refreshTransactionViews();
  });
}

export function bindTransactionFilters() {
  el.txnFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      txnTypeFilter = btn.dataset.filterType;
      el.txnFilterBtns.forEach((b) => b.classList.toggle("active-filter", b === btn));
      txnVisibleCount = TXN_PAGE_SIZE;
      renderFullTransactionsTable(lastTransactions);
    });
  });
  el.txnCategoryFilter?.addEventListener("change", () => {
    txnVisibleCount = TXN_PAGE_SIZE;
    renderFullTransactionsTable(lastTransactions);
  });
  el.txnMonthFilter?.addEventListener("change", () => {
    txnMonthFilterValue = el.txnMonthFilter.value;
    txnVisibleCount = TXN_PAGE_SIZE;
    renderFullTransactionsTable(lastTransactions);
  });
  el.txnLoadMoreBtn?.addEventListener("click", () => {
    txnVisibleCount += TXN_PAGE_SIZE;
    renderFullTransactionsTable(lastTransactions);
  });
}

/* ---------------------------------------------------------------
   Mobile search toggle
--------------------------------------------------------------- */
export function bindMobileSearch() {
  el.mobileSearchBtn?.addEventListener("click", () => {
    el.mobileSearchRow.classList.toggle("hidden");
    if (!el.mobileSearchRow.classList.contains("hidden")) {
      el.mobileSearchInput?.focus();
    }
  });
}

/* ---------------------------------------------------------------
   Gráficos (Chart.js) — Dashboard
--------------------------------------------------------------- */
function hexToRgba(hex, alpha) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#0f172a",
      borderColor: "#334155",
      borderWidth: 1,
      padding: 10,
      titleColor: "#e2e8f0",
      bodyColor: "#cbd5e1",
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
    y: {
      grid: { color: "rgba(51,65,85,0.35)" },
      ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
    },
  },
};

export function initCharts() {
  cashflowChart = new Chart(el.cashflowCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  categoryChart = new Chart(el.categoryCanvas.getContext("2d"), {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
    },
  });
}

export function initReportsCharts() {
  reportsCashflowChart = new Chart(el.reportsCashflowCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  reportsCategoryChart = new Chart(el.reportsCategoryCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
      scales: {
        x: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
        y: { grid: { display: false }, ticks: { color: "#cbd5e1", font: { size: 11 } } },
      },
    },
  });
}

function buildCashflowDatasets(canvas, labels, income, expense) {
  const ctx = canvas.getContext("2d");
  const modeColor = getModeColor();

  const incomeGradient = ctx.createLinearGradient(0, 0, 0, 280);
  incomeGradient.addColorStop(0, hexToRgba(modeColor, 0.35));
  incomeGradient.addColorStop(1, hexToRgba(modeColor, 0));

  const expenseGradient = ctx.createLinearGradient(0, 0, 0, 280);
  expenseGradient.addColorStop(0, hexToRgba("#64748b", 0.25));
  expenseGradient.addColorStop(1, hexToRgba("#64748b", 0));

  return {
    labels,
    datasets: [
      {
        label: "Receitas",
        data: income,
        borderColor: modeColor,
        backgroundColor: incomeGradient,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: modeColor,
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        borderWidth: 2.5,
      },
      {
        label: "Despesas",
        data: expense,
        borderColor: "#64748b",
        backgroundColor: expenseGradient,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: "#64748b",
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        borderWidth: 2.5,
        borderDash: [4, 4],
      },
    ],
  };
}

export function updateCharts(transactions) {
  lastTransactions = transactions;
  if (!cashflowChart || !categoryChart) return;

  const { labels, income, expense } = buildMonthlySeries(transactions, 6, dashPeriodDate());
  const built = buildCashflowDatasets(el.cashflowCanvas, labels, income, expense);
  cashflowChart.data.labels = built.labels;
  cashflowChart.data.datasets = built.datasets;
  cashflowChart.update();

  // Categoria (despesas do período selecionado no filtro do dashboard)
  const isAllPeriod = dashPeriodFilterValue === "all";
  const categoryTotals = {};
  transactions
    .filter((t) => t.type === "expense" && (isAllPeriod || t.date.slice(0, 7) === dashPeriodFilterValue))
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (Number(t.amount) || 0);
    });

  const catLabels = Object.keys(categoryTotals);
  const catValues = Object.values(categoryTotals);
  const catColors = catLabels.map((c) => CATEGORY_COLORS[c] || CATEGORY_COLORS["Outros"]);

  categoryChart.data.labels = catLabels;
  categoryChart.data.datasets = [
    {
      data: catValues.length ? catValues : [1],
      backgroundColor: catValues.length ? catColors : ["#1e293b"],
      borderColor: "#0f172a",
      borderWidth: 3,
      hoverOffset: 6,
    },
  ];
  categoryChart.update();

  const total = catValues.reduce((a, b) => a + b, 0);
  el.categoryLegend.innerHTML = catLabels.length
    ? catLabels
        .map((label, i) => {
          const pct = total > 0 ? ((catValues[i] / total) * 100).toFixed(0) : 0;
          return `
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-slate-400">
              <span class="w-2.5 h-2.5 rounded-full" style="background:${catColors[i]};"></span>
              ${escapeHtml(label)}
            </span>
            <span class="font-semibold text-slate-300">${pct}%</span>
          </div>`;
        })
        .join("")
    : `<p class="text-slate-600 text-center">Sem despesas registradas.</p>`;
}

/* ---------------------------------------------------------------
   Relatórios (view: Relatórios)
--------------------------------------------------------------- */
function reportsPeriodDate() {
  if (reportsPeriodFilterValue === "all") return new Date();
  const [y, m] = reportsPeriodFilterValue.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Repopula o filtro de período dos relatórios com "Todos os meses" + o mês atual + os meses com transações. */
function populateReportsPeriodFilter(transactions) {
  if (!el.reportsPeriodFilter) return;
  const currentMonth = todayISO().slice(0, 7);
  const months = [...new Set([currentMonth, ...transactions.map((t) => t.date.slice(0, 7))])].sort().reverse();
  const current = el.reportsPeriodFilter.value || reportsPeriodFilterValue;

  el.reportsPeriodFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.reportsPeriodFilter.value = current === "all" || months.includes(current) ? current : currentMonth;
  reportsPeriodFilterValue = el.reportsPeriodFilter.value;
  refreshDropdown("reports-period-filter");
}

export function bindReportsFilters() {
  el.reportsPeriodFilter?.addEventListener("change", () => {
    reportsPeriodFilterValue = el.reportsPeriodFilter.value;
    renderReports(lastTransactions);
  });
}

export function renderReports(transactions) {
  if (!reportsCashflowChart || !reportsCategoryChart) return;
  lastTransactions = transactions;
  populateReportsPeriodFilter(transactions);

  const isAllPeriod = reportsPeriodFilterValue === "all";
  const periodTransactions = transactions.filter((t) => isAllPeriod || t.date.slice(0, 7) === reportsPeriodFilterValue);

  const { labels, income, expense } = buildMonthlySeries(transactions, 12, reportsPeriodDate());
  const built = buildCashflowDatasets(el.reportsCashflowCanvas, labels, income, expense);
  reportsCashflowChart.data.labels = built.labels;
  reportsCashflowChart.data.datasets = built.datasets;
  reportsCashflowChart.update();

  let totalIncome = 0, totalExpense = 0;
  periodTransactions.forEach((t) => {
    const amount = Number(t.amount) || 0;
    if (t.type === "income") totalIncome += amount;
    else totalExpense += amount;
  });
  const net = totalIncome - totalExpense;

  el.reportTotalIncome.textContent = formatCurrency(totalIncome);
  el.reportTotalExpense.textContent = formatCurrency(totalExpense);
  el.reportNet.textContent = formatCurrency(net);
  el.reportNet.classList.toggle("text-emerald-400", net >= 0);
  el.reportNet.classList.toggle("text-red-400", net < 0);

  const periodLabel = isAllPeriod ? "Todos os meses" : formatMonthLabel(reportsPeriodFilterValue);
  el.reportIncomePeriodLabel.textContent = periodLabel;
  el.reportExpensePeriodLabel.textContent = periodLabel;

  const categoryTotals = {};
  periodTransactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + (Number(t.amount) || 0);
    });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  el.reportTopCategory.textContent = sortedCategories.length
    ? `Maior categoria: ${sortedCategories[0][0]} (${formatCurrency(sortedCategories[0][1])})`
    : "Maior categoria: —";

  reportsCategoryChart.data.labels = sortedCategories.map((c) => c[0]);
  reportsCategoryChart.data.datasets = [
    {
      data: sortedCategories.map((c) => c[1]),
      backgroundColor: sortedCategories.map((c) => CATEGORY_COLORS[c[0]] || CATEGORY_COLORS["Outros"]),
      borderRadius: 6,
      barThickness: 18,
    },
  ];
  reportsCategoryChart.update();

  const topExpenses = periodTransactions
    .filter((t) => t.type === "expense")
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5);

  el.reportTopExpenses.innerHTML = topExpenses.length
    ? topExpenses
        .map((t) => {
          const color = CATEGORY_COLORS[t.category] || CATEGORY_COLORS["Outros"];
          return `
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-2 h-2 rounded-full shrink-0" style="background:${color};"></span>
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">${escapeHtml(t.description)}</p>
                <p class="text-xs text-slate-500">${formatDate(t.date)}</p>
              </div>
            </div>
            <span class="text-sm font-semibold text-red-400 shrink-0">${formatCurrency(Number(t.amount) || 0)}</span>
          </div>`;
        })
        .join("")
    : `<p class="text-slate-600 text-sm text-center py-6">Sem despesas registradas.</p>`;
}

/* ---------------------------------------------------------------
   Metas (view: Metas)
--------------------------------------------------------------- */
let editGoalHandler = null;

export function onEditGoal(handler) {
  editGoalHandler = handler;
}

function daysUntil(deadline) {
  if (!deadline) return null;
  const diff = new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString());
  return Math.ceil(diff / 86400000);
}

export function renderGoals(goals) {
  lastGoals = goals;

  if (goals.length === 0) {
    el.goalsGrid.innerHTML = "";
    el.goalsEmpty.classList.remove("hidden");
    el.goalsEmpty.classList.add("flex");
    return;
  }

  el.goalsEmpty.classList.add("hidden");
  el.goalsEmpty.classList.remove("flex");

  const modeColor = getModeColor();

  el.goalsGrid.innerHTML = goals
    .map((g) => {
      const target = Number(g.targetAmount) || 0;
      const current = Number(g.currentAmount) || 0;
      const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      const complete = pct >= 100;
      const barColor = complete ? "#10b981" : modeColor;
      const days = daysUntil(g.deadline);
      let deadlineLabel = "";
      if (g.deadline) {
        if (days === null) deadlineLabel = "";
        else if (days < 0) deadlineLabel = `<span class="text-red-400">Prazo vencido</span>`;
        else if (days === 0) deadlineLabel = `<span class="text-amber-400">Vence hoje</span>`;
        else deadlineLabel = `${days} dia${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"}`;
      }

      return `
        <div class="goal-card glass-card rounded-2xl p-5" data-id="${g.id}">
          <div class="flex items-start justify-between mb-4">
            <div class="min-w-0">
              <h4 class="font-bold text-sm truncate">${escapeHtml(g.name)}</h4>
              ${deadlineLabel ? `<p class="text-[11px] text-slate-500 mt-0.5">${deadlineLabel}</p>` : ""}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button class="row-action-btn edit-goal-btn" data-id="${g.id}" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
              <button class="row-action-btn delete-btn delete-goal-btn" data-id="${g.id}" title="Excluir"><i class="ph-bold ph-trash"></i></button>
            </div>
          </div>

          <div class="flex items-end justify-between mb-2">
            <span class="text-xl font-extrabold">${formatCurrency(current)}</span>
            <span class="text-xs text-slate-500">de ${formatCurrency(target)}</span>
          </div>

          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="goal-progress-bar h-full rounded-full" style="width:${pct}%; background:${barColor};"></div>
          </div>

          <div class="flex items-center justify-between mt-2.5">
            <span class="text-xs font-semibold" style="color:${barColor};">${pct.toFixed(0)}%</span>
            ${complete ? `<span class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1"><i class="ph-fill ph-check-circle"></i> Concluída</span>` : ""}
          </div>
        </div>`;
    })
    .join("");

  el.goalsGrid.querySelectorAll(".edit-goal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const g = goals.find((goal) => goal.id === btn.dataset.id);
      if (g && editGoalHandler) editGoalHandler(g);
    });
  });
  el.goalsGrid.querySelectorAll(".delete-goal-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "goal"));
  });
}

let goalSubmitHandler = null;

export function onGoalFormSubmit(handler) {
  goalSubmitHandler = handler;
}

const GOAL_DEADLINE_PLACEHOLDER = "Sem prazo definido";

export function openGoalModal(goal = null) {
  el.goalForm.reset();
  if (goal) {
    el.goalModalTitle.textContent = "Editar Meta";
    el.goalId.value = goal.id;
    el.goalName.value = goal.name;
    el.goalCurrent.value = goal.currentAmount;
    el.goalTarget.value = goal.targetAmount;
    setDatePickerValue("goal-deadline", "goal-deadline-label", goal.deadline || null, GOAL_DEADLINE_PLACEHOLDER);
  } else {
    el.goalModalTitle.textContent = "Nova Meta";
    el.goalId.value = "";
    el.goalCurrent.value = "0";
    setDatePickerValue("goal-deadline", "goal-deadline-label", null, GOAL_DEADLINE_PLACEHOLDER);
  }
  el.goalModal.classList.remove("hidden");
  el.goalModal.classList.add("flex");
}

export function closeGoalModal() {
  el.goalModal.classList.add("hidden");
  el.goalModal.classList.remove("flex");
  closeDatePicker();
}

export function bindGoalModal() {
  el.newGoalBtn?.addEventListener("click", () => openGoalModal());
  el.goalModalCloseBtn?.addEventListener("click", closeGoalModal);
  el.goalModalBackdrop?.addEventListener("click", closeGoalModal);

  el.goalForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      name: el.goalName.value.trim(),
      currentAmount: parseFloat(el.goalCurrent.value) || 0,
      targetAmount: parseFloat(el.goalTarget.value),
      deadline: el.goalDeadline.value || null,
    };
    const editingId = el.goalId.value || null;
    goalSubmitHandler?.(data, editingId);
  });
}

/* ---------------------------------------------------------------
   Notícias (view: Notícias)
--------------------------------------------------------------- */
export function bindNewsSubtabs() {
  el.newsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.newsTabBtns.forEach((b) => b.classList.toggle("active-news-tab", b === btn));
      const tab = btn.dataset.newsTab;
      el.newsPanelPortfolio.classList.toggle("hidden", tab !== "portfolio");
      el.newsPanelMarket.classList.toggle("hidden", tab !== "market");
    });
  });
}

function newsSkeletonCardHtml() {
  return `
    <div class="glass-card rounded-2xl overflow-hidden">
      <div class="skeleton w-full h-40" style="border-radius:0;"></div>
      <div class="p-4 space-y-2.5">
        <div class="skeleton h-4 w-3/4"></div>
        <div class="skeleton h-4 w-1/2"></div>
        <div class="skeleton h-3 w-full mt-2"></div>
      </div>
    </div>`;
}

function newsCardHtml(item) {
  const modeColor = getModeColor();
  const dateLabel = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const badges = (item.tickers || [])
    .slice(0, 3)
    .map(
      (t) =>
        `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${modeColor}22; color:${modeColor};">${escapeHtml(t)}</span>`
    )
    .join("");
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" class="w-full h-40 object-cover" loading="lazy" onerror="this.remove()" />`
    : `<div class="w-full h-40 bg-slate-800/60 flex items-center justify-center"><i class="ph-thin ph-newspaper text-4xl text-slate-700"></i></div>`;

  return `
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"
      class="news-card glass-card rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all">
      ${image}
      <div class="p-4 flex flex-col flex-1">
        ${badges ? `<div class="flex flex-wrap gap-1.5 mb-2">${badges}</div>` : ""}
        <h4 class="font-bold text-white text-sm leading-snug line-clamp-3 mb-2">${escapeHtml(item.title)}</h4>
        <div class="mt-auto flex items-center justify-between text-xs text-slate-400 pt-2 gap-2">
          <span class="truncate">${escapeHtml(item.source)}</span>
          <span class="shrink-0">${dateLabel}</span>
        </div>
        <span class="text-xs font-semibold mt-2 flex items-center gap-1" style="color:${modeColor};">
          Ler mais <i class="ph-bold ph-arrow-up-right"></i>
        </span>
      </div>
    </a>`;
}

function newsRefs(target) {
  return target === "portfolio"
    ? { grid: el.newsPortfolioGrid, empty: el.newsPortfolioEmpty, emptyTitle: el.newsPortfolioEmptyTitle, emptyDesc: el.newsPortfolioEmptyDesc }
    : { grid: el.newsMarketGrid, empty: el.newsMarketEmpty, emptyTitle: el.newsMarketEmptyTitle, emptyDesc: el.newsMarketEmptyDesc };
}

/** Mostra skeletons piscando enquanto a busca de notícias está em andamento. */
export function renderNewsSkeletons(target, count = 6) {
  const { grid, empty } = newsRefs(target);
  empty.classList.add("hidden");
  empty.classList.remove("flex");
  grid.innerHTML = Array.from({ length: count }, newsSkeletonCardHtml).join("");
}

/**
 * Renderiza os cards de notícia (ou o estado vazio) no grid indicado.
 * @param {"portfolio"|"market"} target
 * @param {object[]} items
 * @param {{title:string, desc:string}|null} emptyMessage - sobrescreve o texto do estado vazio (ex: aviso de API sem chave configurada)
 */
export function renderNewsCards(target, items, emptyMessage = null) {
  const { grid, empty, emptyTitle, emptyDesc } = newsRefs(target);

  if (target === "portfolio") lastNewsPortfolio = items || [];
  else lastNewsMarket = items || [];

  if (!items || items.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    empty.classList.add("flex");
    if (emptyMessage) {
      emptyTitle.textContent = emptyMessage.title;
      emptyDesc.textContent = emptyMessage.desc;
    }
    return;
  }

  empty.classList.add("hidden");
  empty.classList.remove("flex");
  grid.innerHTML = items.map(newsCardHtml).join("");
}

/* ---------------------------------------------------------------
   Orçamento por categoria (view: Orçamento)
--------------------------------------------------------------- */
let editBudgetHandler = null;

export function onEditBudget(handler) {
  editBudgetHandler = handler;
}

export function renderBudgets(budgets, transactions) {
  lastBudgets = budgets;

  if (budgets.length === 0) {
    el.budgetGrid.innerHTML = "";
    el.budgetEmpty.classList.remove("hidden");
    el.budgetEmpty.classList.add("flex");
    return;
  }

  el.budgetEmpty.classList.add("hidden");
  el.budgetEmpty.classList.remove("flex");

  const modeColor = getModeColor();

  el.budgetGrid.innerHTML = budgets
    .slice()
    .sort((a, b) => a.category.localeCompare(b.category))
    .map((b) => {
      const limit = Number(b.monthlyLimit) || 0;
      const spent = calcBudgetSpent(b.category, transactions);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const over = pct > 100;
      const warn = pct >= 80 && pct <= 100;
      const barColor = over ? "#f43f5e" : warn ? "#f59e0b" : modeColor;
      const dotColor = CATEGORY_COLORS[b.category] || CATEGORY_COLORS["Outros"];
      const remaining = limit - spent;

      return `
        <div class="budget-card glass-card rounded-2xl p-5" data-category="${escapeHtml(b.category)}">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${dotColor};"></span>
              <h4 class="font-bold text-sm truncate">${escapeHtml(b.category)}</h4>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button class="row-action-btn edit-budget-btn" data-category="${escapeHtml(b.category)}" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
              <button class="row-action-btn delete-btn delete-budget-btn" data-category="${escapeHtml(b.category)}" title="Excluir"><i class="ph-bold ph-trash"></i></button>
            </div>
          </div>

          <div class="flex items-end justify-between mb-2">
            <span class="text-xl font-extrabold">${formatCurrency(spent)}</span>
            <span class="text-xs text-slate-500">de ${formatCurrency(limit)}</span>
          </div>

          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="goal-progress-bar h-full rounded-full" style="width:${Math.min(100, pct)}%; background:${barColor};"></div>
          </div>

          <div class="flex items-center justify-between mt-2.5">
            <span class="text-xs font-semibold" style="color:${barColor};">${pct.toFixed(0)}%</span>
            ${
              over
                ? `<span class="text-[11px] text-red-400 font-semibold flex items-center gap-1"><i class="ph-fill ph-warning-circle"></i> Estourou ${formatCurrency(Math.abs(remaining))}</span>`
                : `<span class="text-[11px] text-slate-500">${formatCurrency(remaining)} restante</span>`
            }
          </div>
        </div>`;
    })
    .join("");

  el.budgetGrid.querySelectorAll(".edit-budget-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = budgets.find((x) => x.category === btn.dataset.category);
      if (b && editBudgetHandler) editBudgetHandler(b);
    });
  });
  el.budgetGrid.querySelectorAll(".delete-budget-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.category, "budget"));
  });
}

let budgetSubmitHandler = null;

export function onBudgetFormSubmit(handler) {
  budgetSubmitHandler = handler;
}

export function openBudgetModal(budget = null) {
  el.budgetForm.reset();

  if (budget) {
    el.budgetModalTitle.textContent = "Editar Orçamento";
    el.budgetCategory.value = budget.category;
    el.budgetCategory.disabled = true;
    el.budgetLimit.value = budget.monthlyLimit;
  } else {
    el.budgetModalTitle.textContent = "Novo Orçamento";
    el.budgetCategory.disabled = false;
    const usedCategories = lastBudgets.map((b) => b.category);
    [...el.budgetCategory.options].forEach((opt) => {
      opt.hidden = usedCategories.includes(opt.value);
    });
    const firstAvailable = [...el.budgetCategory.options].find((o) => !o.hidden);
    if (firstAvailable) el.budgetCategory.value = firstAvailable.value;
    el.budgetLimit.value = "";
  }

  refreshDropdown("budget-category");
  el.budgetModal.classList.remove("hidden");
  el.budgetModal.classList.add("flex");
}

export function closeBudgetModal() {
  el.budgetModal.classList.add("hidden");
  el.budgetModal.classList.remove("flex");
}

export function bindBudgetModal() {
  el.newBudgetBtn?.addEventListener("click", () => {
    if (lastBudgets.length >= EXPENSE_CATEGORIES.length) {
      showToast("Todas as categorias de despesa já têm orçamento definido.", "info");
      return;
    }
    openBudgetModal();
  });
  el.budgetModalCloseBtn?.addEventListener("click", closeBudgetModal);
  el.budgetModalBackdrop?.addEventListener("click", closeBudgetModal);

  el.budgetForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const category = el.budgetCategory.value;
    const monthlyLimit = parseFloat(el.budgetLimit.value);
    budgetSubmitHandler?.(category, monthlyLimit);
  });
}

/* ---------------------------------------------------------------
   Investimentos (view: Investimentos)

   Fórmulas:
   - Preço médio ao somar uma nova compra do mesmo ativo (calculado
     em app.js, não aqui): novoPM = (qtdAntiga*pmAntigo + qtdNova*precoNovo) / (qtdAntiga+qtdNova)
   - Saldo Total (valor de mercado hoje):  precoAtual * quantidade
   - Custo (capital investido no ativo):   precoMedio * quantidade
   - Rendimento em R$:                     saldoTotal - custo
   - Rentabilidade %:                      ((precoAtual - precoMedio) / precoMedio) * 100
--------------------------------------------------------------- */
let invTypeSort = "recent";

function formatQuantity(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

let editInvestmentPriceHandler = null;

export function onEditInvestmentPrice(handler) {
  editInvestmentPriceHandler = handler;
}

/** Aplica ativo, categoria e busca da barra de filtros — usado por tabela, KPIs, gráficos e aportes. */
function getFilteredInvestments(investments) {
  const term = (el.invSearchInput.value || "").toLowerCase().trim();
  const categoryFilter = el.invCategoryFilter.value;

  let filtered = investments;
  if (invAssetFilterValue !== "all") filtered = filtered.filter((inv) => inv.ticker === invAssetFilterValue);
  if (categoryFilter !== "all") filtered = filtered.filter((inv) => inv.category === categoryFilter);
  if (term) {
    filtered = filtered.filter(
      (inv) => inv.ticker.toLowerCase().includes(term) || (inv.name || "").toLowerCase().includes(term)
    );
  }
  return filtered;
}

/** Redesenha tudo na aba Investimentos que depende dos filtros (tabela, KPIs, gráficos e aportes). */
function refreshInvestmentViews() {
  const filtered = getFilteredInvestments(lastInvestments);
  renderInvestmentsTable(lastInvestments);
  updateInvestmentKPIs(filtered);
  updateInvestmentCharts(filtered);
  renderMonthlyContributions(filtered);
}

function renderInvestmentsTable(investments) {
  const filtered = getFilteredInvestments(investments);

  const withMetrics = filtered.map((inv) => ({ inv, m: calcInvestmentMetrics(inv) }));

  if (invTypeSort === "profit") withMetrics.sort((a, b) => b.m.profitPct - a.m.profitPct);
  else if (invTypeSort === "balance") withMetrics.sort((a, b) => b.m.totalValue - a.m.totalValue);
  else withMetrics.sort((a, b) => (b.inv.purchaseDate || "").localeCompare(a.inv.purchaseDate || ""));

  el.invCount.textContent = `${withMetrics.length} ativo${withMetrics.length === 1 ? "" : "s"}`;

  if (withMetrics.length === 0) {
    el.investmentsTbody.innerHTML = "";
    el.investmentsEmpty.classList.remove("hidden");
    el.investmentsEmpty.classList.add("flex");
    return;
  }

  el.investmentsEmpty.classList.add("hidden");
  el.investmentsEmpty.classList.remove("flex");

  el.investmentsTbody.innerHTML = withMetrics
    .map(({ inv, m }) => {
      const color = INVESTMENT_CATEGORY_COLORS[inv.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
      const positive = m.profitPct >= 0;
      const isB3 = B3_CATEGORIES.includes(inv.category);
      const warningIcon = inv.lastQuoteError
        ? `<i class="ph-fill ph-warning-circle text-amber-400 ml-1.5" title="Não foi possível atualizar a cotação agora. Mostrando o último preço salvo."></i>`
        : "";
      const b3Badge = isB3
        ? `<i class="ph-fill ph-globe text-slate-600 ml-1.5" title="Cotação automática via B3 (Brapi)"></i>`
        : "";
      return `
        <tr class="animate-fade-in" data-id="${inv.id}">
          <td class="px-5 sm:px-6 py-4 font-medium">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold" style="background:${color}22; color:${color};">
                ${escapeHtml((inv.ticker || "?").slice(0, 2).toUpperCase())}
              </span>
              <div class="min-w-0">
                <p class="truncate max-w-[140px] flex items-center">${escapeHtml(inv.ticker)}${b3Badge}${warningIcon}</p>
                ${inv.name && inv.name !== inv.ticker ? `<p class="text-[11px] text-slate-500 truncate max-w-[140px]">${escapeHtml(inv.name)}</p>` : ""}
              </div>
            </div>
          </td>
          <td class="px-5 sm:px-6 py-4">
            <span class="category-badge">
              <span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>
              ${escapeHtml(inv.category)}
            </span>
          </td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${formatCurrency(m.avgPrice)}</td>
          <td class="px-5 sm:px-6 py-4 text-right">
            <button class="edit-price-btn hover:text-blue-400 transition-colors" data-id="${inv.id}" title="Editar preço atual">
              ${formatCurrency(m.currentPrice)} <i class="ph-bold ph-pencil-simple text-xs ml-0.5"></i>
            </button>
          </td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${formatQuantity(m.quantity)}</td>
          <td class="px-5 sm:px-6 py-4 text-right font-semibold">${formatCurrency(m.totalValue)}</td>
          <td class="px-5 sm:px-6 py-4 text-right font-semibold ${positive ? "text-emerald-400" : "text-red-400"}">
            <div class="flex items-center justify-end gap-1">
              <i class="ph-bold ${positive ? "ph-trend-up" : "ph-trend-down"}"></i>
              ${positive ? "+" : ""}${m.profitPct.toFixed(2)}%
            </div>
          </td>
          <td class="px-5 sm:px-6 py-4">
            <div class="flex items-center justify-end gap-1.5">
              <button class="row-action-btn edit-investment-btn" data-id="${inv.id}" title="Editar ativo">
                <i class="ph-bold ph-pencil-simple"></i>
              </button>
              <button class="row-action-btn delete-btn delete-investment-btn" data-id="${inv.id}" title="Excluir">
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  el.investmentsTbody.querySelectorAll(".edit-price-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = investments.find((i) => i.id === btn.dataset.id);
      if (inv) openPriceEditModal(inv);
    });
  });
  el.investmentsTbody.querySelectorAll(".edit-investment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = investments.find((i) => i.id === btn.dataset.id);
      if (inv) editInvestmentHandler?.(inv);
    });
  });
  el.investmentsTbody.querySelectorAll(".delete-investment-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "investment"));
  });
}

function updateInvestmentKPIs(investments) {
  const withMetrics = investments.map((inv) => ({ inv, m: calcInvestmentMetrics(inv) }));

  const totalValue = withMetrics.reduce((sum, x) => sum + x.m.totalValue, 0);
  const totalCost = withMetrics.reduce((sum, x) => sum + x.m.costBasis, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  el.invKpiTotal.textContent = formatCurrency(totalValue);
  el.invKpiProfit.textContent = formatCurrency(totalProfit);
  el.invKpiProfit.classList.toggle("text-emerald-400", totalProfit >= 0);
  el.invKpiProfit.classList.toggle("text-red-400", totalProfit < 0);
  renderChangeBadge(el.invKpiProfitPct, totalProfitPct);

  // Rendimento do mês: apenas ativos comprados no mês atual (mede como as
  // compras recentes estão performando, já que não guardamos histórico
  // diário de preços para recalcular o patrimônio em datas passadas).
  const now = new Date();
  const monthPositions = withMetrics.filter((x) => {
    const d = new Date(`${x.inv.purchaseDate}T00:00:00`);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthCost = monthPositions.reduce((sum, x) => sum + x.m.costBasis, 0);
  const monthProfit = monthPositions.reduce((sum, x) => sum + x.m.profitValue, 0);
  const monthPct = monthCost > 0 ? (monthProfit / monthCost) * 100 : 0;
  el.invKpiMonth.textContent = `${monthPct >= 0 ? "+" : ""}${monthPct.toFixed(1)}%`;
  el.invKpiMonth.classList.toggle("text-emerald-400", monthPct >= 0 && monthPositions.length > 0);
  el.invKpiMonth.classList.toggle("text-red-400", monthPct < 0);

  if (withMetrics.length === 0) {
    el.invKpiBestTicker.textContent = "—";
    el.invKpiBestPct.textContent = "0%";
    return;
  }

  const best = withMetrics.reduce((a, b) => (b.m.profitPct > a.m.profitPct ? b : a));
  el.invKpiBestTicker.textContent = best.inv.ticker;
  el.invKpiBestPct.textContent = `${best.m.profitPct >= 0 ? "+" : ""}${best.m.profitPct.toFixed(2)}%`;
  el.invKpiBestPct.classList.toggle("text-emerald-400", best.m.profitPct >= 0);
  el.invKpiBestPct.classList.toggle("text-red-400", best.m.profitPct < 0);
}

export function initInvestmentCharts() {
  invEvolutionChart = new Chart(el.invEvolutionCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  invContribChart = new Chart(el.invContribCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
        y: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
      },
    },
  });

  invAllocationChart = new Chart(el.invAllocationCanvas.getContext("2d"), {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
    },
  });
}

/** Aportes (compras) por mês nos últimos 12 meses — respeita o filtro de ativo da aba. */
function renderMonthlyContributions(investments) {
  if (!invContribChart) return;

  const months = buildMonthlyContributions(investments, 12);

  const total = months.reduce((sum, m) => sum + m.total, 0);
  el.invContribTotal.textContent = formatCurrency(total);
  el.invContribAvg.textContent = formatCurrency(total / months.length);
  el.invContribSubtitle.textContent =
    invAssetFilterValue !== "all"
      ? `Quanto você investiu em ${invAssetFilterValue} nos últimos 12 meses`
      : investments.length < lastInvestments.length
        ? "Quanto você investiu nos ativos filtrados nos últimos 12 meses"
        : "Quanto você investiu em cada um dos últimos 12 meses";

  const modeColor = getModeColor();
  invContribChart.data.labels = months.map((m) => m.label);
  invContribChart.data.datasets = [
    { label: "Aportes", data: months.map((m) => m.total), backgroundColor: hexToRgba(modeColor, 0.7), borderRadius: 6, barThickness: 22 },
  ];
  invContribChart.update();

  el.invContribTbody.innerHTML = months
    .slice()
    .reverse()
    .map(
      (m) => `
        <tr class="border-b border-slate-800/40 last:border-0">
          <td class="py-3 font-medium capitalize">${formatMonthLabel(m.key)}</td>
          <td class="py-3 text-right text-slate-400">${m.count || "—"}</td>
          <td class="py-3 text-right font-semibold ${m.total > 0 ? "" : "text-slate-600"}">${m.total > 0 ? formatCurrency(m.total) : "—"}</td>
        </tr>`
    )
    .join("");
}

function updateInvestmentCharts(investments) {
  if (!invEvolutionChart || !invAllocationChart) return;

  // Capital investido acumulado por mês, segmentado por categoria (custo
  // de aquisição, não valor de mercado — não há preço histórico diário
  // para reconstruir a evolução real de mercado no passado).
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
  }

  const categoriesPresent = [...new Set(investments.map((inv) => inv.category))];

  const evolutionDatasets = categoriesPresent.map((category) => {
    const color = INVESTMENT_CATEGORY_COLORS[category] || INVESTMENT_CATEGORY_COLORS["Outros"];
    const monthlyCost = months.map(() => 0);

    investments
      .filter((inv) => inv.category === category)
      .forEach((inv) => {
        const d = new Date(`${inv.purchaseDate}T00:00:00`);
        const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
        if (idx === -1) return;
        monthlyCost[idx] += (Number(inv.avgPrice) || 0) * (Number(inv.quantity) || 0);
      });

    let running = 0;
    const cumulative = monthlyCost.map((v) => (running += v));

    return {
      label: category,
      data: cumulative,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.08),
      fill: false,
      tension: 0.4,
      pointRadius: 2.5,
      pointBackgroundColor: color,
      pointBorderColor: "#0f172a",
      pointBorderWidth: 1.5,
      borderWidth: 2.25,
    };
  });

  invEvolutionChart.data.labels = months.map((m) => m.label);
  invEvolutionChart.data.datasets = evolutionDatasets;
  invEvolutionChart.update();

  el.invEvolutionLegend.innerHTML = categoriesPresent.length
    ? categoriesPresent
        .map((c) => {
          const color = INVESTMENT_CATEGORY_COLORS[c] || INVESTMENT_CATEGORY_COLORS["Outros"];
          return `<span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full" style="background:${color};"></span>${escapeHtml(c)}</span>`;
        })
        .join("")
    : `<p class="text-slate-600">Sem ativos cadastrados.</p>`;

  const totals = {};
  investments.forEach((inv) => {
    const m = calcInvestmentMetrics(inv);
    totals[inv.category] = (totals[inv.category] || 0) + m.totalValue;
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);
  const colors = labels.map((c) => INVESTMENT_CATEGORY_COLORS[c] || INVESTMENT_CATEGORY_COLORS["Outros"]);

  invAllocationChart.data.labels = labels;
  invAllocationChart.data.datasets = [
    {
      data: values.length ? values : [1],
      backgroundColor: values.length ? colors : ["#1e293b"],
      borderColor: "#0f172a",
      borderWidth: 3,
      hoverOffset: 6,
    },
  ];
  invAllocationChart.update();

  const total = values.reduce((a, b) => a + b, 0);
  el.invAllocationLegend.innerHTML = labels.length
    ? labels
        .map((label, i) => {
          const pct = total > 0 ? ((values[i] / total) * 100).toFixed(0) : 0;
          return `
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-slate-400">
              <span class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]};"></span>
              ${escapeHtml(label)}
            </span>
            <span class="font-semibold text-slate-300">${pct}%</span>
          </div>`;
        })
        .join("")
    : `<p class="text-slate-600 text-center">Sem ativos cadastrados.</p>`;
}

/* ---------------------------------------------------------------
   Filtro por ativo (compartilhado entre tabela, detalhe e proventos)
--------------------------------------------------------------- */
function populateAssetFilter(investments) {
  const tickers = [...new Set(investments.map((inv) => inv.ticker))].sort();
  const current = el.invAssetFilter.value;

  el.invAssetFilter.innerHTML =
    `<option value="all">Todos os ativos</option>` +
    tickers.map((t) => `<option value="${t.replace(/"/g, "&quot;")}">${escapeHtml(t)}</option>`).join("");

  el.invAssetFilter.value = tickers.includes(current) ? current : "all";
  invAssetFilterValue = el.invAssetFilter.value;
  refreshDropdown("inv-asset-filter");
}

function populateDividendTickerSelect(investments) {
  const tickers = [...new Set(investments.map((inv) => inv.ticker))].sort();
  const current = el.dividendTicker.value;

  el.dividendTicker.innerHTML = tickers.length
    ? tickers.map((t) => `<option value="${t.replace(/"/g, "&quot;")}">${escapeHtml(t)}</option>`).join("")
    : `<option value="">Cadastre um ativo primeiro</option>`;

  if (tickers.includes(current)) el.dividendTicker.value = current;
  refreshDropdown("dividend-ticker");
}

/* ---------------------------------------------------------------
   Detalhe do ativo selecionado (evolução de preço + proventos)
--------------------------------------------------------------- */
export function initAssetDetailChart() {
  assetDetailChart = new Chart(el.assetDetailCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });
}

function renderAssetDetail(investments, dividends) {
  if (invAssetFilterValue === "all") {
    el.assetDetailCard.classList.add("hidden");
    return;
  }

  const inv = investments.find((i) => i.ticker === invAssetFilterValue);
  if (!inv) {
    el.assetDetailCard.classList.add("hidden");
    return;
  }

  el.assetDetailCard.classList.remove("hidden");

  const m = calcInvestmentMetrics(inv);
  const color = INVESTMENT_CATEGORY_COLORS[inv.category] || INVESTMENT_CATEGORY_COLORS["Outros"];

  el.assetDetailIcon.style.background = `${color}22`;
  el.assetDetailIcon.style.color = color;
  el.assetDetailIcon.textContent = (inv.ticker || "?").slice(0, 2).toUpperCase();
  el.assetDetailTicker.textContent = inv.ticker;
  el.assetDetailCategory.innerHTML = `<span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>${escapeHtml(inv.category)}`;
  el.assetDetailQty.textContent = formatQuantity(m.quantity);
  el.assetDetailAvg.textContent = formatCurrency(m.avgPrice);
  el.assetDetailTotal.textContent = formatCurrency(m.totalValue);

  const tickerDividends = dividends.filter((d) => d.ticker === inv.ticker);
  const totalDividends = tickerDividends.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  el.assetDetailDividends.textContent = formatCurrency(totalDividends);

  const history = Array.isArray(inv.priceHistory) ? inv.priceHistory : [];
  if (!assetDetailChart) return;

  if (history.length < 2) {
    el.assetDetailChartWrap.classList.add("hidden");
    el.assetDetailEmptyHint.classList.remove("hidden");
    return;
  }
  el.assetDetailChartWrap.classList.remove("hidden");
  el.assetDetailEmptyHint.classList.add("hidden");

  const ctx = el.assetDetailCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, hexToRgba(color, 0.3));
  gradient.addColorStop(1, hexToRgba(color, 0));

  assetDetailChart.data.labels = history.map((h) => formatDate(h.date));
  assetDetailChart.data.datasets = [
    {
      label: inv.ticker,
      data: history.map((h) => h.price),
      borderColor: color,
      backgroundColor: gradient,
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: color,
      pointBorderColor: "#0f172a",
      pointBorderWidth: 2,
      borderWidth: 2.25,
    },
  ];
  assetDetailChart.update();
}

/* ---------------------------------------------------------------
   Proventos (dividendos, JCP, rendimentos)
--------------------------------------------------------------- */
export function initDividendsChart() {
  divChart = new Chart(el.divChartCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
        y: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
      },
    },
  });
}

const MONTHS_PT_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatMonthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${MONTHS_PT_FULL[m - 1]} de ${y}`;
}

/** Repopula o filtro de mês com os meses realmente presentes no conjunto (já filtrado por ativo). */
function populateDividendMonthFilter(dividendsForAsset) {
  const months = [...new Set(dividendsForAsset.map((d) => d.date.slice(0, 7)))].sort().reverse();
  const current = el.divMonthFilter.value;

  el.divMonthFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.divMonthFilter.value = months.includes(current) ? current : "all";
  divMonthFilterValue = el.divMonthFilter.value;
  refreshDropdown("div-month-filter");
}

function renderDividends(dividends, investments) {
  // Filtrado só pelo ativo — base para os KPIs, o gráfico e a lista de
  // meses disponíveis (não deve depender do filtro de mês, senão o
  // dropdown de mês encolheria conforme o próprio usuário filtra).
  const filtered = invAssetFilterValue === "all" ? dividends : dividends.filter((d) => d.ticker === invAssetFilterValue);

  populateDividendMonthFilter(filtered);

  // Filtrado por ativo + mês — só para a tabela de histórico.
  const tableRows = divMonthFilterValue === "all" ? filtered : filtered.filter((d) => d.date.slice(0, 7) === divMonthFilterValue);

  el.divCount.textContent = `${tableRows.length} registro${tableRows.length === 1 ? "" : "s"}`;

  if (tableRows.length === 0) {
    el.dividendsTbody.innerHTML = "";
    el.dividendsEmpty.classList.remove("hidden");
    el.dividendsEmpty.classList.add("flex");
  } else {
    el.dividendsEmpty.classList.add("hidden");
    el.dividendsEmpty.classList.remove("flex");

    el.dividendsTbody.innerHTML = tableRows
      .map((d) => {
        const color = DIVIDEND_TYPE_COLORS[d.type] || DIVIDEND_TYPE_COLORS["Outro"];
        return `
          <tr class="animate-fade-in" data-id="${d.id}">
            <td class="px-5 sm:px-6 py-4 font-medium">${escapeHtml(d.ticker)}</td>
            <td class="px-5 sm:px-6 py-4">
              <span class="category-badge">
                <span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>
                ${escapeHtml(d.type)}
              </span>
            </td>
            <td class="px-5 sm:px-6 py-4 text-slate-400">${formatDate(d.date)}</td>
            <td class="px-5 sm:px-6 py-4 text-right font-semibold text-emerald-400">${formatCurrency(Number(d.amount) || 0)}</td>
            <td class="px-5 sm:px-6 py-4">
              <div class="flex items-center justify-end gap-1.5">
                <button class="row-action-btn edit-dividend-btn" data-id="${d.id}" title="Editar">
                  <i class="ph-bold ph-pencil-simple"></i>
                </button>
                <button class="row-action-btn delete-btn delete-dividend-btn" data-id="${d.id}" title="Excluir">
                  <i class="ph-bold ph-trash"></i>
                </button>
              </div>
            </td>
          </tr>`;
      })
      .join("");

    el.dividendsTbody.querySelectorAll(".edit-dividend-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = tableRows.find((row) => row.id === btn.dataset.id);
        if (d && dividendEditHandler) dividendEditHandler(d);
      });
    });
    el.dividendsTbody.querySelectorAll(".delete-dividend-btn").forEach((btn) => {
      btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "dividend"));
    });
  }

  // KPIs (sempre calculados sobre o conjunto filtrado só pelo ativo — o
  // filtro de mês afeta apenas a lista abaixo, não esses totais fixos)
  const now = new Date();
  const totalReceived = filtered.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const yearReceived = filtered
    .filter((d) => new Date(`${d.date}T00:00:00`).getFullYear() === now.getFullYear())
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
  const last12mReceived = filtered
    .filter((d) => new Date(`${d.date}T00:00:00`) >= twelveMonthsAgo)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const relevantInvestments =
    invAssetFilterValue === "all" ? investments : investments.filter((inv) => inv.ticker === invAssetFilterValue);
  const totalCost = relevantInvestments.reduce((sum, inv) => sum + calcInvestmentMetrics(inv).costBasis, 0);
  const yieldOnCost = totalCost > 0 ? (last12mReceived / totalCost) * 100 : 0;

  el.divKpiTotal.textContent = formatCurrency(totalReceived);
  el.divKpiYear.textContent = formatCurrency(yearReceived);
  el.divKpiYearLabel.textContent = `Ano atual (${now.getFullYear()})`;
  el.divKpi12m.textContent = formatCurrency(last12mReceived);
  el.divKpiYield.textContent = `${yieldOnCost.toFixed(2)}%`;

  // Gráfico: proventos por mês (últimos 6 meses)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
  }
  const monthlyTotals = months.map(() => 0);
  filtered.forEach((d) => {
    const dt = new Date(`${d.date}T00:00:00`);
    const idx = months.findIndex((m) => m.year === dt.getFullYear() && m.month === dt.getMonth());
    if (idx !== -1) monthlyTotals[idx] += Number(d.amount) || 0;
  });

  if (divChart) {
    const modeColor = getModeColor();
    divChart.data.labels = months.map((m) => m.label);
    divChart.data.datasets = [
      {
        label: "Proventos",
        data: monthlyTotals,
        backgroundColor: hexToRgba(modeColor, 0.7),
        borderRadius: 6,
        barThickness: 28,
      },
    ];
    divChart.update();
  }
}

/** Chamado pelo app.js sempre que os proventos mudam em tempo real. */
export function renderDividendsData(dividends) {
  lastDividends = dividends;
  renderDividends(dividends, lastInvestments);
  renderAssetDetail(lastInvestments, dividends);
}

export function renderInvestments(investments) {
  lastInvestments = investments;
  populateAssetFilter(investments);
  refreshInvestmentViews();
  populateDividendTickerSelect(investments);
  renderAssetDetail(investments, lastDividends);
  renderDividends(lastDividends, investments);
}

export function setQuotesLoading(loading) {
  el.refreshQuotesBtn.disabled = loading;
  el.refreshQuotesBtn.classList.toggle("opacity-60", loading);
  el.refreshQuotesIcon.classList.toggle("animate-spin", loading);
}

export function bindInvestmentFilters() {
  el.invSearchInput.addEventListener("input", refreshInvestmentViews);
  el.invCategoryFilter.addEventListener("change", refreshInvestmentViews);
  el.invSortSelect.addEventListener("change", () => {
    invTypeSort = el.invSortSelect.value;
    renderInvestmentsTable(lastInvestments);
  });
  el.invAssetFilter.addEventListener("change", () => {
    invAssetFilterValue = el.invAssetFilter.value;
    refreshInvestmentViews();
    renderAssetDetail(lastInvestments, lastDividends);
    renderDividends(lastDividends, lastInvestments);
  });
  el.divMonthFilter.addEventListener("change", () => {
    divMonthFilterValue = el.divMonthFilter.value;
    renderDividends(lastDividends, lastInvestments);
  });
}

/* ---------------------------------------------------------------
   Modal: Registrar Provento
--------------------------------------------------------------- */
let dividendSubmitHandler = null;
let dividendEditHandler = null;

export function onDividendFormSubmit(handler) {
  dividendSubmitHandler = handler;
}

export function onEditDividend(handler) {
  dividendEditHandler = handler;
}

const DIVIDEND_DATE_PLACEHOLDER = "Selecionar data";

export function openDividendModal(dividend = null) {
  el.dividendForm.reset();
  populateDividendTickerSelect(lastInvestments);
  if (dividend) {
    el.dividendModalTitle.textContent = "Editar Provento";
    el.dividendId.value = dividend.id;
    el.dividendTicker.value = dividend.ticker;
    el.dividendType.value = dividend.type;
    el.dividendAmount.value = dividend.amount;
    setDatePickerValue("dividend-date", "dividend-date-label", dividend.date, DIVIDEND_DATE_PLACEHOLDER);
  } else {
    el.dividendModalTitle.textContent = "Registrar Provento";
    el.dividendId.value = "";
    if (invAssetFilterValue !== "all") el.dividendTicker.value = invAssetFilterValue;
    setDatePickerValue("dividend-date", "dividend-date-label", todayISO(), DIVIDEND_DATE_PLACEHOLDER);
  }
  refreshDropdown("dividend-ticker");
  refreshDropdown("dividend-type");
  el.dividendModal.classList.remove("hidden");
  el.dividendModal.classList.add("flex");
}

export function closeDividendModal() {
  el.dividendModal.classList.add("hidden");
  el.dividendModal.classList.remove("flex");
  closeDatePicker();
}

export function bindDividendModal() {
  el.newDividendBtn?.addEventListener("click", () => openDividendModal());
  el.dividendModalCloseBtn?.addEventListener("click", closeDividendModal);
  el.dividendModalBackdrop?.addEventListener("click", closeDividendModal);

  el.dividendForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!el.dividendTicker.value) {
      showToast("Cadastre um ativo antes de registrar proventos.", "error");
      return;
    }
    if (!el.dividendDate.value) {
      showToast("Selecione a data do provento.", "error");
      return;
    }
    const data = {
      ticker: el.dividendTicker.value,
      type: el.dividendType.value,
      amount: parseFloat(el.dividendAmount.value),
      date: el.dividendDate.value,
    };
    const editingId = el.dividendId.value || null;
    dividendSubmitHandler?.(data, editingId);
  });
}

/* -------- Importar proventos automaticamente da B3 -------- */
let importDividendsHandler = null;

export function onImportDividends(handler) {
  importDividendsHandler = handler;
}

export function setImportDividendsLoading(loading) {
  el.importDividendsBtn.disabled = loading;
  el.importDividendsBtn.classList.toggle("opacity-60", loading);
  el.importDividendsIcon.classList.toggle("animate-spin", loading);
}

export function bindImportDividends() {
  el.importDividendsBtn?.addEventListener("click", () => importDividendsHandler?.());
}

/* ---------------------------------------------------------------
   Modal: Novo Investimento
--------------------------------------------------------------- */
let investmentSubmitHandler = null;

export function onInvestmentFormSubmit(handler) {
  investmentSubmitHandler = handler;
}

const INVESTMENT_DATE_PLACEHOLDER = "Selecionar data";
let priceManuallyEdited = false;

let editInvestmentHandler = null;

export function onEditInvestment(handler) {
  editInvestmentHandler = handler;
}

export function openInvestmentModal(investment = null) {
  el.investmentForm.reset();

  if (investment) {
    el.investmentModalTitle.textContent = "Editar Ativo";
    el.investmentSubmitLabel.textContent = "Salvar Alterações";
    el.investmentMergeHint.textContent = "Você está editando esta posição diretamente — quantidade e preço médio serão substituídos pelos valores informados.";
    el.investmentId.value = investment.id;
    el.investmentTicker.value = investment.ticker;
    el.investmentCategory.value = investment.category;
    el.investmentQuantity.value = investment.quantity;
    el.investmentPrice.value = investment.avgPrice;
    setDatePickerValue("investment-date", "investment-date-label", investment.purchaseDate, INVESTMENT_DATE_PLACEHOLDER);
    // Evita que um blur acidental no ticker sobrescreva o preço médio já
    // registrado com a cotação atual — só o botão manual faz isso na edição.
    priceManuallyEdited = true;
  } else {
    el.investmentModalTitle.textContent = "Novo Ativo";
    el.investmentSubmitLabel.textContent = "Salvar Investimento";
    el.investmentMergeHint.textContent = "Se você já tem esse ativo na carteira, a nova compra é somada e o preço médio recalculado automaticamente.";
    el.investmentId.value = "";
    setDatePickerValue("investment-date", "investment-date-label", todayISO(), INVESTMENT_DATE_PLACEHOLDER);
    priceManuallyEdited = false;
  }

  refreshDropdown("investment-category");
  el.investmentPriceHint.classList.add("hidden");
  el.investmentModal.classList.remove("hidden");
  el.investmentModal.classList.add("flex");
}

export function closeInvestmentModal() {
  el.investmentModal.classList.add("hidden");
  el.investmentModal.classList.remove("flex");
  closeDatePicker();
}

/* -------- Busca automática do preço atual na B3 (Ações/FIIs) -------- */
let fetchB3PriceHandler = null;

/** Registra o handler que efetivamente consulta a Brapi (implementado em app.js). */
export function onFetchB3Price(handler) {
  fetchB3PriceHandler = handler;
}

export function setB3PriceFetchLoading(loading) {
  el.investmentFetchPriceBtn.disabled = loading;
  el.investmentFetchPriceIcon.classList.toggle("animate-spin", loading);
}

/** Preenche o campo de preço com a cotação buscada (não conta como edição manual). */
export function fillInvestmentPrice(price) {
  el.investmentPrice.value = price.toFixed(2);
  showInvestmentPriceHint(`Preço atual da B3: ${formatCurrency(price)}`, false);
}

export function showInvestmentPriceHint(message, isError) {
  el.investmentPriceHint.textContent = message;
  el.investmentPriceHint.classList.remove("hidden");
  el.investmentPriceHint.classList.toggle("text-red-400", isError);
  el.investmentPriceHint.classList.toggle("text-emerald-400", !isError);
}

function triggerB3PriceFetch() {
  const ticker = el.investmentTicker.value.trim();
  const category = el.investmentCategory.value;
  if (!ticker || !B3_CATEGORIES.includes(category)) return;
  if (priceManuallyEdited) return;
  fetchB3PriceHandler?.(ticker, category);
}

export function bindInvestmentModal() {
  el.newInvestmentBtn?.addEventListener("click", () => openInvestmentModal());
  el.investmentModalCloseBtn?.addEventListener("click", closeInvestmentModal);
  el.investmentModalBackdrop?.addEventListener("click", closeInvestmentModal);

  // Digitou o ticker ou trocou a categoria para Ações/FIIs: busca o preço
  // atual sozinho, sem esperar o usuário clicar em nada.
  el.investmentTicker?.addEventListener("blur", triggerB3PriceFetch);
  el.investmentCategory?.addEventListener("change", triggerB3PriceFetch);

  // Botão explícito sempre busca de novo, mesmo que o preço já tenha sido
  // editado manualmente (ação intencional do usuário sobrepõe o valor).
  el.investmentFetchPriceBtn?.addEventListener("click", () => {
    const ticker = el.investmentTicker.value.trim();
    const category = el.investmentCategory.value;
    if (!ticker) {
      showInvestmentPriceHint("Digite o ticker antes de buscar.", true);
      return;
    }
    if (!B3_CATEGORIES.includes(category)) {
      showInvestmentPriceHint("Essa categoria não é negociada na B3 — informe o preço manualmente.", true);
      return;
    }
    priceManuallyEdited = false;
    fetchB3PriceHandler?.(ticker, category);
  });

  // Se o usuário digitar um valor à mão, o próximo blur do ticker não
  // deve sobrescrever silenciosamente o que ele já escreveu.
  el.investmentPrice?.addEventListener("input", () => {
    priceManuallyEdited = true;
  });

  el.investmentForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!el.investmentDate.value) {
      showToast("Selecione a data da compra.", "error");
      return;
    }
    const data = {
      ticker: el.investmentTicker.value.trim(),
      category: el.investmentCategory.value,
      purchaseDate: el.investmentDate.value,
      quantity: parseFloat(el.investmentQuantity.value),
      price: parseFloat(el.investmentPrice.value),
    };
    const editingId = el.investmentId.value || null;
    investmentSubmitHandler?.(data, editingId);
  });
}

/* ---------------------------------------------------------------
   Modal: Editar Preço Atual
--------------------------------------------------------------- */
let priceEditSubmitHandler = null;

export function onPriceEditSubmit(handler) {
  priceEditSubmitHandler = handler;
}

export function openPriceEditModal(investment) {
  el.priceEditId.value = investment.id;
  el.priceEditTickerDisplay.value = investment.ticker;
  el.priceEditValue.value = investment.currentPrice;
  el.priceEditModal.classList.remove("hidden");
  el.priceEditModal.classList.add("flex");
}

export function closePriceEditModal() {
  el.priceEditModal.classList.add("hidden");
  el.priceEditModal.classList.remove("flex");
}

export function bindPriceEditModal() {
  el.priceEditModalCloseBtn?.addEventListener("click", closePriceEditModal);
  el.priceEditModalBackdrop?.addEventListener("click", closePriceEditModal);

  el.priceEditForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = el.priceEditId.value;
    const price = parseFloat(el.priceEditValue.value);
    priceEditSubmitHandler?.(id, price);
    closePriceEditModal();
  });
}

/* ---------------------------------------------------------------
   Modal: Nova / Editar Transação
--------------------------------------------------------------- */
let transactionSubmitHandler = null;

export function onTransactionFormSubmit(handler) {
  transactionSubmitHandler = handler;
}

function setTransactionType(type) {
  el.transactionType.value = type;
  el.typeBtns.forEach((btn) => {
    const isTarget = btn.dataset.type === type;
    btn.classList.toggle("income-active", isTarget && type === "income");
    btn.classList.toggle("expense-active", isTarget && type === "expense");
    if (!isTarget) {
      btn.classList.remove("income-active", "expense-active");
    }
  });
}

const TRANSACTION_DATE_PLACEHOLDER = "Selecionar data";

export function openTransactionModal(transaction = null) {
  el.transactionForm.reset();
  if (transaction) {
    el.modalTitle.textContent = "Editar Transação";
    el.transactionId.value = transaction.id;
    el.transactionDesc.value = transaction.description;
    el.transactionAmount.value = transaction.amount;
    setDatePickerValue("transaction-date", "transaction-date-label", transaction.date, TRANSACTION_DATE_PLACEHOLDER);
    el.transactionCategory.value = transaction.category;
    setTransactionType(transaction.type);
  } else {
    el.modalTitle.textContent = "Nova Transação";
    el.transactionId.value = "";
    setDatePickerValue("transaction-date", "transaction-date-label", todayISO(), TRANSACTION_DATE_PLACEHOLDER);
    setTransactionType("income");
  }
  refreshDropdown("transaction-category");
  el.transactionModal.classList.remove("hidden");
  el.transactionModal.classList.add("flex");
}

export function closeTransactionModal() {
  el.transactionModal.classList.add("hidden");
  el.transactionModal.classList.remove("flex");
  closeDatePicker();
}

export function bindTransactionModal() {
  el.newTransactionBtn.addEventListener("click", () => openTransactionModal());
  el.modalCloseBtn.addEventListener("click", closeTransactionModal);
  el.transactionModalBackdrop.addEventListener("click", closeTransactionModal);

  el.typeBtns.forEach((btn) => {
    btn.addEventListener("click", () => setTransactionType(btn.dataset.type));
  });

  el.transactionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!el.transactionDate.value) {
      showToast("Selecione uma data para a transação.", "error");
      return;
    }
    const data = {
      description: el.transactionDesc.value.trim(),
      amount: parseFloat(el.transactionAmount.value),
      date: el.transactionDate.value,
      category: el.transactionCategory.value,
      type: el.transactionType.value,
    };
    const editingId = el.transactionId.value || null;
    transactionSubmitHandler?.(data, editingId);
  });
}

/* ---------------------------------------------------------------
   Transações Recorrentes (dentro da view: Transações)
--------------------------------------------------------------- */
function setRecurrenceType(type) {
  el.recurrenceType.value = type;
  el.recurrenceTypeBtns.forEach((btn) => {
    const isTarget = btn.dataset.type === type;
    btn.classList.toggle("income-active", isTarget && type === "income");
    btn.classList.toggle("expense-active", isTarget && type === "expense");
    if (!isTarget) {
      btn.classList.remove("income-active", "expense-active");
    }
  });
}

let editRecurrenceHandler = null;

export function onEditRecurrence(handler) {
  editRecurrenceHandler = handler;
}

export function renderRecurrences(recurrences) {
  if (recurrences.length === 0) {
    el.recurrencesList.innerHTML = "";
    el.recurrencesEmpty.classList.remove("hidden");
    el.recurrencesEmpty.classList.add("flex");
    return;
  }

  el.recurrencesEmpty.classList.add("hidden");
  el.recurrencesEmpty.classList.remove("flex");

  el.recurrencesList.innerHTML = recurrences
    .map((r) => {
      const color = CATEGORY_COLORS[r.category] || CATEGORY_COLORS["Outros"];
      const isIncome = r.type === "income";
      const amountLabel = `${isIncome ? "+" : "-"} ${formatCurrency(Math.abs(Number(r.amount) || 0))}`;
      return `
        <div class="flex items-center justify-between px-5 sm:px-6 py-3.5" data-id="${r.id}">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background:${color}22;">
              <i class="ph-bold ph-arrows-clockwise" style="color:${color};"></i>
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium truncate max-w-[160px] sm:max-w-xs">${escapeHtml(r.description)}</p>
              <p class="text-xs text-slate-500 truncate">${escapeHtml(r.category)} · dia ${r.dayOfMonth} de cada mês</p>
            </div>
          </div>
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <span class="text-sm font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}">${amountLabel}</span>
            <button class="row-action-btn edit-recurrence-btn" data-id="${r.id}" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
            <button class="row-action-btn delete-btn delete-recurrence-btn" data-id="${r.id}" title="Excluir"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>`;
    })
    .join("");

  el.recurrencesList.querySelectorAll(".edit-recurrence-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = recurrences.find((x) => x.id === btn.dataset.id);
      if (r && editRecurrenceHandler) editRecurrenceHandler(r);
    });
  });
  el.recurrencesList.querySelectorAll(".delete-recurrence-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "recurrence"));
  });
}

let recurrenceSubmitHandler = null;

export function onRecurrenceFormSubmit(handler) {
  recurrenceSubmitHandler = handler;
}

export function openRecurrenceModal(recurrence = null) {
  el.recurrenceForm.reset();
  if (recurrence) {
    el.recurrenceModalTitle.textContent = "Editar Recorrência";
    el.recurrenceId.value = recurrence.id;
    el.recurrenceDesc.value = recurrence.description;
    el.recurrenceAmount.value = recurrence.amount;
    el.recurrenceDay.value = recurrence.dayOfMonth;
    el.recurrenceCategory.value = recurrence.category;
    setRecurrenceType(recurrence.type);
  } else {
    el.recurrenceModalTitle.textContent = "Nova Recorrência";
    el.recurrenceId.value = "";
    setRecurrenceType("income");
  }
  refreshDropdown("recurrence-category");
  el.recurrenceModal.classList.remove("hidden");
  el.recurrenceModal.classList.add("flex");
}

export function closeRecurrenceModal() {
  el.recurrenceModal.classList.add("hidden");
  el.recurrenceModal.classList.remove("flex");
}

export function bindRecurrenceModal() {
  el.newRecurrenceBtn?.addEventListener("click", () => openRecurrenceModal());
  el.recurrenceModalCloseBtn?.addEventListener("click", closeRecurrenceModal);
  el.recurrenceModalBackdrop?.addEventListener("click", closeRecurrenceModal);

  el.recurrenceTypeBtns.forEach((btn) => {
    btn.addEventListener("click", () => setRecurrenceType(btn.dataset.type));
  });

  el.recurrenceForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const day = parseInt(el.recurrenceDay.value, 10);
    if (day < 1 || day > 31) {
      showToast("Dia do mês precisa ser entre 1 e 31.", "error");
      return;
    }
    const data = {
      description: el.recurrenceDesc.value.trim(),
      amount: parseFloat(el.recurrenceAmount.value),
      dayOfMonth: day,
      category: el.recurrenceCategory.value,
      type: el.recurrenceType.value,
    };
    const editingId = el.recurrenceId.value || null;
    recurrenceSubmitHandler?.(data, editingId);
  });
}

/* ---------------------------------------------------------------
   Calendário customizado (datepicker.js)
--------------------------------------------------------------- */
export function bindDatePickers() {
  attachDatePicker({
    triggerId: "transaction-date-trigger",
    labelId: "transaction-date-label",
    hiddenInputId: "transaction-date",
    placeholder: TRANSACTION_DATE_PLACEHOLDER,
  });
  attachDatePicker({
    triggerId: "goal-deadline-trigger",
    labelId: "goal-deadline-label",
    hiddenInputId: "goal-deadline",
    placeholder: GOAL_DEADLINE_PLACEHOLDER,
  });
  attachDatePicker({
    triggerId: "investment-date-trigger",
    labelId: "investment-date-label",
    hiddenInputId: "investment-date",
    placeholder: INVESTMENT_DATE_PLACEHOLDER,
  });
  attachDatePicker({
    triggerId: "dividend-date-trigger",
    labelId: "dividend-date-label",
    hiddenInputId: "dividend-date",
    placeholder: DIVIDEND_DATE_PLACEHOLDER,
  });
}

export function bindCustomDropdowns() {
  [
    "transaction-category",
    "investment-category",
    "budget-category",
    "recurrence-category",
    "txn-category-filter",
    "txn-month-filter",
    "dashboard-period-filter",
    "reports-period-filter",
    "inv-category-filter",
    "inv-sort-select",
    "inv-asset-filter",
    "div-month-filter",
    "dividend-ticker",
    "dividend-type",
  ].forEach(enhanceSelect);
}

/* ---------------------------------------------------------------
   Modal: Confirmar Exclusão (genérico p/ transações e metas)
--------------------------------------------------------------- */
let deleteConfirmHandler = null;

export function onDeleteConfirm(handler) {
  deleteConfirmHandler = handler;
}

export function openDeleteModal(id, type = "transaction") {
  pendingDeleteId = id;
  pendingDeleteType = type;
  const meta = DELETE_META[type] || DELETE_META.transaction;
  el.deleteModalTitle.textContent = meta.title;
  el.deleteModalDesc.textContent = meta.desc;
  el.deleteModal.classList.remove("hidden");
  el.deleteModal.classList.add("flex");
}

export function closeDeleteModal() {
  pendingDeleteId = null;
  el.deleteModal.classList.add("hidden");
  el.deleteModal.classList.remove("flex");
}

export function bindDeleteModal() {
  el.deleteCancelBtn.addEventListener("click", closeDeleteModal);
  el.deleteModalBackdrop.addEventListener("click", closeDeleteModal);
  el.deleteConfirmBtn.addEventListener("click", () => {
    if (pendingDeleteId) deleteConfirmHandler?.(pendingDeleteId, pendingDeleteType);
    closeDeleteModal();
  });
}

/* ---------------------------------------------------------------
   Configurações (view: Configurações)
--------------------------------------------------------------- */
export function renderProfileSettings(user) {
  el.settingsNameInput.value = user.displayName || "";
  el.settingsEmailDisplay.value = user.email || "";
}

export function renderCoupleSettings(coupleId) {
  el.settingsCoupleId.value = coupleId || "";
}

let profileUpdateHandler = null;
let joinCoupleHandler = null;
let passwordResetHandler = null;
let exportBackupHandler = null;
let importBackupHandler = null;

export function onProfileUpdate(handler) {
  profileUpdateHandler = handler;
}

export function onJoinCouple(handler) {
  joinCoupleHandler = handler;
}

export function onPasswordReset(handler) {
  passwordResetHandler = handler;
}

export function onExportBackup(handler) {
  exportBackupHandler = handler;
}

export function onImportBackup(handler) {
  importBackupHandler = handler;
}

export function bindSettingsForms() {
  el.settingsProfileForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    profileUpdateHandler?.(el.settingsNameInput.value.trim());
  });

  el.settingsCopyCoupleBtn?.addEventListener("click", async () => {
    if (!el.settingsCoupleId.value) return;
    try {
      await navigator.clipboard.writeText(el.settingsCoupleId.value);
      showToast("Código copiado para a área de transferência!", "success");
    } catch {
      showToast("Não foi possível copiar automaticamente.", "error");
    }
  });

  el.settingsJoinForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = el.settingsJoinInput.value.trim();
    if (!value) return;
    joinCoupleHandler?.(value);
    el.settingsJoinInput.value = "";
  });

  el.settingsResetPasswordBtn?.addEventListener("click", () => passwordResetHandler?.());

  el.settingsExportBackupBtn?.addEventListener("click", () => exportBackupHandler?.());

  el.settingsImportBackupBtn?.addEventListener("click", () => el.settingsImportBackupInput?.click());
  el.settingsImportBackupInput?.addEventListener("change", () => {
    const file = el.settingsImportBackupInput.files?.[0];
    el.settingsImportBackupInput.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (file) importBackupHandler?.(file);
  });
}

export { el as elements };
