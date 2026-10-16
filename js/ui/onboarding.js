// =========================================================
// AportFy — ui/onboarding.js
// Cartão "Primeiros passos" no Dashboard para quem está começando.
// Some sozinho quando tudo é feito, ou quando o usuário dispensa.
// =========================================================

import { escapeHtml, state } from "./core.js";
import { portfolioSettings, openPortfolioSettingsModal } from "./health.js";
import { openInvestmentModal } from "./investments.js";
import { openTransactionModal } from "./transactions.js";

const obEl = {
  card: document.getElementById("onboarding-card"),
  progress: document.getElementById("onboarding-progress"),
  bar: document.getElementById("onboarding-bar"),
  steps: document.getElementById("onboarding-steps"),
  dismiss: document.getElementById("onboarding-dismiss"),
};

let onboardingUser = null;
let onboardingReady = false;

const dismissKey = () => `aportfy_onboarding_dismissed_${onboardingUser}`;
const isDismissed = () => {
  try {
    return localStorage.getItem(dismissKey()) === "1";
  } catch {
    return false;
  }
};
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const goTo = (view) => document.querySelector(`.nav-item[data-view="${view}"]`)?.click();

function getSteps() {
  return [
    {
      key: "transaction",
      label: "Registre sua primeira receita ou despesa",
      done: state.lastTransactions.length > 0,
      action: () => openTransactionModal(),
    },
    {
      key: "investment",
      label: "Cadastre um investimento",
      done: state.lastInvestments.length > 0,
      action: () => {
        goTo("investments");
        openInvestmentModal();
      },
    },
    {
      key: "allocation",
      label: "Defina suas metas de alocação",
      done: !!portfolioSettings,
      action: () => {
        goTo("health");
        openPortfolioSettingsModal();
      },
    },
    {
      key: "install",
      label: "Instale o app no celular",
      done: isStandalone(),
      action: () => goTo("settings"),
    },
  ];
}

/** O app avisa quem é o usuário e se os dados iniciais já chegaram (evita piscar o cartão). */
export function updateOnboarding({ uid, ready }) {
  onboardingUser = uid;
  onboardingReady = ready;
  renderOnboarding();
}

export function renderOnboarding() {
  if (!obEl.card) return;
  const steps = getSteps();
  const done = steps.filter((s) => s.done).length;
  const visible = !!onboardingUser && onboardingReady && !isDismissed() && done < steps.length;
  obEl.card.classList.toggle("hidden", !visible);
  if (!visible) return;

  obEl.progress.textContent = `${done} de ${steps.length} concluídos`;
  obEl.bar.style.width = `${(done / steps.length) * 100}%`;
  obEl.steps.innerHTML = steps
    .map(
      (s) => `
      <li>
        <button type="button" data-onboarding-step="${s.key}" ${s.done ? "disabled" : ""}
          class="w-full flex items-center gap-3 text-left rounded-xl border px-4 py-3 transition-colors ${s.done ? "border-emerald-500/25 bg-emerald-500/5 cursor-default" : "border-slate-800 bg-slate-900/50 hover:bg-slate-800/40"}">
          <i class="${s.done ? "ph-fill ph-check-circle text-emerald-400" : "ph-bold ph-circle text-slate-500"} text-lg shrink-0" aria-hidden="true"></i>
          <span class="text-sm ${s.done ? "text-slate-500 line-through" : "font-medium"}">${escapeHtml(s.label)}</span>
          <span class="sr-only">${s.done ? "(concluído)" : ""}</span>
        </button>
      </li>`
    )
    .join("");
}

export function bindOnboarding() {
  obEl.steps?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-onboarding-step]");
    if (!btn || btn.disabled) return;
    getSteps()
      .find((s) => s.key === btn.dataset.onboardingStep)
      ?.action();
  });
  obEl.dismiss?.addEventListener("click", () => {
    try {
      localStorage.setItem(dismissKey(), "1");
    } catch {
      /* sem storage: some só nesta visita */
    }
    obEl.card.classList.add("hidden");
  });
}
