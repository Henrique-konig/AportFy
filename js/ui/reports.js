// =========================================================
// AportFy — ui/reports.js
// Aba Relatórios.
// =========================================================

import { refreshDropdown } from "../dropdown.js";
import { buildMonthlySeries } from "../calc.js";
import { buildCashflowDatasets } from "./charts.js";
import { CATEGORY_COLORS, el, escapeHtml, formatCurrency, formatDate, state, todayISO } from "./core.js";
import { formatMonthLabel } from "./dividends.js";

/* ---------------------------------------------------------------
   Relatórios (view: Relatórios)
--------------------------------------------------------------- */
export function reportsPeriodDate() {
  if (state.reportsPeriodFilterValue === "all") return new Date();
  const [y, m] = state.reportsPeriodFilterValue.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Repopula o filtro de período dos relatórios com "Todos os meses" + o mês atual + os meses com transações. */
export function populateReportsPeriodFilter(transactions) {
  if (!el.reportsPeriodFilter) return;
  const currentMonth = todayISO().slice(0, 7);
  const months = [...new Set([currentMonth, ...transactions.map((t) => t.date.slice(0, 7))])].sort().reverse();
  const current = el.reportsPeriodFilter.value || state.reportsPeriodFilterValue;

  el.reportsPeriodFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.reportsPeriodFilter.value = current === "all" || months.includes(current) ? current : currentMonth;
  state.reportsPeriodFilterValue = el.reportsPeriodFilter.value;
  refreshDropdown("reports-period-filter");
}

export function bindReportsFilters() {
  el.reportsPeriodFilter?.addEventListener("change", () => {
    state.reportsPeriodFilterValue = el.reportsPeriodFilter.value;
    renderReports(state.lastTransactions);
  });
}

export function renderReports(transactions) {
  if (!state.reportsCashflowChart || !state.reportsCategoryChart) return;
  state.lastTransactions = transactions;
  populateReportsPeriodFilter(transactions);

  const isAllPeriod = state.reportsPeriodFilterValue === "all";
  const periodTransactions = transactions.filter((t) => isAllPeriod || t.date.slice(0, 7) === state.reportsPeriodFilterValue);

  const { labels, income, expense } = buildMonthlySeries(transactions, 12, reportsPeriodDate());
  const built = buildCashflowDatasets(el.reportsCashflowCanvas, labels, income, expense);
  state.reportsCashflowChart.data.labels = built.labels;
  state.reportsCashflowChart.data.datasets = built.datasets;
  state.reportsCashflowChart.update();

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

  const periodLabel = isAllPeriod ? "Todos os meses" : formatMonthLabel(state.reportsPeriodFilterValue);
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

  state.reportsCategoryChart.data.labels = sortedCategories.map((c) => c[0]);
  state.reportsCategoryChart.data.datasets = [
    {
      data: sortedCategories.map((c) => c[1]),
      backgroundColor: sortedCategories.map((c) => CATEGORY_COLORS[c[0]] || CATEGORY_COLORS["Outros"]),
      borderRadius: 6,
      barThickness: 18,
    },
  ];
  state.reportsCategoryChart.update();

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

