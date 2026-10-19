// =========================================================
// AportFy — ui/budget.js
// Aba Orçamento.
// =========================================================

import { refreshDropdown } from "../dropdown.js";
import { calcBudgetSpent } from "../calc.js";
import { delegateClick, CATEGORY_COLORS, EXPENSE_CATEGORIES, el, escapeHtml, formatCurrency, getModeColor, showToast, state } from "./core.js";
import { openDeleteModal } from "./forms.js";
import { scheduleAlertsRender } from "./alerts.js";

/* ---------------------------------------------------------------
   Orçamento por categoria (view: Orçamento)
--------------------------------------------------------------- */
export let editBudgetHandler = null;

export function onEditBudget(handler) {
  editBudgetHandler = handler;
}

export function renderBudgets(budgets, transactions) {
  scheduleAlertsRender();
  state.lastBudgets = budgets;
  state.lastTransactions = transactions;

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

  delegateClick(el.budgetGrid, ".edit-budget-btn", (btn) => {
    const b = budgets.find((x) => x.category === btn.dataset.category);
    if (b && editBudgetHandler) editBudgetHandler(b);
  });
  delegateClick(el.budgetGrid, ".delete-budget-btn", (btn) => openDeleteModal(btn.dataset.category, "budget"));
}

export let budgetSubmitHandler = null;

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
    const usedCategories = state.lastBudgets.map((b) => b.category);
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
    if (state.lastBudgets.length >= EXPENSE_CATEGORIES.length) {
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

