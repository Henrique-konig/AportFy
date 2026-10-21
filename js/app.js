// =========================================================
// AportFy — app.js
// Ponto de entrada da aplicação: conecta auth.js, db.js e
// ui.js, registrando os event listeners da página.
// =========================================================

import "./errors.js"; // liga o registro de erros em produção
import * as ui from "./ui.js";
import { checkEmailVerification } from "./app/account-actions.js";
import { initUIBindings } from "./app/bindings.js";
import { ensureCoupleId, stopCoupleInviteListeners, watchJoinRequestsToMySpace, watchMyJoinRequest } from "./app/couple.js";
import { refreshPushStatus } from "./app/push-actions.js";
import { session } from "./app/session.js";
import { openViewFromUrl, subscribeToActiveCollection, unsubscribeAll } from "./app/subscriptions.js";
import { onAuthChange } from "./auth.js";
import { getUserProfile, upsertUserProfile } from "./db.js";

/* ---------------------------------------------------------------
   Reação ao estado de autenticação
--------------------------------------------------------------- */
onAuthChange(async (user) => {
  if (user) {
    session.activeUser = user;
    session.activeMode = "personal";
    session.activeCoupleId = null;

    ui.showAppShell(user);
    ui.setActiveMode("personal");
    ui.setActiveView("dashboard");
    ui.renderProfileSettings(user);
    ui.renderAccountSecurity(user);
    // Quem confirmou o e-mail em outro aparelho/aba: relê o usuário para liberar o aviso e o token.
    if (!user.emailVerified) checkEmailVerification();

    try {
      await upsertUserProfile(user.uid, { email: user.email, lastLoginAt: new Date().toISOString() });
      session.activeCoupleId = await ensureCoupleId(user);
      ui.renderCoupleSettings(session.activeCoupleId);

      watchJoinRequestsToMySpace();
      const profile = await getUserProfile(user.uid);
      if (profile?.pendingCoupleId) watchMyJoinRequest(profile.pendingCoupleId);
    } catch (err) {
      console.warn("Não foi possível preparar o perfil/espaço de casal do usuário:", err);
    }

    subscribeToActiveCollection();
    refreshPushStatus();
    openViewFromUrl();
  } else {
    stopCoupleInviteListeners();
    session.activeUser = null;
    session.activeCoupleId = null;
    ui.updateOnboarding({ uid: null, ready: false });
    session.latestTransactions = [];
    session.latestGoals = [];
    session.latestInvestments = [];
    session.latestDividends = [];
    session.dividendsLoaded = false;
    session.registeredKeys.clear();
    session.latestBudgets = [];
    session.latestRecurrences = [];
    unsubscribeAll();
    ui.showLoginScreen();
  }
});

/* ---------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initUIBindings();
});

/* -------------------- PWA: service worker -------------------- */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker não registrado:", err));
  });
}
