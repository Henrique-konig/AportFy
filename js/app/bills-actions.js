// =========================================================
// AportFy — app/bills-actions.js
// Contas a pagar, cartões e faturas: assinaturas e ações.
// =========================================================

import * as ui from "../ui.js";
import { addMonthsToDate, invoicePaymentTransactions, splitInstallments } from "../calc.js";
import { addBills, addToCollection, listenToCollection, listenToSettingsDoc, payBill, payInvoice, unpayBill, unpayInvoice, updateInCollection } from "../db.js";
import { activeSpaceId, gate, session } from "./session.js";

let extraUnsubscribes = []; // contas, cartões, compras, faturas e reserva

/* ---------------------------------------------------------------
   Contas a pagar, cartões e faturas
--------------------------------------------------------------- */
export function stopExtras() {
  session.generation++;
  extraUnsubscribes.forEach((stop) => stop?.());
  extraUnsubscribes = [];
}

export function subscribeExtras(id) {
  const mode = session.activeMode;
  const watch = (name, onData) =>
    listenToCollection(
      mode,
      id,
      name,
      gate((docs, error) => {
        if (error) return ui.showToast("Erro ao carregar contas e cartões.", "error");
        onData(docs);
      })
    );
  session.latestBills = session.latestCards = session.latestPurchases = session.latestCardInvoices = [];
  ui.renderBillsData({ bills: [], cards: [], purchases: [], invoices: [] });
  extraUnsubscribes = [
    watch("bills", (docs) => ui.renderBillsData({ bills: (session.latestBills = docs) })),
    watch("cards", (docs) => ui.renderBillsData({ cards: (session.latestCards = docs) })),
    watch("cardPurchases", (docs) => ui.renderBillsData({ purchases: (session.latestPurchases = docs) })),
    watch("cardInvoices", (docs) => ui.renderBillsData({ invoices: (session.latestCardInvoices = docs) })),
    listenToSettingsDoc(mode, id, "reserve", (reserve) => ui.setPlanningData({ reserve })),
  ];
}

export const todayLocal = () => new Date().toLocaleDateString("sv-SE");

export function bindBillsActions() {
  const run = async (fn, okMessage, errorMessage) => {
    try {
      await fn();
      if (okMessage) ui.showToast(okMessage, "success");
      return true;
    } catch (err) {
      console.error(err);
      ui.showToast(errorMessage, "error");
      return false;
    }
  };

  ui.bindBills({
    saveBill: async (data, editingId) => {
      const id = activeSpaceId();
      const base = { description: data.description, amount: data.amount, category: data.category, dueDate: data.dueDate };
      let ok;
      if (editingId) {
        ok = await run(() => updateInCollection(session.activeMode, id, "bills", editingId, base), "Conta atualizada.", "Erro ao salvar a conta.");
      } else if (data.repeat === "installments") {
        const parts = splitInstallments(data.amount, data.installments);
        const day = Number(data.dueDate.slice(8, 10));
        const bills = parts.map((amount, i) => ({
          ...base,
          description: `${data.description} (${i + 1}/${parts.length})`.slice(0, 200),
          amount,
          dueDate: addMonthsToDate(data.dueDate, i, day),
          paid: false,
          paidAt: null,
          recurring: false,
          installment: i + 1,
          installments: parts.length,
        }));
        ok = await run(() => addBills(session.activeMode, id, bills), `${parts.length} parcelas criadas.`, "Erro ao salvar as parcelas.");
      } else {
        const recurring = data.repeat === "monthly";
        const bill = { ...base, paid: false, paidAt: null, recurring, ...(recurring ? { dayOfMonth: Number(data.dueDate.slice(8, 10)) } : {}) };
        ok = await run(() => addToCollection(session.activeMode, id, "bills", bill), "Conta criada.", "Erro ao salvar a conta.");
      }
      if (ok) ui.closeBillModal();
    },

    payBill: async (bill) => {
      if (!bill) return;
      let next = null;
      if (bill.recurring) {
        const dueDate = addMonthsToDate(bill.dueDate, 1, bill.dayOfMonth || Number(bill.dueDate.slice(8, 10)));
        // Pagou, desfez e pagou de novo: a do mês seguinte já existe, não duplica.
        const exists = session.latestBills.some((b) => b.recurring && b.description === bill.description && b.dueDate === dueDate);
        if (!exists) {
          next = { description: bill.description, amount: Number(bill.amount), category: bill.category, dueDate, paid: false, paidAt: null, recurring: true, dayOfMonth: bill.dayOfMonth || Number(bill.dueDate.slice(8, 10)) };
        }
      }
      await run(() => payBill(session.activeMode, activeSpaceId(), bill, todayLocal(), next), next ? "Conta paga! A do próximo mês já foi criada." : "Conta paga e lançada nas despesas.", "Erro ao pagar a conta.");
    },

    unpayBill: async (bill) => {
      if (!bill) return;
      await run(() => unpayBill(session.activeMode, activeSpaceId(), bill), "Pagamento desfeito (a despesa foi removida).", "Erro ao desfazer o pagamento.");
    },

    saveCard: async (data, editingId) => {
      const id = activeSpaceId();
      const ok = editingId
        ? await run(() => updateInCollection(session.activeMode, id, "cards", editingId, data), "Cartão atualizado.", "Erro ao salvar o cartão.")
        : await run(() => addToCollection(session.activeMode, id, "cards", data), "Cartão criado.", "Erro ao salvar o cartão.");
      if (ok) ui.closeCardModal();
    },

    savePurchase: async (data, editingId) => {
      const id = activeSpaceId();
      const ok = editingId
        ? await run(() => updateInCollection(session.activeMode, id, "cardPurchases", editingId, data), "Compra atualizada.", "Erro ao salvar a compra.")
        : await run(() => addToCollection(session.activeMode, id, "cardPurchases", data), data.installments > 1 ? `Compra em ${data.installments}x registrada.` : "Compra registrada.", "Erro ao salvar a compra.");
      if (ok) ui.closePurchaseModal();
    },

    payInvoice: async (card, invoice) => {
      const today = todayLocal();
      const transactions = invoicePaymentTransactions(card, invoice, today);
      if (transactions.length > 450) return ui.showToast("Fatura com itens demais para pagar de uma vez.", "error");
      await run(
        () => payInvoice(session.activeMode, activeSpaceId(), card.id, invoice.month, invoice.total, transactions, today),
        "Fatura paga! As compras entraram nas despesas com as categorias de cada uma.",
        "Erro ao pagar a fatura."
      );
    },

    unpayInvoice: async (card, invoice) => {
      await run(
        () => unpayInvoice(session.activeMode, activeSpaceId(), card.id, invoice.month, invoice.transactionIds || []),
        "Pagamento da fatura desfeito.",
        "Erro ao desfazer o pagamento da fatura."
      );
    },
  });
}
