// =========================================================
// AportFy — app/bind-finance.js
// Ligações das telas de transações, recorrências, metas e orçamento.
// =========================================================

import * as ui from "../ui.js";
import { addGoal, addRecurrence, addTransaction, updateGoal, updateRecurrence, updateTransaction, upsertBudget } from "../db.js";
import { session } from "./session.js";

export function bindFinance() {
  /* -------------------- Transações -------------------- */
  ui.onTransactionFormSubmit(async (data, editingId) => {
    try {
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      if (editingId) {
        await updateTransaction(session.activeMode, id, editingId, data);
        ui.showToast("Transação atualizada com sucesso!", "success");
      } else {
        await addTransaction(session.activeMode, id, data);
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
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      if (editingId) {
        await updateRecurrence(session.activeMode, id, editingId, data);
        ui.showToast("Recorrência atualizada com sucesso!", "success");
      } else {
        await addRecurrence(session.activeMode, id, data);
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
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      if (editingId) {
        await updateGoal(session.activeMode, id, editingId, data);
        ui.showToast("Meta atualizada com sucesso!", "success");
      } else {
        await addGoal(session.activeMode, id, data);
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
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      await upsertBudget(session.activeMode, id, category, monthlyLimit);
      ui.showToast("Orçamento salvo com sucesso!", "success");
      ui.closeBudgetModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar orçamento.", "error");
    }
  });

  ui.onEditBudget((budget) => ui.openBudgetModal(budget));
}
