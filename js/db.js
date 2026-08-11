// =========================================================
// EcoFy — db.js
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
 * Associa o usuário ao espaço de casal de outra pessoa a partir de um
 * código de casal (coupleId) compartilhado.
 * @param {string} userId
 * @param {string} coupleId
 */
export async function joinCouple(userId, coupleId) {
  return upsertUserProfile(userId, { coupleId });
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
