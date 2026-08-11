// =========================================================
// EcoFy — app.js
// Ponto de entrada da aplicação: conecta auth.js, db.js e
// ui.js, registrando os event listeners da página.
// =========================================================

import {
  onAuthChange,
  login,
  register,
  logout,
  translateAuthError,
  updateDisplayName,
  requestPasswordReset,
} from "./auth.js";
import {
  listenToTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  listenToGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  getUserProfile,
  upsertUserProfile,
  joinCouple,
} from "./db.js";
import * as ui from "./ui.js";

/* ---------------------------------------------------------------
   Estado da aplicação
--------------------------------------------------------------- */
let unsubscribeTransactions = null;
let unsubscribeGoals = null;
let activeUser = null;
let activeMode = "personal";
let activeCoupleId = null;
let latestTransactions = [];
let latestGoals = [];

/* ---------------------------------------------------------------
   Inicialização de bindings de UI (executados uma única vez)
--------------------------------------------------------------- */
function initUIBindings() {
  ui.bindSidebarToggle();
  ui.bindTransactionModal();
  ui.bindGoalModal();
  ui.bindDeleteModal();
  ui.bindSearch();
  ui.bindMobileSearch();
  ui.bindTransactionFilters();
  ui.bindSettingsForms();

  ui.onNavChange((view) => ui.setActiveView(view));
  ui.onModeToggle((mode) => switchMode(mode));

  ui.onLogoutClick(async () => {
    try {
      await logout();
      ui.showToast("Sessão encerrada com sucesso.", "info");
    } catch (err) {
      ui.showToast("Erro ao sair da conta.", "error");
    }
  });

  /* -------------------- Transações -------------------- */
  ui.onTransactionFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateTransaction(activeMode, id, editingId, data);
        ui.showToast("Transação atualizada com sucesso!", "success");
      } else {
        await addTransaction(activeMode, id, data);
        ui.showToast("Transação adicionada com sucesso!", "success");
      }
      ui.closeTransactionModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar transação.", "error");
    }
  });

  ui.onEditTransaction((transaction) => ui.openTransactionModal(transaction));

  /* -------------------- Metas -------------------- */
  ui.onGoalFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateGoal(activeMode, id, editingId, data);
        ui.showToast("Meta atualizada com sucesso!", "success");
      } else {
        await addGoal(activeMode, id, data);
        ui.showToast("Meta criada com sucesso!", "success");
      }
      ui.closeGoalModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar meta.", "error");
    }
  });

  ui.onEditGoal((goal) => ui.openGoalModal(goal));

  /* -------------------- Exclusão genérica -------------------- */
  ui.onDeleteConfirm(async (id, type) => {
    try {
      const collectionId = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (type === "goal") {
        await deleteGoal(activeMode, collectionId, id);
        ui.showToast("Meta excluída.", "success");
      } else {
        await deleteTransaction(activeMode, collectionId, id);
        ui.showToast("Transação excluída.", "success");
      }
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao excluir item.", "error");
    }
  });

  /* -------------------- Configurações -------------------- */
  ui.onProfileUpdate(async (displayName) => {
    try {
      await updateDisplayName(displayName);
      await upsertUserProfile(activeUser.uid, { displayName });
      ui.showAppShell({ ...activeUser, displayName });
      ui.showToast("Perfil atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar perfil.", "error");
    }
  });

  ui.onJoinCouple(async (coupleId) => {
    try {
      await joinCouple(activeUser.uid, coupleId);
      activeCoupleId = coupleId;
      ui.renderCoupleSettings(activeCoupleId);
      if (activeMode === "couple") subscribeToActiveCollection();
      ui.showToast("Você entrou no espaço de casal com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao entrar no espaço de casal.", "error");
    }
  });

  ui.onPasswordReset(async () => {
    try {
      await requestPasswordReset(activeUser.email);
      ui.showToast("E-mail de redefinição enviado!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao enviar e-mail de redefinição.", "error");
    }
  });

  /* -------------------- Auth screen -------------------- */
  ui.elements.toggleAuthModeBtn.addEventListener("click", () => ui.toggleAuthMode());

  ui.elements.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.clearAuthError();
    ui.setAuthLoading(true);

    const email = ui.elements.loginEmail.value.trim();
    const password = ui.elements.loginPassword.value;

    try {
      if (ui.getIsRegisterMode()) {
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
}

/* ---------------------------------------------------------------
   Assinatura de dados (Firestore) de acordo com o modo ativo
--------------------------------------------------------------- */
function refreshDashboard() {
  ui.updateKPIs(latestTransactions, latestGoals);
  ui.renderTransactionsTable(latestTransactions);
  ui.renderFullTransactionsTable(latestTransactions);
  ui.updateCharts(latestTransactions);
  ui.renderReports(latestTransactions);
}

function subscribeToActiveCollection() {
  if (unsubscribeTransactions) {
    unsubscribeTransactions();
    unsubscribeTransactions = null;
  }
  if (unsubscribeGoals) {
    unsubscribeGoals();
    unsubscribeGoals = null;
  }

  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  if (!id) return;

  unsubscribeTransactions = listenToTransactions(activeMode, id, (transactions, error) => {
    if (error) {
      ui.showToast("Erro ao carregar transações em tempo real.", "error");
      return;
    }
    latestTransactions = transactions;
    refreshDashboard();
  });

  unsubscribeGoals = listenToGoals(activeMode, id, (goals, error) => {
    if (error) {
      ui.showToast("Erro ao carregar metas em tempo real.", "error");
      return;
    }
    latestGoals = goals;
    ui.renderGoals(goals);
    ui.updateKPIs(latestTransactions, latestGoals);
  });
}

/**
 * Garante que o usuário possua um coupleId associado ao seu perfil.
 * Caso não exista, cria um espaço de "casal" vinculado ao próprio
 * usuário, que pode ser compartilhado com o parceiro(a) posteriormente.
 */
async function ensureCoupleId(user) {
  const profile = await getUserProfile(user.uid);
  if (profile?.coupleId) return profile.coupleId;

  const newCoupleId = user.uid;
  await upsertUserProfile(user.uid, { coupleId: newCoupleId, email: user.email });
  return newCoupleId;
}

async function switchMode(mode) {
  if (mode === activeMode) return;
  activeMode = mode;
  ui.setActiveMode(mode);
  subscribeToActiveCollection();
}

/* ---------------------------------------------------------------
   Reação ao estado de autenticação
--------------------------------------------------------------- */
onAuthChange(async (user) => {
  if (user) {
    activeUser = user;
    activeMode = "personal";
    activeCoupleId = null;

    ui.showAppShell(user);
    ui.setActiveMode("personal");
    ui.setActiveView("dashboard");
    ui.renderProfileSettings(user);

    try {
      await upsertUserProfile(user.uid, { email: user.email, lastLoginAt: new Date().toISOString() });
      activeCoupleId = await ensureCoupleId(user);
      ui.renderCoupleSettings(activeCoupleId);
    } catch (err) {
      console.warn("Não foi possível preparar o perfil/espaço de casal do usuário:", err);
    }

    subscribeToActiveCollection();
  } else {
    activeUser = null;
    activeCoupleId = null;
    latestTransactions = [];
    latestGoals = [];
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
      unsubscribeTransactions = null;
    }
    if (unsubscribeGoals) {
      unsubscribeGoals();
      unsubscribeGoals = null;
    }
    ui.showLoginScreen();
  }
});

/* ---------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initUIBindings();
});
