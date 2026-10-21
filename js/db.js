// =========================================================
// AportFy — db.js
// Operações CRUD no Firestore para transações financeiras.
// Coleções:
//   users/{userId}/transactions      -> modo Pessoal
//   couples/{coupleId}/transactions  -> modo Casal
// =========================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  deleteField,
  terminate,
  clearIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/**
 * Retorna a referência da coleção de transações de acordo com o modo ativo.
 * @param {"personal"|"couple"} mode
 * @param {string} id - userId (modo pessoal) ou coupleId (modo casal)
 */
function getTransactionsCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/transactions` : `users/${id}/transactions`;
  return collection(db, path);
}

/**
 * Escuta em tempo real as transações da coleção ativa.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(transactions: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToTransactions(mode, id, callback) {
  const colRef = getTransactionsCollection(mode, id);
  const q = query(colRef, orderBy("date", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const transactions = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(transactions);
    },
    (error) => {
      console.error("Erro ao escutar transações:", error);
      callback([], error);
    }
  );
}

/**
 * Adiciona uma nova transação.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {{description:string, amount:number, type:"income"|"expense", category:string, date:string}} transaction
 */
export async function addTransaction(mode, id, transaction) {
  const colRef = getTransactionsCollection(mode, id);
  return addDoc(colRef, {
    ...transaction,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza uma transação existente.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} transactionId
 * @param {Object} updates
 */
export async function updateTransaction(mode, id, transactionId, updates) {
  const path = mode === "couple" ? `couples/${id}/transactions` : `users/${id}/transactions`;
  const docRef = doc(db, path, transactionId);
  return updateDoc(docRef, updates);
}

/**
 * Remove uma transação.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} transactionId
 */
export async function deleteTransaction(mode, id, transactionId) {
  const path = mode === "couple" ? `couples/${id}/transactions` : `users/${id}/transactions`;
  const docRef = doc(db, path, transactionId);
  return deleteDoc(docRef);
}

/**
 * Busca (ou cria, se inexistente) o documento do usuário em `users/{userId}`,
 * usado para armazenar metadados como o coupleId vinculado.
 * @param {string} userId
 */
export async function getUserProfile(userId) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * Cria/atualiza o documento de perfil do usuário.
 * @param {string} userId
 * @param {Object} data
 */
export async function upsertUserProfile(userId, data) {
  const userRef = doc(db, "users", userId);
  return setDoc(userRef, data, { merge: true });
}

/**
 * Busca o documento raiz do espaço de casal em `couples/{coupleId}`.
 * Esse documento guarda só a lista de membros (`members`) — é o que as
 * regras do Firestore usam pra decidir quem pode ler/escrever nas
 * subcoleções financeiras do casal (couples/{coupleId}/transactions, etc).
 * @param {string} coupleId
 */
export async function getCoupleDoc(coupleId) {
  const ref = doc(db, "couples", coupleId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Cria o espaço de casal de um usuário (chamado uma única vez, no
 * primeiro login) com ele mesmo como único membro inicial.
 * @param {string} coupleId - por convenção, o próprio uid do criador
 * @param {string} ownerUid
 */
export async function createCoupleSpace(coupleId, ownerUid) {
  const ref = doc(db, "couples", coupleId);
  return setDoc(ref, { members: [ownerUid] }, { merge: true });
}

/**
 * Adiciona um membro ao espaço de casal (upsert idempotente — não faz
 * nada de errado se o uid já estiver na lista, arrayUnion não duplica).
 * @param {string} coupleId
 * @param {string} uid
 */
export async function addCoupleMember(coupleId, uid) {
  const ref = doc(db, "couples", coupleId);
  return updateDoc(ref, { members: arrayUnion(uid) });
}

/* ---------------------------------------------------------------
   Convite ao espaço de casal (com aprovação do dono)
   Quem tem o código cria um pedido em
     couples/{coupleId}/joinRequests/{uid}
   e só vira membro quando o DONO do espaço (coupleId == uid do dono) aprova.
--------------------------------------------------------------- */

/** Código de casal = UID do dono (letras e números, ~28 caracteres). */
export const COUPLE_CODE_PATTERN = /^[A-Za-z0-9]{20,40}$/;

function getJoinRequestRef(coupleId, userId) {
  return doc(db, "couples", coupleId, "joinRequests", userId);
}

/**
 * Pede para entrar no espaço de casal de outra pessoa. O pedido fica pendente
 * até o dono aprovar. As regras do Firestore recusam o pedido se o código não
 * existir ou se a pessoa já for membro.
 * @param {string} userId
 * @param {string} coupleId código compartilhado pelo dono
 * @param {{email?:string, displayName?:string}} info
 */
export async function requestJoinCouple(userId, coupleId, { email = "", displayName = "" } = {}) {
  if (!COUPLE_CODE_PATTERN.test(coupleId)) {
    throw new Error("Código de casal inválido. Confira se copiou o código inteiro.");
  }
  if (coupleId === userId) {
    throw new Error("Esse é o seu próprio código. Compartilhe-o com o seu parceiro(a).");
  }

  const ref = getJoinRequestRef(coupleId, userId);
  // Um pedido antigo (ex: recusado) é apagado antes, pois só o dono altera pedidos existentes.
  await deleteDoc(ref).catch(() => {});
  try {
    await setDoc(ref, { uid: userId, email, displayName, status: "pending", createdAt: serverTimestamp() });
  } catch (err) {
    if (err?.code === "permission-denied") {
      throw new Error("Não foi possível enviar o pedido. Confira o código — ou você já faz parte desse espaço.");
    }
    throw err;
  }
  return upsertUserProfile(userId, { pendingCoupleId: coupleId });
}

/**
 * Escuta o próprio pedido de entrada (status: pending | approved | rejected).
 * O callback recebe null se o pedido não existe mais.
 * @returns {() => void} unsubscribe
 */
export function listenToMyJoinRequest(coupleId, userId, callback) {
  return onSnapshot(
    getJoinRequestRef(coupleId, userId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error("Erro ao acompanhar o pedido de entrada:", error);
      callback(null, error);
    }
  );
}

/**
 * Conclui o pedido do lado de quem pediu: se aprovado, o espaço passa a ser o
 * do perfil; em qualquer caso o pedido é apagado e o pendente, limpo.
 */
export async function finishJoinRequest(userId, coupleId, approved) {
  await deleteDoc(getJoinRequestRef(coupleId, userId)).catch(() => {});
  return upsertUserProfile(userId, approved ? { coupleId, pendingCoupleId: deleteField() } : { pendingCoupleId: deleteField() });
}

/** Cancela o pedido pendente (solicitante). */
export async function cancelJoinRequest(userId, coupleId) {
  return finishJoinRequest(userId, coupleId, false);
}

/**
 * Escuta, para o dono do espaço, os pedidos de entrada ainda pendentes.
 * @returns {() => void} unsubscribe
 */
export function listenToJoinRequests(ownerCoupleId, callback) {
  return onSnapshot(
    collection(db, "couples", ownerCoupleId, "joinRequests"),
    (snapshot) => {
      const requests = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status === "pending")
        .sort((x, y) => (x.createdAt?.seconds || 0) - (y.createdAt?.seconds || 0));
      callback(requests);
    },
    (error) => {
      console.error("Erro ao escutar pedidos de entrada:", error);
      callback([], error);
    }
  );
}

/** Dono aprova: adiciona o solicitante aos membros e marca o pedido como aprovado. */
export async function approveJoinRequest(ownerCoupleId, requesterUid) {
  await addCoupleMember(ownerCoupleId, requesterUid);
  return updateDoc(getJoinRequestRef(ownerCoupleId, requesterUid), { status: "approved" });
}

/** Dono recusa o pedido. */
export async function rejectJoinRequest(ownerCoupleId, requesterUid) {
  return updateDoc(getJoinRequestRef(ownerCoupleId, requesterUid), { status: "rejected" });
}

/* ---------------------------------------------------------------
   Metas financeiras (Goals)
   Coleções:
     users/{userId}/goals      -> modo Pessoal
     couples/{coupleId}/goals  -> modo Casal
--------------------------------------------------------------- */

function getGoalsCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/goals` : `users/${id}/goals`;
  return collection(db, path);
}

/**
 * Escuta em tempo real as metas da coleção ativa.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(goals: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToGoals(mode, id, callback) {
  const colRef = getGoalsCollection(mode, id);
  const q = query(colRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const goals = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      callback(goals);
    },
    (error) => {
      console.error("Erro ao escutar metas:", error);
      callback([], error);
    }
  );
}

/**
 * Adiciona uma nova meta financeira.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {{name:string, currentAmount:number, targetAmount:number, deadline?:string}} goal
 */
export async function addGoal(mode, id, goal) {
  const colRef = getGoalsCollection(mode, id);
  return addDoc(colRef, {
    ...goal,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza uma meta existente.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} goalId
 * @param {Object} updates
 */
export async function updateGoal(mode, id, goalId, updates) {
  const path = mode === "couple" ? `couples/${id}/goals` : `users/${id}/goals`;
  const docRef = doc(db, path, goalId);
  return updateDoc(docRef, updates);
}

/**
 * Remove uma meta.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} goalId
 */
export async function deleteGoal(mode, id, goalId) {
  const path = mode === "couple" ? `couples/${id}/goals` : `users/${id}/goals`;
  const docRef = doc(db, path, goalId);
  return deleteDoc(docRef);
}

/* ---------------------------------------------------------------
   Investimentos (carteira de ativos)
   Coleções:
     users/{userId}/investments      -> modo Pessoal
     couples/{coupleId}/investments  -> modo Casal

   Cada documento representa uma POSIÇÃO consolidada por ativo
   (ticker/nome). Uma nova compra do mesmo ativo não cria um novo
   documento: quantidade e preço médio são recalculados e o
   documento existente é atualizado (ver mergeInvestmentPurchase
   em app.js, que decide se cria ou atualiza).
--------------------------------------------------------------- */

function getInvestmentsCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/investments` : `users/${id}/investments`;
  return collection(db, path);
}

/**
 * Escuta em tempo real os ativos da carteira ativa.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(investments: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToInvestments(mode, id, callback) {
  const colRef = getInvestmentsCollection(mode, id);
  const q = query(colRef, orderBy("purchaseDate", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const investments = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      callback(investments);
    },
    (error) => {
      console.error("Erro ao escutar investimentos:", error);
      callback([], error);
    }
  );
}

/**
 * Cria uma nova posição de investimento.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {{ticker:string, name:string, category:string, quantity:number, avgPrice:number, currentPrice:number, purchaseDate:string}} investment
 */
export async function addInvestment(mode, id, investment) {
  const colRef = getInvestmentsCollection(mode, id);
  return addDoc(colRef, {
    ...investment,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza uma posição existente (nova compra mesclada, preço atual, etc).
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} investmentId
 * @param {Object} updates
 */
export async function updateInvestment(mode, id, investmentId, updates) {
  const path = mode === "couple" ? `couples/${id}/investments` : `users/${id}/investments`;
  const docRef = doc(db, path, investmentId);
  return updateDoc(docRef, updates);
}

/**
 * Remove uma posição de investimento.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} investmentId
 */
export async function deleteInvestment(mode, id, investmentId) {
  const path = mode === "couple" ? `couples/${id}/investments` : `users/${id}/investments`;
  const docRef = doc(db, path, investmentId);
  return deleteDoc(docRef);
}

/* ---------------------------------------------------------------
   Proventos (dividendos, JCP, rendimentos de FIIs)
   Coleções:
     users/{userId}/dividends      -> modo Pessoal
     couples/{coupleId}/dividends  -> modo Casal
--------------------------------------------------------------- */

function getDividendsCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/dividends` : `users/${id}/dividends`;
  return collection(db, path);
}

/**
 * Escuta em tempo real os proventos registrados.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(dividends: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToDividends(mode, id, callback) {
  const colRef = getDividendsCollection(mode, id);
  const q = query(colRef, orderBy("date", "desc"));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const dividends = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      callback(dividends, null, { fromCache: snapshot.metadata.fromCache });
    },
    (error) => {
      console.error("Erro ao escutar proventos:", error);
      callback([], error);
    }
  );
}

/**
 * Registra um novo provento recebido.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {{ticker:string, type:string, amount:number, date:string}} dividend
 */
export async function addDividend(mode, id, dividend) {
  const colRef = getDividendsCollection(mode, id);
  return addDoc(colRef, {
    ...dividend,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza um provento existente.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} dividendId
 * @param {Object} updates
 */
export async function updateDividend(mode, id, dividendId, updates) {
  const path = mode === "couple" ? `couples/${id}/dividends` : `users/${id}/dividends`;
  const docRef = doc(db, path, dividendId);
  return updateDoc(docRef, updates);
}

/**
 * Remove um provento.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} dividendId
 */
export async function deleteDividend(mode, id, dividendId) {
  const path = mode === "couple" ? `couples/${id}/dividends` : `users/${id}/dividends`;
  const docRef = doc(db, path, dividendId);
  return deleteDoc(docRef);
}

/* ---------------------------------------------------------------
   Orçamento por categoria (Budgets)
   Coleções:
     users/{userId}/budgets      -> modo Pessoal
     couples/{coupleId}/budgets  -> modo Casal

   Um documento por categoria (id do doc = nome da categoria), então
   definir orçamento de uma categoria que já tem um é sempre um upsert
   — nunca duplica.
--------------------------------------------------------------- */

function getBudgetsCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/budgets` : `users/${id}/budgets`;
  return collection(db, path);
}

/**
 * Escuta em tempo real os orçamentos definidos.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(budgets: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToBudgets(mode, id, callback) {
  const colRef = getBudgetsCollection(mode, id);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const budgets = snapshot.docs.map((docSnap) => ({ id: docSnap.id, category: docSnap.id, ...docSnap.data() }));
      callback(budgets);
    },
    (error) => {
      console.error("Erro ao escutar orçamentos:", error);
      callback([], error);
    }
  );
}

/**
 * Cria ou atualiza o limite mensal de uma categoria (doc id = categoria).
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} category
 * @param {number} monthlyLimit
 */
export async function upsertBudget(mode, id, category, monthlyLimit) {
  const path = mode === "couple" ? `couples/${id}/budgets` : `users/${id}/budgets`;
  const docRef = doc(db, path, category);
  return setDoc(docRef, { monthlyLimit }, { merge: true });
}

/**
 * Remove o orçamento de uma categoria.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} category
 */
export async function deleteBudget(mode, id, category) {
  const path = mode === "couple" ? `couples/${id}/budgets` : `users/${id}/budgets`;
  const docRef = doc(db, path, category);
  return deleteDoc(docRef);
}

/* ---------------------------------------------------------------
   Transações recorrentes (Recurrences)
   Coleções:
     users/{userId}/recurrences      -> modo Pessoal
     couples/{coupleId}/recurrences  -> modo Casal

   Cada documento é um "modelo" (descrição, valor, categoria, dia do
   mês). A geração da transação real do mês acontece em app.js
   (processRecurrences), que compara lastGeneratedMonth com o mês
   atual e usa addTransaction — esta camada só guarda o modelo.
--------------------------------------------------------------- */

function getRecurrencesCollection(mode, id) {
  const path = mode === "couple" ? `couples/${id}/recurrences` : `users/${id}/recurrences`;
  return collection(db, path);
}

/**
 * Escuta em tempo real as recorrências cadastradas.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {(recurrences: Array<Object>) => void} callback
 * @returns {() => void} função para cancelar a escuta (unsubscribe)
 */
export function listenToRecurrences(mode, id, callback) {
  const colRef = getRecurrencesCollection(mode, id);

  return onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const recurrences = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      callback(recurrences, null, { fromCache: snapshot.metadata.fromCache });
    },
    (error) => {
      console.error("Erro ao escutar recorrências:", error);
      callback([], error);
    }
  );
}

/**
 * Cria um novo modelo de transação recorrente.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {{description:string, amount:number, type:"income"|"expense", category:string, dayOfMonth:number}} recurrence
 */
export async function addRecurrence(mode, id, recurrence) {
  const colRef = getRecurrencesCollection(mode, id);
  return addDoc(colRef, {
    ...recurrence,
    lastGeneratedMonth: null,
    createdAt: serverTimestamp(),
  });
}

/**
 * Atualiza um modelo de recorrência existente.
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} recurrenceId
 * @param {Object} updates
 */
export async function updateRecurrence(mode, id, recurrenceId, updates) {
  const path = mode === "couple" ? `couples/${id}/recurrences` : `users/${id}/recurrences`;
  const docRef = doc(db, path, recurrenceId);
  return updateDoc(docRef, updates);
}

/**
 * Remove um modelo de recorrência (não apaga transações já geradas).
 * @param {"personal"|"couple"} mode
 * @param {string} id
 * @param {string} recurrenceId
 */
export async function deleteRecurrence(mode, id, recurrenceId) {
  const path = mode === "couple" ? `couples/${id}/recurrences` : `users/${id}/recurrences`;
  const docRef = doc(db, path, recurrenceId);
  return deleteDoc(docRef);
}

/* ---------------------------------------------------------------
   Configurações da Saúde da Carteira (metas de alocação)
   Documento único:
     users/{userId}/settings/portfolio      -> modo Pessoal
     couples/{coupleId}/settings/portfolio  -> modo Casal
--------------------------------------------------------------- */

function getPortfolioSettingsRef(mode, id) {
  const path = mode === "couple" ? `couples/${id}/settings` : `users/${id}/settings`;
  return doc(db, path, "portfolio");
}

/**
 * Escuta em tempo real as metas de alocação (null se ainda não configuradas).
 * @returns {() => void} unsubscribe
 */
export function listenToPortfolioSettings(mode, id, callback) {
  return onSnapshot(
    getPortfolioSettingsRef(mode, id),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error("Erro ao escutar metas da carteira:", error);
      callback(null, error);
    }
  );
}

/**
 * Salva as metas de alocação da carteira.
 * @param {{preset:string, targets:Object<string,number>, maxAssetPct:number, minAssets:number}} settings
 */
export async function savePortfolioSettings(mode, id, settings) {
  // merge: a meta de renda e as metas de alocação são salvas em momentos diferentes.
  return setDoc(getPortfolioSettingsRef(mode, id), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

/* ---------------------------------------------------------------
   Exclusão da conta
--------------------------------------------------------------- */

const ACCOUNT_COLLECTIONS = [
  "transactions", "goals", "investments", "dividends", "budgets", "recurrences", "settings",
  "bills", "cards", "cardPurchases", "cardInvoices", "pushTokens",
];

/** Apaga todos os documentos de uma coleção, em lotes (o Firestore limita 500 por lote). */
async function deleteCollection(path) {
  const snap = await getDocs(collection(db, path));
  let batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
    if (count === 400) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

/**
 * Apaga tudo o que o usuário tem no Firestore: dados pessoais, perfil e o espaço de casal
 * dele — este só se ele for o único membro (com parceiro(a), o espaço continua com o outro).
 * @returns {Promise<{ keptSharedSpace: boolean }>}
 */
export async function deleteAccountData(userId) {
  let keptSharedSpace = false;
  const coupleRef = doc(db, "couples", userId);
  const couple = await getDoc(coupleRef);
  if (couple.exists()) {
    const members = couple.data().members || [];
    if (members.length <= 1) {
      for (const name of [...ACCOUNT_COLLECTIONS, "joinRequests"]) await deleteCollection(`couples/${userId}/${name}`);
      await deleteDoc(coupleRef);
    } else {
      keptSharedSpace = true;
    }
  }
  for (const name of ACCOUNT_COLLECTIONS) await deleteCollection(`users/${userId}/${name}`);
  await deleteDoc(doc(db, "users", userId));
  return { keptSharedSpace };
}

/** Limpa o cache offline do Firestore deste navegador (melhor esforço). */
export async function clearLocalCache() {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.warn("Não foi possível limpar o cache local:", err);
  }
}

/* ---------------------------------------------------------------
   Contas a pagar, cartões de crédito e faturas
     {users|couples}/{id}/bills          -> contas (luz, aluguel, boleto...)
     {users|couples}/{id}/cards          -> cartões (fechamento, vencimento, limite)
     {users|couples}/{id}/cardPurchases  -> compras no cartão (parceladas ou não)
     {users|couples}/{id}/cardInvoices   -> faturas pagas (id = cardId_YYYY-MM)
   Pagar uma conta ou fatura grava, num lote atômico, as despesas em
   "transactions" e a marcação de paga — nunca fica uma sem a outra.
--------------------------------------------------------------- */

const spacePath = (mode, id, name) => (mode === "couple" ? `couples/${id}/${name}` : `users/${id}/${name}`);

/** Escuta uma coleção do espaço ativo (com o id de cada documento). */
export function listenToCollection(mode, id, name, callback) {
  return onSnapshot(
    collection(db, spacePath(mode, id, name)),
    (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error(`Erro ao escutar ${name}:`, error);
      callback([], error);
    }
  );
}

export function addToCollection(mode, id, name, data) {
  return addDoc(collection(db, spacePath(mode, id, name)), { ...data, createdAt: serverTimestamp() });
}

/** Grava um documento com id escolhido (ex: faturas pagas, id "cartao_AAAA-MM"). */
export function setInCollection(mode, id, name, docId, data) {
  return setDoc(doc(db, spacePath(mode, id, name), docId), { ...data, createdAt: serverTimestamp() });
}

export function updateInCollection(mode, id, name, docId, data) {
  return updateDoc(doc(db, spacePath(mode, id, name), docId), data);
}

export function deleteFromCollection(mode, id, name, docId) {
  return deleteDoc(doc(db, spacePath(mode, id, name), docId));
}

/** Cria várias contas de uma vez (ex: boleto parcelado em N meses). */
export async function addBills(mode, id, bills) {
  const batch = writeBatch(db);
  const col = collection(db, spacePath(mode, id, "bills"));
  bills.forEach((b) => batch.set(doc(col), { ...b, createdAt: serverTimestamp() }));
  return batch.commit();
}

/**
 * Paga uma conta: cria a despesa, marca a conta como paga e, se for mensal, já cria a do mês seguinte.
 * @param {Object} bill conta (com id)
 * @param {string} payDate data do pagamento (YYYY-MM-DD)
 * @param {Object|null} nextBill próxima conta (contas que se repetem todo mês)
 */
export async function payBill(mode, id, bill, payDate, nextBill = null) {
  const batch = writeBatch(db);
  const txRef = doc(collection(db, spacePath(mode, id, "transactions")));
  batch.set(txRef, {
    description: bill.description,
    amount: Number(bill.amount),
    type: "expense",
    category: bill.category || "Outros",
    date: payDate,
    billId: bill.id,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, spacePath(mode, id, "bills"), bill.id), { paid: true, paidAt: payDate, transactionId: txRef.id });
  if (nextBill) batch.set(doc(collection(db, spacePath(mode, id, "bills"))), { ...nextBill, createdAt: serverTimestamp() });
  return batch.commit();
}

/** Desfaz o pagamento de uma conta (apaga a despesa criada no pagamento). */
export async function unpayBill(mode, id, bill) {
  const batch = writeBatch(db);
  batch.update(doc(db, spacePath(mode, id, "bills"), bill.id), { paid: false, paidAt: null, transactionId: deleteField() });
  if (bill.transactionId) batch.delete(doc(db, spacePath(mode, id, "transactions"), bill.transactionId));
  return batch.commit();
}

const invoiceDocId = (cardId, month) => `${cardId}_${month}`;

/**
 * Paga a fatura de um mês: uma despesa por parcela (com a categoria de cada compra) e o
 * registro da fatura paga.
 */
export async function payInvoice(mode, id, cardId, month, total, transactions, payDate) {
  const batch = writeBatch(db);
  const txCol = collection(db, spacePath(mode, id, "transactions"));
  const transactionIds = transactions.map((t) => {
    const ref = doc(txCol);
    batch.set(ref, { ...t, invoiceId: invoiceDocId(cardId, month), createdAt: serverTimestamp() });
    return ref.id;
  });
  batch.set(doc(db, spacePath(mode, id, "cardInvoices"), invoiceDocId(cardId, month)), {
    cardId,
    month,
    paid: true,
    paidAt: payDate,
    total: Number(total) || 0,
    transactionIds,
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

/** Desfaz o pagamento de uma fatura (apaga as despesas que o pagamento criou). */
export async function unpayInvoice(mode, id, cardId, month, transactionIds = []) {
  const batch = writeBatch(db);
  transactionIds.forEach((txId) => batch.delete(doc(db, spacePath(mode, id, "transactions"), txId)));
  batch.delete(doc(db, spacePath(mode, id, "cardInvoices"), invoiceDocId(cardId, month)));
  return batch.commit();
}

/** Exclui um cartão junto com as compras e os registros de fatura dele (as despesas já lançadas ficam). */
export async function deleteCard(mode, id, cardId, purchaseIds = [], invoiceMonths = []) {
  const batch = writeBatch(db);
  purchaseIds.forEach((pid) => batch.delete(doc(db, spacePath(mode, id, "cardPurchases"), pid)));
  invoiceMonths.forEach((m) => batch.delete(doc(db, spacePath(mode, id, "cardInvoices"), invoiceDocId(cardId, m))));
  batch.delete(doc(db, spacePath(mode, id, "cards"), cardId));
  return batch.commit();
}

/* ---------------------------------------------------------------
   Notificações: tokens dos aparelhos (users/{uid}/pushTokens/{id})
--------------------------------------------------------------- */

/** Id estável e curto para o token (o token do FCM é longo demais para ser id de documento com folga). */
async function tokenDocId(token) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export async function savePushToken(userId, token) {
  const ref = doc(db, "users", userId, "pushTokens", await tokenDocId(token));
  return setDoc(ref, { token, userAgent: navigator.userAgent.slice(0, 300), createdAt: serverTimestamp() });
}

export async function removePushToken(userId, token) {
  return deleteDoc(doc(db, "users", userId, "pushTokens", await tokenDocId(token)));
}

/* ---------------------------------------------------------------
   Documentos de configuração do espaço ({users|couples}/{id}/settings/{docId}),
   ex: "reserve" (fontes e meta da reserva de emergência).
--------------------------------------------------------------- */
export function listenToSettingsDoc(mode, id, docId, callback) {
  return onSnapshot(
    doc(db, spacePath(mode, id, "settings"), docId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    (error) => {
      console.error(`Erro ao escutar configurações (${docId}):`, error);
      callback(null, error);
    }
  );
}

export function saveSettingsDoc(mode, id, docId, data) {
  return setDoc(doc(db, spacePath(mode, id, "settings"), docId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
