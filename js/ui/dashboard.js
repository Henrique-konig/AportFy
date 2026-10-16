// =========================================================
// AportFy — ui/dashboard.js
// KPIs e filtro de período do Dashboard.
// =========================================================

import { refreshDropdown } from "../dropdown.js";
import { pctChange } from "../calc.js";
import { updateCharts } from "./charts.js";
import { el, formatCurrency, state, todayISO } from "./core.js";
import { formatMonthLabel } from "./dividends.js";
import { scheduleAlertsRender } from "./alerts.js";

/* ---------------------------------------------------------------
   KPIs
--------------------------------------------------------------- */
export function renderChangeBadge(elNode, pct, invert = false) {
  const positive = invert ? pct <= 0 : pct >= 0;
  elNode.classList.toggle("text-emerald-400", positive);
  elNode.classList.toggle("text-red-400", !positive);
  const icon = pct >= 0 ? "ph-arrow-up" : "ph-arrow-down";
  elNode.innerHTML = `<i class="ph-bold ${icon}"></i> ${Math.abs(pct).toFixed(1)}%`;
}

export function dashPeriodDate() {
  if (state.dashPeriodFilterValue === "all") return new Date();
  const [y, m] = state.dashPeriodFilterValue.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Repopula o filtro de período do dashboard com "Todos os meses" + o mês atual + os meses com transações. */
export function populateDashboardPeriodFilter(transactions) {
  if (!el.dashboardPeriodFilter) return;
  const currentMonth = todayISO().slice(0, 7);
  const months = [...new Set([currentMonth, ...transactions.map((t) => t.date.slice(0, 7))])].sort().reverse();
  const current = el.dashboardPeriodFilter.value || state.dashPeriodFilterValue;

  el.dashboardPeriodFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.dashboardPeriodFilter.value = current === "all" || months.includes(current) ? current : currentMonth;
  state.dashPeriodFilterValue = el.dashboardPeriodFilter.value;
  refreshDropdown("dashboard-period-filter");
}

export function bindDashboardFilters() {
  el.dashboardPeriodFilter?.addEventListener("change", () => {
    state.dashPeriodFilterValue = el.dashboardPeriodFilter.value;
    updateKPIs(state.lastTransactions, state.lastGoals);
    updateCharts(state.lastTransactions);
  });
}

export function updateKPIs(transactions, goals = []) {
  scheduleAlertsRender();
  state.lastTransactions = transactions;
  state.lastGoals = goals;
  populateDashboardPeriodFilter(transactions);

  const isAllPeriod = state.dashPeriodFilterValue === "all";
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

