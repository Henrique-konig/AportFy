// =========================================================
// AportFy — ui/forms.js
// Componentes de formulário compartilhados (datas, dropdowns) e o modal de exclusão.
// =========================================================

import { attachDatePicker } from "../datepicker.js";
import { enhanceSelect } from "../dropdown.js";
import { DELETE_META, el, state } from "./core.js";
import { DIVIDEND_DATE_PLACEHOLDER } from "./dividends.js";
import { GOAL_DEADLINE_PLACEHOLDER } from "./goals.js";
import { INVESTMENT_DATE_PLACEHOLDER, SELL_DATE_PLACEHOLDER } from "./investments.js";
import { TRANSACTION_DATE_PLACEHOLDER } from "./transactions.js";

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
  attachDatePicker({
    triggerId: "sell-date-trigger",
    labelId: "sell-date-label",
    hiddenInputId: "sell-date",
    placeholder: SELL_DATE_PLACEHOLDER,
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
    "div-panel-month-filter",
    "health-preset",
    "hist-asset-filter",
    "hist-month-filter",
    "proj-years",
    "dividend-ticker",
    "dividend-type",
  ].forEach(enhanceSelect);
}

/* ---------------------------------------------------------------
   Modal: Confirmar Exclusão (genérico p/ transações e metas)
--------------------------------------------------------------- */
export let deleteConfirmHandler = null;

export function onDeleteConfirm(handler) {
  deleteConfirmHandler = handler;
}

export function openDeleteModal(id, type = "transaction") {
  state.pendingDeleteId = id;
  state.pendingDeleteType = type;
  const meta = DELETE_META[type] || DELETE_META.transaction;
  el.deleteModalTitle.textContent = meta.title;
  el.deleteModalDesc.textContent = meta.desc;
  el.deleteModal.classList.remove("hidden");
  el.deleteModal.classList.add("flex");
}

export function closeDeleteModal() {
  state.pendingDeleteId = null;
  el.deleteModal.classList.add("hidden");
  el.deleteModal.classList.remove("flex");
}

export function bindDeleteModal() {
  el.deleteCancelBtn.addEventListener("click", closeDeleteModal);
  el.deleteModalBackdrop.addEventListener("click", closeDeleteModal);
  el.deleteConfirmBtn.addEventListener("click", () => {
    if (state.pendingDeleteId) deleteConfirmHandler?.(state.pendingDeleteId, state.pendingDeleteType);
    closeDeleteModal();
  });
}

