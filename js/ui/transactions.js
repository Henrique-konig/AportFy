// =========================================================
// AportFy — ui/transactions.js
// Tabelas, filtros e modais de transações, além das recorrências.
// =========================================================

import { setDatePickerValue, closeDatePicker } from "../datepicker.js";
import { refreshDropdown } from "../dropdown.js";
import { CATEGORY_COLORS, TXN_PAGE_SIZE, el, escapeHtml, formatCurrency, formatDate, showToast, state, todayISO } from "./core.js";
import { formatMonthLabel } from "./dividends.js";
import { openDeleteModal } from "./forms.js";

/* ---------------------------------------------------------------
   Tabela de Transações (Dashboard + view completa)
--------------------------------------------------------------- */
export let editHandler = null;
export let deleteHandler = null;

export function onEditTransaction(handler) {
  editHandler = handler;
}

export function onDeleteTransaction(handler) {
  deleteHandler = handler;
}

export function buildRowHtml(t) {
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

export function wireRowActions(tbody, transactions) {
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

export function getSearchTerm() {
  return (el.searchInput.value || el.mobileSearchInput?.value || "").toLowerCase().trim();
}

export function renderTransactionsTable(transactions) {
  state.lastTransactions = transactions;
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
export function populateTransactionMonthFilter(transactions) {
  if (!el.txnMonthFilter) return;
  const months = [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  const current = el.txnMonthFilter.value;

  el.txnMonthFilter.innerHTML =
    `<option value="all">Todos os meses</option>` + months.map((m) => `<option value="${m}">${formatMonthLabel(m)}</option>`).join("");

  el.txnMonthFilter.value = months.includes(current) ? current : "all";
  state.txnMonthFilterValue = el.txnMonthFilter.value;
  refreshDropdown("txn-month-filter");
}

export function renderFullTransactionsTable(transactions) {
  state.lastTransactions = transactions;
  populateTransactionMonthFilter(transactions);

  const term = getSearchTerm();
  const categoryFilter = el.txnCategoryFilter?.value || "all";

  let filtered = transactions;
  if (state.txnTypeFilter !== "all") filtered = filtered.filter((t) => t.type === state.txnTypeFilter);
  if (state.txnMonthFilterValue !== "all") filtered = filtered.filter((t) => t.date.slice(0, 7) === state.txnMonthFilterValue);
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

  el.transactionsFullTbody.innerHTML = filtered.slice(0, state.txnVisibleCount).map(buildRowHtml).join("");
  wireRowActions(el.transactionsFullTbody, transactions);

  const remaining = filtered.length - state.txnVisibleCount;
  if (remaining > 0) {
    el.txnLoadMoreWrap.classList.remove("hidden");
    el.txnLoadMoreWrap.classList.add("flex");
    el.txnLoadMoreRemaining.textContent = `(${remaining})`;
  } else {
    el.txnLoadMoreWrap.classList.add("hidden");
    el.txnLoadMoreWrap.classList.remove("flex");
  }
}

export function refreshTransactionViews() {
  state.txnVisibleCount = TXN_PAGE_SIZE;
  renderTransactionsTable(state.lastTransactions);
  renderFullTransactionsTable(state.lastTransactions);
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
      state.txnTypeFilter = btn.dataset.filterType;
      el.txnFilterBtns.forEach((b) => b.classList.toggle("active-filter", b === btn));
      state.txnVisibleCount = TXN_PAGE_SIZE;
      renderFullTransactionsTable(state.lastTransactions);
    });
  });
  el.txnCategoryFilter?.addEventListener("change", () => {
    state.txnVisibleCount = TXN_PAGE_SIZE;
    renderFullTransactionsTable(state.lastTransactions);
  });
  el.txnMonthFilter?.addEventListener("change", () => {
    state.txnMonthFilterValue = el.txnMonthFilter.value;
    state.txnVisibleCount = TXN_PAGE_SIZE;
    renderFullTransactionsTable(state.lastTransactions);
  });
  el.txnLoadMoreBtn?.addEventListener("click", () => {
    state.txnVisibleCount += TXN_PAGE_SIZE;
    renderFullTransactionsTable(state.lastTransactions);
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
   Modal: Nova / Editar Transação
--------------------------------------------------------------- */
export let transactionSubmitHandler = null;

export function onTransactionFormSubmit(handler) {
  transactionSubmitHandler = handler;
}

export function setTransactionType(type) {
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

export const TRANSACTION_DATE_PLACEHOLDER = "Selecionar data";

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
export function setRecurrenceType(type) {
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

export let editRecurrenceHandler = null;

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

export let recurrenceSubmitHandler = null;

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

