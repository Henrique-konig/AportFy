// =========================================================
// AportFy — ui/mode.js
// Alternância entre os modos Pessoal e Casal.
// =========================================================

import { renderBudgets } from "./budget.js";
import { updateCharts } from "./charts.js";
import { el, getActiveView, setActiveView, state } from "./core.js";
import { renderInvestments } from "./dividends.js";
import { renderGoals } from "./goals.js";
import { renderNewsCards } from "./news-view.js";

/* ---------------------------------------------------------------
   Alternância de Modo (Pessoal / Casal)
--------------------------------------------------------------- */
export function setActiveMode(mode) {
  state.currentMode = mode;
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
  updateCharts(state.lastTransactions);
  renderGoals(state.lastGoals);
  renderBudgets(state.lastBudgets, state.lastTransactions);
  renderInvestments(state.lastInvestments);
  renderNewsCards("portfolio", state.lastNewsPortfolio);
  renderNewsCards("market", state.lastNewsMarket);
}

export function onModeToggle(handler) {
  el.modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => handler(btn.dataset.mode));
  });
}

export function getCurrentMode() {
  return state.currentMode;
}

