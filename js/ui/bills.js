// =========================================================
// AportFy — ui/bills.js
// Aba "Contas e Cartões": contas a pagar, cartões de crédito,
// compras parceladas e faturas.
// =========================================================

import { enhanceSelect, refreshDropdown } from "../dropdown.js";
import { attachDatePicker, setDatePickerValue, closeDatePicker } from "../datepicker.js";
import { billStatus, billsSummary, cardSummary, invoiceForMonth, invoiceMonthOf, invoiceStatus, shiftMonth, splitInstallments, unpaidInvoices } from "../calc.js";
import { escapeHtml, formatCurrency, formatDate, todayISO } from "./core.js";
import { openDeleteModal } from "./forms.js";
import { scheduleAlertsRender } from "./alerts.js";
import { formatMonthLabel } from "./dividends.js";

/** Dados da aba (o app entrega a cada mudança no Firestore). */
export const billsState = { bills: [], cards: [], purchases: [], invoices: [], filter: "pending" };

let actions = {};
let invoiceView = { cardId: null, month: null };

const bEl = {
  kpiToPay: document.getElementById("bills-kpi-topay"),
  kpiOverdue: document.getElementById("bills-kpi-overdue"),
  kpiOverdueCount: document.getElementById("bills-kpi-overdue-count"),
  kpiPaid: document.getElementById("bills-kpi-paid"),
  kpiInvoices: document.getElementById("bills-kpi-invoices"),
  kpiInvoicesNote: document.getElementById("bills-kpi-invoices-note"),
  list: document.getElementById("bills-list"),
  empty: document.getElementById("bills-empty"),
  emptyText: document.getElementById("bills-empty-text"),
  filterBtns: document.querySelectorAll("[data-bill-filter]"),
  newBillBtn: document.getElementById("new-bill-btn"),
  cardsList: document.getElementById("cards-list"),
  cardsEmpty: document.getElementById("cards-empty"),
  newCardBtn: document.getElementById("new-card-btn"),

  billModal: document.getElementById("bill-modal"),
  billModalTitle: document.getElementById("bill-modal-title"),
  billForm: document.getElementById("bill-form"),
  billId: document.getElementById("bill-id"),
  billDescription: document.getElementById("bill-description"),
  billAmount: document.getElementById("bill-amount"),
  billCategory: document.getElementById("bill-category"),
  billRepeatWrap: document.getElementById("bill-repeat-wrap"),
  billRepeat: document.getElementById("bill-repeat"),
  billInstallmentsWrap: document.getElementById("bill-installments-wrap"),
  billInstallments: document.getElementById("bill-installments"),

  cardModal: document.getElementById("card-modal"),
  cardModalTitle: document.getElementById("card-modal-title"),
  cardForm: document.getElementById("card-form"),
  cardId: document.getElementById("card-id"),
  cardName: document.getElementById("card-name"),
  cardLimit: document.getElementById("card-limit"),
  cardClosingDay: document.getElementById("card-closing-day"),
  cardDueDay: document.getElementById("card-due-day"),

  purchaseModal: document.getElementById("purchase-modal"),
  purchaseModalTitle: document.getElementById("purchase-modal-title"),
  purchaseForm: document.getElementById("purchase-form"),
  purchaseId: document.getElementById("purchase-id"),
  purchaseCard: document.getElementById("purchase-card"),
  purchaseDescription: document.getElementById("purchase-description"),
  purchaseAmount: document.getElementById("purchase-amount"),
  purchaseInstallments: document.getElementById("purchase-installments"),
  purchaseHint: document.getElementById("purchase-installment-hint"),
  purchaseCategory: document.getElementById("purchase-category"),

  invoiceModal: document.getElementById("invoice-modal"),
  invoiceTitle: document.getElementById("invoice-modal-title"),
  invoiceMonth: document.getElementById("invoice-month"),
  invoicePrev: document.getElementById("invoice-prev"),
  invoiceNext: document.getElementById("invoice-next"),
  invoiceTotal: document.getElementById("invoice-total"),
  invoiceStatus: document.getElementById("invoice-status"),
  invoiceDates: document.getElementById("invoice-dates"),
  invoiceItems: document.getElementById("invoice-items"),
  invoicePayBtn: document.getElementById("invoice-pay-btn"),
  invoiceUnpayBtn: document.getElementById("invoice-unpay-btn"),
  invoiceAddPurchaseBtn: document.getElementById("invoice-add-purchase-btn"),
  invoiceEditCardBtn: document.getElementById("invoice-edit-card-btn"),
  invoiceDeleteCardBtn: document.getElementById("invoice-delete-card-btn"),
};

const BILL_DATE_PLACEHOLDER = "Selecionar data";
const shortDate = (iso) => formatDate(iso).slice(0, 5);
const monthShort = (yyyyMm) => {
  const label = formatMonthLabel(yyyyMm);
  return `${label.slice(0, 3)}/${yyyyMm.slice(2, 4)}`;
};
const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000);

const STATUS_STYLE = {
  overdue: { chip: "bg-red-500/15 text-red-400", icon: "ph-warning-circle" },
  soon: { chip: "bg-amber-500/15 text-amber-400", icon: "ph-clock" },
  pending: { chip: "bg-blue-500/15 text-blue-400", icon: "ph-receipt" },
  paid: { chip: "bg-emerald-500/15 text-emerald-400", icon: "ph-check-circle" },
};
const INVOICE_STATUS = {
  open: { label: "Aberta", chip: "bg-blue-500/15 text-blue-400" },
  closed: { label: "Fechada", chip: "bg-amber-500/15 text-amber-400" },
  overdue: { label: "Vencida", chip: "bg-red-500/15 text-red-400" },
  paid: { label: "Paga", chip: "bg-emerald-500/15 text-emerald-400" },
};

function billStatusText(bill, status) {
  if (status === "paid") return `Paga em ${shortDate(bill.paidAt || bill.dueDate)}`;
  if (status === "overdue") return `Venceu em ${shortDate(bill.dueDate)}`;
  const days = daysUntil(bill.dueDate);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (status === "soon") return `Vence em ${days} dias`;
  return `Vence em ${formatDate(bill.dueDate)}`;
}

/** Faturas não pagas de todos os cartões (alertas, saldo projetado). */
export function currentUnpaidInvoices() {
  return unpaidInvoices(billsState.cards, billsState.purchases, billsState.invoices);
}

/** Recebe dados novos (qualquer subconjunto) e redesenha a aba. */
export function renderBillsData(partial) {
  Object.assign(billsState, partial);
  renderBillsView();
  if (!bEl.invoiceModal?.classList.contains("hidden")) renderInvoiceModal();
  scheduleAlertsRender();
}

export function renderBillsView() {
  if (!bEl.list) return;
  const today = todayISO();

  // KPIs
  const summary = billsSummary(billsState.bills, today);
  bEl.kpiToPay.textContent = formatCurrency(summary.toPay);
  bEl.kpiOverdue.textContent = formatCurrency(summary.overdue);
  bEl.kpiOverdueCount.textContent = summary.overdueCount === 0 ? "Nenhuma" : `${summary.overdueCount} conta${summary.overdueCount === 1 ? "" : "s"}`;
  bEl.kpiPaid.textContent = formatCurrency(summary.paid);
  const closedInvoices = currentUnpaidInvoices().filter((i) => today >= i.closingDate);
  bEl.kpiInvoices.textContent = formatCurrency(closedInvoices.reduce((s, i) => s + i.total, 0));
  bEl.kpiInvoicesNote.textContent =
    closedInvoices.length === 0 ? "Nenhuma fechada" : `${closedInvoices.length} fatura${closedInvoices.length === 1 ? "" : "s"} · próxima vence ${shortDate(closedInvoices[0].dueDate)}`;

  // Filtro
  bEl.filterBtns.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.billFilter === billsState.filter)));

  let list = billsState.bills.slice();
  if (billsState.filter === "pending") list = list.filter((b) => !b.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  else if (billsState.filter === "paid") list = list.filter((b) => b.paid).sort((a, b) => String(b.paidAt || b.dueDate).localeCompare(String(a.paidAt || a.dueDate)));
  else list.sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  bEl.empty.classList.toggle("hidden", list.length > 0);
  bEl.empty.classList.toggle("flex", list.length === 0);
  bEl.emptyText.textContent =
    billsState.filter === "paid" ? "Nenhuma conta paga ainda." : billsState.filter === "pending" ? "Nenhuma conta a pagar. 🎉" : "Nenhuma conta cadastrada.";

  bEl.list.innerHTML = list
    .map((b) => {
      const status = billStatus(b, today);
      const style = STATUS_STYLE[status];
      const tags = [b.category, b.recurring ? "Mensal" : "", b.installments > 1 ? `Parcela ${b.installment}/${b.installments}` : ""].filter(Boolean).join(" · ");
      return `
      <div class="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 rounded-xl px-3.5 py-3">
        <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.chip}"><i class="ph-bold ${style.icon}"></i></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate">${escapeHtml(b.description)}</p>
          <p class="text-xs text-slate-500 truncate"><span class="${status === "overdue" ? "text-red-400" : status === "soon" ? "text-amber-400" : ""}">${billStatusText(b, status)}</span>${tags ? ` · ${escapeHtml(tags)}` : ""}</p>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <p class="text-sm font-bold">${formatCurrency(b.amount)}</p>
          <div class="flex items-center gap-0.5">
            ${
              b.paid
                ? `<button type="button" data-bill-unpay="${escapeHtml(b.id)}" class="row-action-btn text-slate-500 hover:text-amber-400 p-1.5 rounded-lg transition-colors" title="Desfazer pagamento"><i class="ph-bold ph-arrow-counter-clockwise"></i></button>`
                : `<button type="button" data-bill-pay="${escapeHtml(b.id)}" class="row-action-btn text-slate-500 hover:text-emerald-400 p-1.5 rounded-lg transition-colors" title="Marcar como paga"><i class="ph-bold ph-check"></i></button>`
            }
            <button type="button" data-bill-edit="${escapeHtml(b.id)}" class="row-action-btn text-slate-500 hover:text-blue-400 p-1.5 rounded-lg transition-colors" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
            <button type="button" data-bill-delete="${escapeHtml(b.id)}" class="row-action-btn text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors" title="Excluir"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>
      </div>`;
    })
    .join("");

  renderCards(today);
}

function renderCards(today) {
  const cards = billsState.cards.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  bEl.cardsEmpty.classList.toggle("hidden", cards.length > 0);
  bEl.cardsEmpty.classList.toggle("flex", cards.length === 0);
  bEl.cardsList.innerHTML = cards
    .map((card) => {
      const sum = cardSummary(card, billsState.purchases, billsState.invoices, today);
      const cur = sum.current;
      const curStatus = INVOICE_STATUS[invoiceStatus(cur, today)];
      const usedPct = sum.limit > 0 ? Math.min(100, (sum.used / sum.limit) * 100) : 0;
      const toPay =
        sum.toPay && sum.toPay.month !== cur.month
          ? `<div class="mt-3 flex items-center justify-between gap-2 rounded-lg ${today > sum.toPay.dueDate ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"} px-3 py-2 text-xs">
               <span class="min-w-0">Fatura de ${monthShort(sum.toPay.month)}: <strong>${formatCurrency(sum.toPay.total)}</strong> · vence ${shortDate(sum.toPay.dueDate)}</span>
               <button type="button" data-card-open="${escapeHtml(card.id)}" data-month="${sum.toPay.month}" class="font-semibold underline shrink-0">Pagar</button>
             </div>`
          : "";
      const limit =
        sum.limit > 0
          ? `<div class="mt-3">
               <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden" aria-hidden="true"><div class="h-full rounded-full ${usedPct >= 90 ? "bg-red-500" : "bg-blue-500"}" style="width:${usedPct}%"></div></div>
               <p class="text-[11px] text-slate-500 mt-1.5">Limite usado ${formatCurrency(sum.used)} de ${formatCurrency(sum.limit)} · disponível ${formatCurrency(sum.available)}</p>
             </div>`
          : "";
      return `
      <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold truncate flex items-center gap-2 min-w-0"><i class="ph-fill ph-credit-card text-blue-400 shrink-0"></i><span class="truncate">${escapeHtml(card.name)}</span></p>
          <button type="button" data-card-open="${escapeHtml(card.id)}" data-month="${cur.month}" class="text-xs font-semibold text-blue-400 hover:text-blue-300 shrink-0">Ver fatura</button>
        </div>
        <div class="mt-3 flex items-end justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[11px] text-slate-500">Fatura de ${monthShort(cur.month)} <span class="ml-1 px-1.5 py-0.5 rounded-full ${curStatus.chip}">${curStatus.label}</span></p>
            <p class="text-lg font-extrabold mt-0.5">${formatCurrency(cur.total)}</p>
            <p class="text-[11px] text-slate-500">Fecha ${shortDate(cur.closingDate)} · vence ${shortDate(cur.dueDate)}</p>
          </div>
          <button type="button" data-card-purchase="${escapeHtml(card.id)}" class="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all shrink-0"><i class="ph-bold ph-plus"></i> Compra</button>
        </div>
        ${toPay}
        ${limit}
      </div>`;
    })
    .join("");
}

/* ---------------------------------------------------------------
   Modais
--------------------------------------------------------------- */
function showModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}
function hideModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  closeDatePicker();
}

export function openBillModal(bill = null) {
  bEl.billForm.reset();
  bEl.billId.value = bill?.id || "";
  bEl.billModalTitle.textContent = bill ? "Editar conta" : "Nova conta";
  bEl.billDescription.value = bill?.description || "";
  bEl.billAmount.value = bill?.amount ?? "";
  bEl.billCategory.value = bill?.category || "Moradia";
  setDatePickerValue("bill-due", "bill-due-label", bill?.dueDate || todayISO(), BILL_DATE_PLACEHOLDER);
  bEl.billRepeat.value = "none";
  bEl.billRepeatWrap.classList.toggle("hidden", !!bill);
  bEl.billInstallmentsWrap.classList.add("hidden");
  refreshDropdown("bill-category");
  refreshDropdown("bill-repeat");
  showModal(bEl.billModal);
}

export function openCardModal(card = null) {
  bEl.cardForm.reset();
  bEl.cardId.value = card?.id || "";
  bEl.cardModalTitle.textContent = card ? "Editar cartão" : "Novo cartão";
  bEl.cardName.value = card?.name || "";
  bEl.cardLimit.value = card?.limit || "";
  bEl.cardClosingDay.value = card?.closingDay || "";
  bEl.cardDueDay.value = card?.dueDay || "";
  showModal(bEl.cardModal);
}

function populatePurchaseCards(selectedId) {
  bEl.purchaseCard.innerHTML = billsState.cards.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
  if (selectedId) bEl.purchaseCard.value = selectedId;
  refreshDropdown("purchase-card");
}

function updatePurchaseHint() {
  const card = billsState.cards.find((c) => c.id === bEl.purchaseCard.value);
  const amount = Number(bEl.purchaseAmount.value) || 0;
  const n = Math.max(1, Math.floor(Number(bEl.purchaseInstallments.value) || 1));
  const date = document.getElementById("purchase-date").value;
  if (!card || amount <= 0 || !date) {
    bEl.purchaseHint.textContent = "";
    return;
  }
  const parts = splitInstallments(amount, n);
  const first = invoiceMonthOf(date, card.closingDay);
  bEl.purchaseHint.textContent =
    n > 1
      ? `${n}x de ${formatCurrency(parts[n - 1])}${parts[0] !== parts[n - 1] ? ` (1ª de ${formatCurrency(parts[0])})` : ""} · de ${monthShort(first)} a ${monthShort(shiftMonth(first, n - 1))}`
      : `Entra na fatura de ${monthShort(first)}.`;
}

export function openPurchaseModal(cardId = null, purchase = null) {
  if (billsState.cards.length === 0) {
    openCardModal();
    return;
  }
  bEl.purchaseForm.reset();
  bEl.purchaseId.value = purchase?.id || "";
  bEl.purchaseModalTitle.textContent = purchase ? "Editar compra" : "Nova compra no cartão";
  populatePurchaseCards(purchase?.cardId || cardId || billsState.cards[0].id);
  bEl.purchaseDescription.value = purchase?.description || "";
  bEl.purchaseAmount.value = purchase?.amount ?? "";
  bEl.purchaseInstallments.value = purchase?.installments || 1;
  bEl.purchaseCategory.value = purchase?.category || "Outros";
  setDatePickerValue("purchase-date", "purchase-date-label", purchase?.purchaseDate || todayISO(), BILL_DATE_PLACEHOLDER);
  refreshDropdown("purchase-category");
  updatePurchaseHint();
  showModal(bEl.purchaseModal);
}

export function openInvoiceModal(cardId, month) {
  const card = billsState.cards.find((c) => c.id === cardId);
  if (!card) return;
  invoiceView = { cardId, month: month || invoiceMonthOf(todayISO(), card.closingDay) };
  renderInvoiceModal();
  showModal(bEl.invoiceModal);
}

function currentInvoice() {
  const card = billsState.cards.find((c) => c.id === invoiceView.cardId);
  if (!card) return null;
  return { card, invoice: invoiceForMonth(card, billsState.purchases, billsState.invoices, invoiceView.month) };
}

function renderInvoiceModal() {
  const data = currentInvoice();
  if (!data) {
    hideModal(bEl.invoiceModal);
    return;
  }
  const { card, invoice } = data;
  const today = todayISO();
  const status = invoiceStatus(invoice, today);
  const meta = INVOICE_STATUS[status];

  bEl.invoiceTitle.textContent = `Fatura ${card.name}`;
  const monthLabel = formatMonthLabel(invoice.month);
  bEl.invoiceMonth.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  bEl.invoiceTotal.textContent = formatCurrency(invoice.total);
  bEl.invoiceStatus.className = `text-[11px] font-semibold px-2.5 py-1 rounded-full ${meta.chip}`;
  bEl.invoiceStatus.textContent = meta.label;
  bEl.invoiceDates.textContent =
    `Fecha em ${formatDate(invoice.closingDate)} · vence em ${formatDate(invoice.dueDate)}` + (invoice.paid && invoice.paidAt ? ` · paga em ${formatDate(invoice.paidAt)}` : "");

  bEl.invoiceItems.innerHTML =
    invoice.items.length === 0
      ? `<p class="text-xs text-slate-500 text-center py-6">Nenhuma compra nesta fatura.</p>`
      : invoice.items
          .map(
            (it) => `
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-900/40">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">${escapeHtml(it.description)}${it.installments > 1 ? ` <span class="text-slate-500">(${it.installment}/${it.installments})</span>` : ""}</p>
            <p class="text-[11px] text-slate-500 truncate">${escapeHtml(it.category || "Outros")} · compra em ${shortDate(it.purchaseDate)}</p>
          </div>
          <p class="text-sm font-semibold shrink-0">${formatCurrency(it.amount)}</p>
          <div class="flex items-center shrink-0">
            <button type="button" data-purchase-edit="${escapeHtml(it.purchaseId)}" class="row-action-btn text-slate-500 hover:text-blue-400 p-1.5 rounded-lg transition-colors" title="Editar compra"><i class="ph-bold ph-pencil-simple"></i></button>
            <button type="button" data-purchase-delete="${escapeHtml(it.purchaseId)}" class="row-action-btn text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors" title="Excluir compra (todas as parcelas)"><i class="ph-bold ph-trash"></i></button>
          </div>
        </div>`
          )
          .join("");

  const canPay = !invoice.paid && invoice.total > 0 && today >= invoice.closingDate;
  bEl.invoicePayBtn.classList.toggle("hidden", invoice.paid);
  bEl.invoicePayBtn.disabled = !canPay;
  bEl.invoicePayBtn.classList.toggle("opacity-50", !canPay);
  bEl.invoicePayBtn.textContent = invoice.total <= 0 ? "Sem valor a pagar" : today < invoice.closingDate ? `Fecha em ${shortDate(invoice.closingDate)}` : "Pagar fatura";
  bEl.invoiceUnpayBtn.classList.toggle("hidden", !invoice.paid);
}

/* ---------------------------------------------------------------
   Ligações
--------------------------------------------------------------- */

/**
 * @param {{ saveBill, payBill, unpayBill, saveCard, savePurchase, payInvoice, unpayInvoice }} handlers
 */
export function bindBills(handlers) {
  actions = handlers;
  if (!bEl.list) return;

  ["bill-category", "bill-repeat", "purchase-card", "purchase-category"].forEach(enhanceSelect);
  attachDatePicker({ triggerId: "bill-due-trigger", labelId: "bill-due-label", hiddenInputId: "bill-due", placeholder: BILL_DATE_PLACEHOLDER });
  attachDatePicker({ triggerId: "purchase-date-trigger", labelId: "purchase-date-label", hiddenInputId: "purchase-date", placeholder: BILL_DATE_PLACEHOLDER, onChange: updatePurchaseHint });

  bEl.filterBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      billsState.filter = btn.dataset.billFilter;
      renderBillsView();
    })
  );
  bEl.newBillBtn.addEventListener("click", () => openBillModal());
  bEl.newCardBtn.addEventListener("click", () => openCardModal());

  bEl.list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const find = (id) => billsState.bills.find((b) => b.id === id);
    if (btn.dataset.billPay) actions.payBill?.(find(btn.dataset.billPay));
    else if (btn.dataset.billUnpay) actions.unpayBill?.(find(btn.dataset.billUnpay));
    else if (btn.dataset.billEdit) openBillModal(find(btn.dataset.billEdit));
    else if (btn.dataset.billDelete) openDeleteModal(btn.dataset.billDelete, "bill");
  });

  bEl.cardsList.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.cardOpen) openInvoiceModal(btn.dataset.cardOpen, btn.dataset.month);
    else if (btn.dataset.cardPurchase) openPurchaseModal(btn.dataset.cardPurchase);
  });

  // Conta
  bEl.billRepeat.addEventListener("change", () => bEl.billInstallmentsWrap.classList.toggle("hidden", bEl.billRepeat.value !== "installments"));
  bEl.billForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const dueDate = document.getElementById("bill-due").value;
    if (!dueDate) return;
    actions.saveBill?.(
      {
        description: bEl.billDescription.value.trim(),
        amount: Number(bEl.billAmount.value),
        category: bEl.billCategory.value,
        dueDate,
        repeat: bEl.billRepeat.value,
        installments: Math.min(72, Math.max(2, Math.floor(Number(bEl.billInstallments.value) || 2))),
      },
      bEl.billId.value || null
    );
  });

  // Cartão
  bEl.cardForm.addEventListener("submit", (e) => {
    e.preventDefault();
    actions.saveCard?.(
      {
        name: bEl.cardName.value.trim(),
        limit: Number(bEl.cardLimit.value) || 0,
        closingDay: Math.min(31, Math.max(1, Math.floor(Number(bEl.cardClosingDay.value)))),
        dueDay: Math.min(31, Math.max(1, Math.floor(Number(bEl.cardDueDay.value)))),
      },
      bEl.cardId.value || null
    );
  });

  // Compra
  [bEl.purchaseAmount, bEl.purchaseInstallments].forEach((input) => input.addEventListener("input", updatePurchaseHint));
  bEl.purchaseCard.addEventListener("change", updatePurchaseHint);
  bEl.purchaseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const purchaseDate = document.getElementById("purchase-date").value;
    if (!purchaseDate || !bEl.purchaseCard.value) return;
    actions.savePurchase?.(
      {
        cardId: bEl.purchaseCard.value,
        description: bEl.purchaseDescription.value.trim(),
        amount: Number(bEl.purchaseAmount.value),
        installments: Math.min(72, Math.max(1, Math.floor(Number(bEl.purchaseInstallments.value) || 1))),
        purchaseDate,
        category: bEl.purchaseCategory.value,
      },
      bEl.purchaseId.value || null
    );
  });

  // Fatura
  bEl.invoicePrev.addEventListener("click", () => {
    invoiceView.month = shiftMonth(invoiceView.month, -1);
    renderInvoiceModal();
  });
  bEl.invoiceNext.addEventListener("click", () => {
    invoiceView.month = shiftMonth(invoiceView.month, 1);
    renderInvoiceModal();
  });
  bEl.invoicePayBtn.addEventListener("click", () => {
    const data = currentInvoice();
    if (data && !bEl.invoicePayBtn.disabled) actions.payInvoice?.(data.card, data.invoice);
  });
  bEl.invoiceUnpayBtn.addEventListener("click", () => {
    const data = currentInvoice();
    if (data) actions.unpayInvoice?.(data.card, data.invoice);
  });
  bEl.invoiceAddPurchaseBtn.addEventListener("click", () => {
    hideModal(bEl.invoiceModal);
    openPurchaseModal(invoiceView.cardId);
  });
  bEl.invoiceEditCardBtn.addEventListener("click", () => {
    const card = billsState.cards.find((c) => c.id === invoiceView.cardId);
    hideModal(bEl.invoiceModal);
    openCardModal(card);
  });
  bEl.invoiceDeleteCardBtn.addEventListener("click", () => {
    hideModal(bEl.invoiceModal);
    openDeleteModal(invoiceView.cardId, "card");
  });
  bEl.invoiceItems.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.purchaseEdit) {
      const purchase = billsState.purchases.find((p) => p.id === btn.dataset.purchaseEdit);
      hideModal(bEl.invoiceModal);
      openPurchaseModal(null, purchase);
    } else if (btn.dataset.purchaseDelete) {
      openDeleteModal(btn.dataset.purchaseDelete, "purchase");
    }
  });

  // Fechar
  [
    [bEl.billModal, "bill-modal"],
    [bEl.cardModal, "card-modal"],
    [bEl.purchaseModal, "purchase-modal"],
    [bEl.invoiceModal, "invoice-modal"],
  ].forEach(([modal, id]) => {
    document.getElementById(`${id}-close-btn`)?.addEventListener("click", () => hideModal(modal));
    document.getElementById(`${id}-backdrop`)?.addEventListener("click", () => hideModal(modal));
  });
}

export function closeBillModal() {
  hideModal(bEl.billModal);
}
export function closeCardModal() {
  hideModal(bEl.cardModal);
}
export function closePurchaseModal() {
  hideModal(bEl.purchaseModal);
}
