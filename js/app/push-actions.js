// =========================================================
// AportFy — app/push-actions.js
// Notificações: ativar, desativar e testar neste aparelho.
// =========================================================

import * as ui from "../ui.js";
import { removePushToken, savePushToken } from "../db.js";
import { currentPushToken, disablePush, enablePush, pushPermission, pushSupported, showTestNotification } from "../push.js";
import { session } from "./session.js";

/* ---------------------------------------------------------------
   Notificações (lembretes com o app fechado)
--------------------------------------------------------------- */
let pushToken = null;

export async function refreshPushStatus(message = "") {
  if (!pushSupported()) return ui.renderPushStatus({ supported: false, enabled: false, permission: "unsupported" });
  pushToken = await currentPushToken();
  if (pushToken && session.activeUser) await savePushToken(session.activeUser.uid, pushToken).catch(() => {});
  ui.renderPushStatus({ supported: true, enabled: !!pushToken, permission: pushPermission(), message });
}

export async function turnPushOn() {
  ui.renderPushStatus({ supported: true, enabled: false, permission: pushPermission(), busy: true, message: "Ativando…" });
  try {
    pushToken = await enablePush();
    await savePushToken(session.activeUser.uid, pushToken);
    ui.showToast("Notificações ativadas neste aparelho.", "success");
    refreshPushStatus();
  } catch (err) {
    console.error(err);
    refreshPushStatus(err.message || "Não foi possível ativar as notificações.");
  }
}

export async function turnPushOff() {
  try {
    if (pushToken) await removePushToken(session.activeUser.uid, pushToken).catch(() => {});
    await disablePush();
    pushToken = null;
    ui.showToast("Notificações desativadas neste aparelho.", "info");
  } catch (err) {
    console.error(err);
  }
  ui.renderPushStatus({ supported: true, enabled: false, permission: pushPermission() });
}

export async function testPush() {
  try {
    await showTestNotification();
  } catch (err) {
    console.error(err);
    ui.showToast("Não foi possível mostrar a notificação de teste.", "error");
  }
}
