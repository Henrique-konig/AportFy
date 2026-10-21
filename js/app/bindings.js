// =========================================================
// AportFy — app/bindings.js
// Ligações da interface (executadas uma única vez ao abrir).
// =========================================================

import * as ui from "../ui.js";
import { finishRedirectLogin, login, loginWithGoogle, logout, register, translateAuthError } from "../auth.js";
import { passwordProblem } from "../calc.js";
import { saveSettingsDoc } from "../db.js";
import { bindBillsActions } from "./bills-actions.js";
import { bindFinance } from "./bind-finance.js";
import { bindInvestments } from "./bind-investments.js";
import { bindSettings } from "./bind-settings.js";
import { loadNewsView } from "./news-feed.js";
import { testPush, turnPushOff, turnPushOn } from "./push-actions.js";
import { refreshQuotes } from "./quotes.js";
import { activeSpaceId, session } from "./session.js";
import { rerenderAll, switchMode } from "./subscriptions.js";

/* ---------------------------------------------------------------
   Inicialização de bindings de UI (executados uma única vez)
--------------------------------------------------------------- */
export function initUIBindings() {
  ui.bindSidebarToggle();
  ui.bindTransactionModal();
  ui.bindRecurrenceModal();
  ui.bindGoalModal();
  ui.bindBudgetModal();
  ui.bindInvestmentModal();
  ui.bindPriceEditModal();
  ui.bindDividendModal();
  ui.bindImportDividends();
  ui.bindDeleteModal();
  ui.bindDatePickers();
  ui.bindCustomDropdowns();
  ui.bindSearch();
  ui.bindMobileSearch();
  ui.bindTransactionFilters();
  ui.bindDashboardFilters();
  ui.bindReportsFilters();
  ui.bindInvestmentFilters();
  ui.bindPortfolioHealth();
  ui.bindSellModal();
  ui.bindAlerts();
  ui.bindInstallApp();
  ui.bindTheme();
  ui.bindPrivacy(() => rerenderAll());
  ui.bindReportsExport();
  ui.bindPlanning({
    onSaveReserve: async (data) => {
      try {
        await saveSettingsDoc(session.activeMode, activeSpaceId(), "reserve", data);
        ui.showToast("Reserva de emergência atualizada.", "success");
      } catch (err) {
        console.error(err);
        ui.showToast("Erro ao salvar a reserva.", "error");
      }
    },
  });
  bindBillsActions();
  ui.bindPushSettings({ onEnable: () => turnPushOn(), onDisable: () => turnPushOff(), onTest: () => testPush() });
  ui.bindAccessibility();
  ui.bindOnboarding();
  ui.bindDividendCalendar();
  ui.bindFinancialIndependence();
  ui.bindHistory();
  ui.bindSettingsForms();
  ui.bindNewsSubtabs();

  ui.onNavChange((view) => {
    ui.setActiveView(view);
    if (view === "investments") refreshQuotes({ silent: true });
    if (view === "news") loadNewsView();
  });
  ui.onModeToggle((mode) => switchMode(mode));

  ui.onLogoutClick(async () => {
    try {
      await logout();
      ui.showToast("Sessão encerrada com sucesso.", "info");
    } catch (err) {
      ui.showToast("Erro ao sair da conta.", "error");
    }
  });

  bindFinance();
  bindInvestments();
  bindSettings();

  /* -------------------- Auth screen -------------------- */
  ui.elements.toggleAuthModeBtn.addEventListener("click", () => ui.toggleAuthMode());

  document.getElementById("google-login-btn")?.addEventListener("click", async () => {
    ui.clearAuthError();
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      ui.showAuthError(translateAuthError(err));
    }
  });
  finishRedirectLogin().then((err) => err && ui.showAuthError(translateAuthError(err)));

  ui.elements.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.clearAuthError();
    ui.setAuthLoading(true);

    const email = ui.elements.loginEmail.value.trim();
    const password = ui.elements.loginPassword.value;

    try {
      if (ui.getIsRegisterMode()) {
        const problem = passwordProblem(password);
        if (problem) {
          ui.showAuthError(problem);
          return;
        }
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      ui.showAuthError(translateAuthError(err));
    } finally {
      ui.setAuthLoading(false);
    }
  });

  ui.initCharts();
  ui.initReportsCharts();
  ui.initInvestmentCharts();
  ui.initAssetDetailChart();
  ui.initDividendsChart();
  ui.initHealthCharts();
}
