// =========================================================
// AportFy — app/account-actions.js
// Segurança da conta: e-mail confirmado e exclusão.
// =========================================================

import * as ui from "../ui.js";
import { deleteCurrentUser, reauthenticate, reauthenticateWithGoogle, refreshEmailVerification, translateAuthError } from "../auth.js";
import { clearLocalCache, deleteAccountData } from "../db.js";
import { stopCoupleInviteListeners } from "./couple.js";
import { session } from "./session.js";
import { subscribeToActiveCollection, unsubscribeAll } from "./subscriptions.js";

/* ---------------------------------------------------------------
   Segurança da conta: e-mail confirmado e exclusão
--------------------------------------------------------------- */
export async function checkEmailVerification({ announce = false } = {}) {
  try {
    const verified = await refreshEmailVerification();
    if (session.activeUser) ui.renderAccountSecurity(session.activeUser);
    if (announce) {
      ui.showToast(verified ? "E-mail confirmado! Tudo liberado." : "Ainda não consta como confirmado. Abra o link do e-mail e tente de novo.", verified ? "success" : "info");
    }
  } catch (err) {
    console.warn("Não foi possível conferir a verificação do e-mail:", err);
    if (announce) ui.showToast(translateAuthError(err), "error");
  }
}

let deletingAccount = false;

export async function deleteAccountFlow(password) {
  if (deletingAccount || !session.activeUser) return;
  deletingAccount = true;
  ui.setDeleteAccountBusy(true);
  try {
    // Confirma a identidade antes de apagar qualquer coisa (senha, ou o Google para quem entrou com ele).
    if (password == null) await reauthenticateWithGoogle();
    else await reauthenticate(password);
  } catch (err) {
    deletingAccount = false;
    ui.setDeleteAccountBusy(false);
    ui.showDeleteAccountError(err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" ? "Senha incorreta." : translateAuthError(err));
    return;
  }

  try {
    const uid = session.activeUser.uid;
    stopCoupleInviteListeners();
    unsubscribeAll();
    const { keptSharedSpace } = await deleteAccountData(uid);
    await deleteCurrentUser();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("aportfy_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* sem storage */
    }
    await clearLocalCache();
    ui.closeDeleteAccountModal();
    ui.showToast(keptSharedSpace ? "Conta excluída. O espaço de casal continua com o seu parceiro(a)." : "Conta e dados excluídos.", "info");
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    console.error(err);
    deletingAccount = false;
    ui.setDeleteAccountBusy(false);
    ui.showDeleteAccountError("Não foi possível concluir a exclusão. Tente de novo; se persistir, saia e entre na conta antes.");
    if (session.activeUser) subscribeToActiveCollection();
  }
}
