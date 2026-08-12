// =========================================================
// EcoFy — ui.js
// Manipulação do DOM, modais, toasts, gráficos (Chart.js)
// e alternância visual entre os modos Pessoal / Casal.
//
// Este módulo não conhece Firebase: ele apenas renderiza dados
// recebidos e expõe callbacks (padrão pub/sub) para que app.js
// conecte as ações de UI às operações reais (auth.js / db.js).
// =========================================================

import { attachDatePicker, setDatePickerValue, closeDatePicker } from "./datepicker.js";

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

  // KPIs
  kpiBalance: document.getElementById("kpi-balance"),
  kpiBalanceChange: document.getElementById("kpi-balance-change"),
  kpiIncome: document.getElementById("kpi-income"),
  kpiIncomeChange: document.getElementById("kpi-income-change"),
  kpiExpense: document.getElementById("kpi-expense"),
  kpiExpenseChange: document.getElementById("kpi-expense-change"),
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
  transactionsFullTbody: document.getElementById("transactions-full-tbody"),
  transactionsFullEmpty: document.getElementById("transactions-full-empty"),
  txnFullCount: document.getElementById("txn-full-count"),

  // Goals view
  newGoalBtn: document.getElementById("new-goal-btn"),
  goalsGrid: document.getElementById("goals-grid"),
  goalsEmpty: document.getElementById("goals-empty"),

  // Reports view
  reportTotalIncome: document.getElementById("report-total-income"),
  reportTotalExpense: document.getElementById("report-total-expense"),
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
  invAllocationCanvas: document.getElementById("inv-allocation-chart"),
  invAllocationLegend: document.getElementById("inv-allocation-legend"),
  investmentsTbody: document.getElementById("investments-tbody"),
  investmentsEmpty: document.getElementById("investments-empty"),
  invCount: document.getElementById("inv-count"),

  // Investment modal (novo ativo)
  investmentModal: document.getElementById("investment-modal"),
  investmentModalBackdrop: document.getElementById("investment-modal-backdrop"),
  investmentModalCloseBtn: document.getElementById("investment-modal-close-btn"),
  investmentForm: document.getElementById("investment-form"),
  investmentTicker: document.getElementById("investment-ticker"),
  investmentCategory: document.getElementById("investment-category"),
  investmentDate: document.getElementById("investment-date"),
  investmentQuantity: document.getElementById("investment-quantity"),
  investmentPrice: document.getElementById("investment-price"),

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
};

/* ---------------------------------------------------------------
   Estado interno do módulo
--------------------------------------------------------------- */
let currentMode = "personal";
let isRegisterMode = false;
let lastTransactions = [];
let lastGoals = [];
let pendingDeleteId = null;
let pendingDeleteType = "transaction";
let txnTypeFilter = "all";
let lastInvestments = [];
let cashflowChart = null;
let categoryChart = null;
let reportsCashflowChart = null;
let reportsCategoryChart = null;
let invEvolutionChart = null;
let invAllocationChart = null;

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
  investments: { title: "Investimentos", subtitle: "Acompanhe o rendimento da sua carteira de ativos" },
  reports: { title: "Relatórios", subtitle: "Análise detalhada do seu fluxo de caixa" },
  settings: { title: "Configurações", subtitle: "Preferências da sua conta EcoFy" },
};

const DELETE_META = {
  transaction: { title: "Excluir transação?", desc: "Essa ação não pode ser desfeita. Deseja continuar?" },
  goal: { title: "Excluir meta?", desc: "O progresso dessa meta será perdido. Deseja continuar?" },
  investment: { title: "Excluir ativo?", desc: "O histórico dessa posição será perdido. Deseja continuar?" },
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
  renderInvestments(lastInvestments);
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
function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function renderChangeBadge(elNode, pct, invert = false) {
  const positive = invert ? pct <= 0 : pct >= 0;
  elNode.classList.toggle("text-emerald-400", positive);
  elNode.classList.toggle("text-red-400", !positive);
  const icon = pct >= 0 ? "ph-arrow-up" : "ph-arrow-down";
  elNode.innerHTML = `<i class="ph-bold ${icon}"></i> ${Math.abs(pct).toFixed(1)}%`;
}

export function updateKPIs(transactions, goals = []) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const prevDate = new Date(thisYear, thisMonth - 1, 1);

  let currentIncome = 0, currentExpense = 0, prevIncome = 0, prevExpense = 0, totalBalance = 0;

  transactions.forEach((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    const amount = Number(t.amount) || 0;
    const signedAmount = t.type === "income" ? amount : -amount;
    totalBalance += signedAmount;

    if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) {
      if (t.type === "income") currentIncome += amount;
      else currentExpense += amount;
    } else if (d.getFullYear() === prevDate.getFullYear() && d.getMonth() === prevDate.getMonth()) {
      if (t.type === "income") prevIncome += amount;
      else prevExpense += amount;
    }
  });

  el.kpiBalance.textContent = formatCurrency(totalBalance);
  el.kpiIncome.textContent = formatCurrency(currentIncome);
  el.kpiExpense.textContent = formatCurrency(currentExpense);

  const prevBalance = prevIncome - prevExpense;
  const currBalance = currentIncome - currentExpense;
  renderChangeBadge(el.kpiBalanceChange, pctChange(currBalance, prevBalance));
  renderChangeBadge(el.kpiIncomeChange, pctChange(currentIncome, prevIncome));
  renderChangeBadge(el.kpiExpenseChange, pctChange(currentExpense, prevExpense), true);

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

export function renderFullTransactionsTable(transactions) {
  lastTransactions = transactions;
  const term = getSearchTerm();
  const categoryFilter = el.txnCategoryFilter?.value || "all";

  let filtered = transactions;
  if (txnTypeFilter !== "all") filtered = filtered.filter((t) => t.type === txnTypeFilter);
  if (categoryFilter !== "all") filtered = filtered.filter((t) => t.category === categoryFilter);
  if (term) {
    filtered = filtered.filter(
      (t) => t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term)
    );
  }

  el.txnFullCount.textContent = `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`;

  if (filtered.length === 0) {
    el.transactionsFullTbody.innerHTML = "";
    el.transactionsFullEmpty.classList.remove("hidden");
    el.transactionsFullEmpty.classList.add("flex");
    return;
  }

  el.transactionsFullEmpty.classList.add("hidden");
  el.transactionsFullEmpty.classList.remove("flex");

  el.transactionsFullTbody.innerHTML = filtered.slice(0, 300).map(buildRowHtml).join("");
  wireRowActions(el.transactionsFullTbody, transactions);
}

function refreshTransactionViews() {
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
      renderFullTransactionsTable(lastTransactions);
    });
  });
  el.txnCategoryFilter?.addEventListener("change", () => renderFullTransactionsTable(lastTransactions));
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

function buildMonthlySeries(transactions, monthsCount = 6) {
  const months = [];
  const now = new Date();
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }) });
  }

  const income = months.map(() => 0);
  const expense = months.map(() => 0);

  transactions.forEach((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx === -1) return;
    const amount = Number(t.amount) || 0;
    if (t.type === "income") income[idx] += amount;
    else expense[idx] += amount;
  });

  return { labels: months.map((m) => m.label.replace(".", "")), income, expense };
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

  const { labels, income, expense } = buildMonthlySeries(transactions, 6);
  const built = buildCashflowDatasets(el.cashflowCanvas, labels, income, expense);
  cashflowChart.data.labels = built.labels;
  cashflowChart.data.datasets = built.datasets;
  cashflowChart.update();

  // Categoria (somente despesas)
  const categoryTotals = {};
  transactions
    .filter((t) => t.type === "expense")
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
export function renderReports(transactions) {
  if (!reportsCashflowChart || !reportsCategoryChart) return;

  const { labels, income, expense } = buildMonthlySeries(transactions, 12);
  const built = buildCashflowDatasets(el.reportsCashflowCanvas, labels, income, expense);
  reportsCashflowChart.data.labels = built.labels;
  reportsCashflowChart.data.datasets = built.datasets;
  reportsCashflowChart.update();

  const totalIncome = income.reduce((a, b) => a + b, 0);
  const totalExpense = expense.reduce((a, b) => a + b, 0);
  const net = totalIncome - totalExpense;

  el.reportTotalIncome.textContent = formatCurrency(totalIncome);
  el.reportTotalExpense.textContent = formatCurrency(totalExpense);
  el.reportNet.textContent = formatCurrency(net);
  el.reportNet.classList.toggle("text-emerald-400", net >= 0);
  el.reportNet.classList.toggle("text-red-400", net < 0);

  const categoryTotals = {};
  transactions
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

  const topExpenses = transactions
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

function calcInvestmentMetrics(inv) {
  const quantity = Number(inv.quantity) || 0;
  const avgPrice = Number(inv.avgPrice) || 0;
  const currentPrice = Number(inv.currentPrice) || 0;
  const costBasis = avgPrice * quantity;
  const totalValue = currentPrice * quantity;
  const profitValue = totalValue - costBasis;
  const profitPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  return { quantity, avgPrice, currentPrice, costBasis, totalValue, profitValue, profitPct };
}

function formatQuantity(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

let editInvestmentPriceHandler = null;

export function onEditInvestmentPrice(handler) {
  editInvestmentPriceHandler = handler;
}

function renderInvestmentsTable(investments) {
  const term = (el.invSearchInput.value || "").toLowerCase().trim();
  const categoryFilter = el.invCategoryFilter.value;

  let filtered = investments;
  if (categoryFilter !== "all") filtered = filtered.filter((inv) => inv.category === categoryFilter);
  if (term) {
    filtered = filtered.filter(
      (inv) => inv.ticker.toLowerCase().includes(term) || (inv.name || "").toLowerCase().includes(term)
    );
  }

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

function updateInvestmentCharts(investments) {
  if (!invEvolutionChart || !invAllocationChart) return;

  // Capital investido acumulado por mês (custo de aquisição, não valor de
  // mercado — não temos preço histórico diário para reconstruir isso).
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
  }

  const monthlyCost = months.map(() => 0);
  investments.forEach((inv) => {
    const d = new Date(`${inv.purchaseDate}T00:00:00`);
    const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx === -1) return;
    monthlyCost[idx] += (Number(inv.avgPrice) || 0) * (Number(inv.quantity) || 0);
  });

  let running = 0;
  const cumulative = monthlyCost.map((v) => (running += v));
  const modeColor = getModeColor();

  const ctx = el.invEvolutionCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, hexToRgba(modeColor, 0.35));
  gradient.addColorStop(1, hexToRgba(modeColor, 0));

  invEvolutionChart.data.labels = months.map((m) => m.label);
  invEvolutionChart.data.datasets = [
    {
      label: "Capital investido",
      data: cumulative,
      borderColor: modeColor,
      backgroundColor: gradient,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: modeColor,
      pointBorderColor: "#0f172a",
      pointBorderWidth: 2,
      borderWidth: 2.5,
    },
  ];
  invEvolutionChart.update();

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

export function renderInvestments(investments) {
  lastInvestments = investments;
  renderInvestmentsTable(investments);
  updateInvestmentKPIs(investments);
  updateInvestmentCharts(investments);
}

export function setQuotesLoading(loading) {
  el.refreshQuotesBtn.disabled = loading;
  el.refreshQuotesBtn.classList.toggle("opacity-60", loading);
  el.refreshQuotesIcon.classList.toggle("animate-spin", loading);
}

export function bindInvestmentFilters() {
  el.invSearchInput.addEventListener("input", () => renderInvestmentsTable(lastInvestments));
  el.invCategoryFilter.addEventListener("change", () => renderInvestmentsTable(lastInvestments));
  el.invSortSelect.addEventListener("change", () => {
    invTypeSort = el.invSortSelect.value;
    renderInvestmentsTable(lastInvestments);
  });
}

/* ---------------------------------------------------------------
   Modal: Novo Investimento
--------------------------------------------------------------- */
let investmentSubmitHandler = null;

export function onInvestmentFormSubmit(handler) {
  investmentSubmitHandler = handler;
}

const INVESTMENT_DATE_PLACEHOLDER = "Selecionar data";

export function openInvestmentModal() {
  el.investmentForm.reset();
  setDatePickerValue("investment-date", "investment-date-label", todayISO(), INVESTMENT_DATE_PLACEHOLDER);
  el.investmentModal.classList.remove("hidden");
  el.investmentModal.classList.add("flex");
}

export function closeInvestmentModal() {
  el.investmentModal.classList.add("hidden");
  el.investmentModal.classList.remove("flex");
  closeDatePicker();
}

export function bindInvestmentModal() {
  el.newInvestmentBtn?.addEventListener("click", () => openInvestmentModal());
  el.investmentModalCloseBtn?.addEventListener("click", closeInvestmentModal);
  el.investmentModalBackdrop?.addEventListener("click", closeInvestmentModal);

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
    investmentSubmitHandler?.(data);
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

export function onProfileUpdate(handler) {
  profileUpdateHandler = handler;
}

export function onJoinCouple(handler) {
  joinCoupleHandler = handler;
}

export function onPasswordReset(handler) {
  passwordResetHandler = handler;
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
}

export { el as elements };
