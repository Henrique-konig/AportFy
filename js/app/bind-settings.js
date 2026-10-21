// =========================================================
// AportFy — app/bind-settings.js
// Ligações da exclusão genérica e de Configurações.
// =========================================================

import * as ui from "../ui.js";
import { requestPasswordReset, sendVerificationEmail, translateAuthError, updateDisplayName } from "../auth.js";
import { dividendDedupeKey } from "../calc.js";
import { approveJoinRequest, cancelJoinRequest, deleteBudget, deleteCard, deleteDividend, deleteFromCollection, deleteGoal, deleteInvestment, deleteRecurrence, deleteTransaction, rejectJoinRequest, requestJoinCouple, upsertUserProfile } from "../db.js";
import { checkEmailVerification, deleteAccountFlow } from "./account-actions.js";
import { exportBackup, importBackup } from "./backup.js";
import { stopWatchingMyJoinRequest, watchMyJoinRequest } from "./couple.js";
import { ignoreDividend } from "./dividend-sync.js";
import { session } from "./session.js";

export function bindSettings() {
  /* -------------------- Exclusão genérica -------------------- */
  ui.onDeleteConfirm(async (id, type) => {
    try {
      const collectionId = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      if (type === "goal") {
        await deleteGoal(session.activeMode, collectionId, id);
        ui.showToast("Meta excluída.", "success");
      } else if (type === "investment") {
        await deleteInvestment(session.activeMode, collectionId, id);
        ui.showToast("Ativo excluído.", "success");
      } else if (type === "dividend") {
        const removed = session.latestDividends.find((d) => d.id === id);
        await deleteDividend(session.activeMode, collectionId, id);
        if (removed) ignoreDividend(dividendDedupeKey(removed.ticker, removed.date, removed.type));
        ui.showToast("Provento excluído.", "success");
      } else if (type === "budget") {
        await deleteBudget(session.activeMode, collectionId, id);
        ui.showToast("Orçamento excluído.", "success");
      } else if (type === "recurrence") {
        await deleteRecurrence(session.activeMode, collectionId, id);
        ui.showToast("Recorrência excluída.", "success");
      } else if (type === "bill") {
        await deleteFromCollection(session.activeMode, collectionId, "bills", id);
        ui.showToast("Conta excluída.", "success");
      } else if (type === "purchase") {
        await deleteFromCollection(session.activeMode, collectionId, "cardPurchases", id);
        ui.showToast("Compra excluída.", "success");
      } else if (type === "card") {
        await deleteCard(
          session.activeMode,
          collectionId,
          id,
          session.latestPurchases.filter((p) => p.cardId === id).map((p) => p.id),
          session.latestCardInvoices.filter((i) => i.cardId === id).map((i) => i.month)
        );
        ui.showToast("Cartão excluído.", "success");
      } else {
        await deleteTransaction(session.activeMode, collectionId, id);
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
      await upsertUserProfile(session.activeUser.uid, { displayName });
      ui.showAppShell({ ...session.activeUser, displayName });
      ui.showToast("Perfil atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar perfil.", "error");
    }
  });

  // Entrar no espaço de outra pessoa exige aprovação do dono: aqui só se envia o pedido.
  ui.onJoinCouple(async (coupleId) => {
    if (!session.activeUser.emailVerified) {
      ui.showToast("Confirme seu e-mail antes de pedir entrada em um espaço de casal (veja o aviso no topo).", "error");
      return;
    }
    try {
      await requestJoinCouple(session.activeUser.uid, coupleId, { email: session.activeUser.email || "", displayName: session.activeUser.displayName || "" });
      watchMyJoinRequest(coupleId);
      ui.showToast("Pedido enviado! Assim que o dono do espaço aprovar, você entra.", "success");
    } catch (err) {
      console.error(err);
      ui.showToast(err.message || "Erro ao enviar o pedido de entrada.", "error");
    }
  });

  ui.onCancelJoinRequest(async () => {
    if (!session.pendingJoinCoupleId) return;
    try {
      const coupleId = session.pendingJoinCoupleId;
      stopWatchingMyJoinRequest();
      await cancelJoinRequest(session.activeUser.uid, coupleId);
      ui.showToast("Pedido cancelado.", "info");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao cancelar o pedido.", "error");
    }
  });

  // Dono do espaço: aprova ou recusa pedidos de entrada.
  ui.onJoinRequestDecision(async (requesterUid, decision) => {
    try {
      if (decision === "approve") {
        await approveJoinRequest(session.activeUser.uid, requesterUid);
        ui.showToast("Pedido aprovado! A pessoa agora faz parte do seu espaço.", "success");
      } else {
        await rejectJoinRequest(session.activeUser.uid, requesterUid);
        ui.showToast("Pedido recusado.", "info");
      }
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao responder o pedido.", "error");
    }
  });

  ui.onPasswordReset(async () => {
    try {
      await requestPasswordReset(session.activeUser.email);
      ui.showToast("E-mail de redefinição enviado!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao enviar e-mail de redefinição.", "error");
    }
  });

  ui.bindAccountSecurity({
    onResend: async () => {
      try {
        await sendVerificationEmail();
        ui.showToast("E-mail de confirmação enviado! Confira também a caixa de spam.", "success");
      } catch (err) {
        console.error(err);
        ui.showToast(translateAuthError(err), "error");
      }
    },
    onCheck: () => checkEmailVerification({ announce: true }),
    onDelete: (password) => deleteAccountFlow(password),
  });

  ui.onExportBackup(() => exportBackup());
  ui.onImportBackup((file) => importBackup(file));
}
