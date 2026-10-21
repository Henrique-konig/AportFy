// =========================================================
// AportFy — app/session.js
// Estado compartilhado da sessão (usuário, modo ativo e os últimos dados recebidos do Firestore).
// Fica num objeto só para os módulos de js/app/ lerem e alterarem o mesmo estado.
// =========================================================

import { createGate } from "../gate.js";

export const session = {
  activeUser: null,
  activeMode: "personal", // "personal" | "couple"
  activeCoupleId: null,
  latestTransactions: [],
  latestGoals: [],
  latestInvestments: [],
  latestDividends: [],
  latestBudgets: [],
  latestRecurrences: [],
  latestBills: [],
  latestCards: [],
  latestPurchases: [],
  latestCardInvoices: [],
  dividendsLoaded: false,
  pendingJoinCoupleId: null,
  // Chaves de proventos já gravadas nesta sessão: o snapshot do Firestore demora um instante e não pode causar duplicidade.
  registeredKeys: new Set(),
  // Cada troca de assinatura (login, logout, modo Pessoal/Casal) muda este número; avisos que estavam
  // à espera de uma assinatura antiga são descartados em vez de desenhar dados do modo errado.
  generation: 0,
};

/** Id do espaço ativo: o do usuário (Pessoal) ou o do casal. */
export const activeSpaceId = () => (session.activeMode === "couple" ? session.activeCoupleId : session.activeUser?.uid);

/** Filtra os avisos do Firestore: ignora dados repetidos e junta rajadas num redesenho só (ver js/gate.js). */
export const gate = (apply) => createGate(apply, () => session.generation);
