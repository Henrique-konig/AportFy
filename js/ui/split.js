// =========================================================
// AportFy — ui/split.js
// Acerto do casal: despesas lançadas no espaço do casal são divididas meio a meio.
// Mostra quem deve a quem e permite marcar tudo como acertado.
// =========================================================

import { splitBalance } from "../calc.js";
import { formatCurrency, showToast, state } from "./core.js";

const sp = {
  card: document.getElementById("split-card"),
  text: document.getElementById("split-text"),
  btn: document.getElementById("split-settle"),
};
let settleHandler = null;
let openIds = [];

export const onSplitSettle = (handler) => (settleHandler = handler);

export function bindSplit() {
  sp.btn?.addEventListener("click", () =>
    settleHandler?.(openIds)
      .then(() => showToast("Acerto registrado!", "success"))
      .catch(() => showToast("Erro ao registrar o acerto.", "error"))
  );
}

export function renderSplit() {
  if (!sp.card) return;
  const b = splitBalance(state.lastTransactions, state.uid);
  openIds = b.ids;
  sp.card.classList.toggle("hidden", state.currentMode !== "couple" || openIds.length === 0);
  const who = Math.abs(b.owed) < 0.005 ? "Vocês estão quites." : b.owed > 0 ? `Seu parceiro(a) deve ${formatCurrency(b.owed)} a você.` : `Você deve ${formatCurrency(-b.owed)} ao parceiro(a).`;
  sp.text.textContent = `${who} Você pagou ${formatCurrency(b.mine)}, o parceiro(a) ${formatCurrency(b.theirs)} (despesas divididas meio a meio).`;
}
