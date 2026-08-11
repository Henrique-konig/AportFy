// =========================================================
// EcoFy — auth.js
// Controle de sessão do usuário (Firebase Authentication).
// =========================================================

import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

/** Usuário autenticado atual (null se deslogado). */
export let currentUser = null;

const authChangeListeners = [];

/**
 * Registra um callback chamado sempre que o estado de autenticação mudar.
 * @param {(user: import("https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js").User | null) => void} callback
 */
export function onAuthChange(callback) {
  authChangeListeners.push(callback);
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authChangeListeners.forEach((cb) => cb(user));
});

/**
 * Autentica um usuário existente com e-mail e senha.
 */
export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Cria uma nova conta de usuário com e-mail e senha.
 */
export async function register(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  return credential.user;
}

/**
 * Encerra a sessão do usuário atual.
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Atualiza o nome de exibição do usuário autenticado.
 */
export async function updateDisplayName(displayName) {
  if (!auth.currentUser) throw new Error("Nenhum usuário autenticado.");
  return updateProfile(auth.currentUser, { displayName });
}

/**
 * Envia um e-mail de redefinição de senha para o endereço informado.
 */
export async function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Traduz códigos de erro do Firebase Auth para mensagens em português.
 */
export function translateAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password": "A senha deve ter no mínimo 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  };
  return map[code] || "Ocorreu um erro. Tente novamente.";
}
