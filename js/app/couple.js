// =========================================================
// AportFy — app/couple.js
// Espaço de casal: garantir o espaço do usuário e o convite com aprovação.
// =========================================================

import * as ui from "../ui.js";
import { addCoupleMember, createCoupleSpace, finishJoinRequest, getCoupleDoc, getUserProfile, listenToJoinRequests, listenToMyJoinRequest, upsertUserProfile } from "../db.js";
import { session } from "./session.js";
import { subscribeToActiveCollection } from "./subscriptions.js";

let unsubscribeMyJoinRequest = null;
let unsubscribeJoinRequests = null;

/**
 * Garante que o usuário possua um coupleId associado ao seu perfil.
 * Caso não exista, cria um espaço de "casal" vinculado ao próprio
 * usuário, que pode ser compartilhado com o parceiro(a) posteriormente.
 */
export async function ensureCoupleId(user) {
  const profile = await getUserProfile(user.uid);
  let coupleId = profile?.coupleId || user.uid;

  // O perfil sozinho não dá acesso ao espaço de outra pessoa: só vale se o
  // usuário for mesmo um dos membros. Caso contrário, volta ao espaço próprio.
  if (coupleId !== user.uid) {
    let isMember = false;
    try {
      isMember = (await getCoupleDoc(coupleId))?.members?.includes(user.uid) === true;
    } catch {
      isMember = false;
    }
    if (!isMember) {
      console.warn("Usuário não é membro do espaço de casal do perfil; voltando ao espaço próprio.");
      coupleId = user.uid;
      await upsertUserProfile(user.uid, { coupleId });
      ui.showToast("Você não faz parte do espaço de casal anterior. Voltamos para o seu espaço.", "info");
    }
  }

  // Espaço próprio: cria se ainda não existe (o dono sempre pode ler o próprio espaço).
  if (coupleId === user.uid) {
    const coupleDoc = await getCoupleDoc(coupleId);
    if (!coupleDoc) {
      await createCoupleSpace(coupleId, user.uid);
    } else if (!coupleDoc.members?.includes(user.uid)) {
      await addCoupleMember(coupleId, user.uid);
    }
  }

  if (!profile?.coupleId) {
    await upsertUserProfile(user.uid, { coupleId, email: user.email });
  }

  return coupleId;
}

/* -------------------- Convite ao espaço de casal -------------------- */
export function stopWatchingMyJoinRequest() {
  unsubscribeMyJoinRequest?.();
  unsubscribeMyJoinRequest = null;
  session.pendingJoinCoupleId = null;
  ui.renderJoinStatus(null);
}

/** Acompanha o pedido de entrada enviado: aprovado -> entra no espaço; recusado -> avisa. */
export function watchMyJoinRequest(coupleId) {
  unsubscribeMyJoinRequest?.();
  session.pendingJoinCoupleId = coupleId;
  ui.renderJoinStatus({ coupleId });

  unsubscribeMyJoinRequest = listenToMyJoinRequest(coupleId, session.activeUser.uid, async (request, error) => {
    if (error) return;
    if (!request) {
      stopWatchingMyJoinRequest();
      return;
    }
    if (request.status === "approved") {
      stopWatchingMyJoinRequest();
      try {
        await finishJoinRequest(session.activeUser.uid, coupleId, true);
        session.activeCoupleId = coupleId;
        ui.renderCoupleSettings(session.activeCoupleId);
        if (session.activeMode === "couple") subscribeToActiveCollection();
        ui.showToast("Seu pedido foi aprovado! Você entrou no espaço de casal.", "success");
      } catch (err) {
        console.error(err);
        ui.showToast("Pedido aprovado, mas não foi possível concluir a entrada. Recarregue a página.", "error");
      }
    } else if (request.status === "rejected") {
      stopWatchingMyJoinRequest();
      await finishJoinRequest(session.activeUser.uid, coupleId, false).catch(() => {});
      ui.showToast("O dono do espaço recusou o seu pedido de entrada.", "error");
    }
  });
}

/** Dono: acompanha em tempo real os pedidos de entrada no próprio espaço. */
export function watchJoinRequestsToMySpace() {
  unsubscribeJoinRequests?.();
  let previousCount = null;
  unsubscribeJoinRequests = listenToJoinRequests(session.activeUser.uid, (requests, error) => {
    if (error) return;
    ui.renderJoinRequests(requests);
    if (previousCount !== null && requests.length > previousCount) {
      ui.showToast("Novo pedido de entrada no seu espaço de casal. Veja em Configurações.", "info");
    }
    previousCount = requests.length;
  });
}

export function stopCoupleInviteListeners() {
  unsubscribeJoinRequests?.();
  unsubscribeJoinRequests = null;
  unsubscribeMyJoinRequest?.();
  unsubscribeMyJoinRequest = null;
  session.pendingJoinCoupleId = null;
  ui.renderJoinStatus(null);
  ui.renderJoinRequests([]);
}
