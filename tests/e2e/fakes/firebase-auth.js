// Autenticação falsa para os testes de ponta a ponta. Começa logado se window.__E2E.user existir;
// os métodos de login criam o usuário "e2e-user" na hora. Tudo em memória.

const makeUser = (extra = {}) => ({
  uid: "e2e-user",
  email: "e2e@exemplo.com",
  displayName: "Teste E2E",
  emailVerified: true,
  providerData: [{ providerId: "password" }],
  reload: async () => {},
  getIdToken: async () => "token",
  ...extra,
});

let current = globalThis.__E2E?.user ? makeUser(globalThis.__E2E.user) : null;
const subscribers = new Set();
const emit = () => subscribers.forEach((cb) => cb(current));
globalThis.__authLog = [];

export const getAuth = () => ({
  get currentUser() {
    return current;
  },
});
// O Firebase de verdade só avisa o estado de login depois de ler o armazenamento do navegador, ou seja,
// depois de todos os módulos do app terem registrado seus ouvintes. Aqui: depois do carregamento da página.
const afterLoad = (fn) => {
  const run = () => setTimeout(fn, 0);
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
};
export const onAuthStateChanged = (_auth, callback) => {
  subscribers.add(callback);
  afterLoad(() => callback(current));
  return () => subscribers.delete(callback);
};

const signInAs = (extra) => async (_auth, email) => {
  current = makeUser({ email: email || "e2e@exemplo.com", ...extra });
  emit();
  return { user: current };
};
export const signInWithEmailAndPassword = async (_auth, email, password) => {
  if (password === "senha-errada") throw Object.assign(new Error("wrong"), { code: "auth/invalid-credential" });
  return signInAs({})(_auth, email);
};
export const createUserWithEmailAndPassword = signInAs({ emailVerified: false });
export const signInWithPopup = signInAs({ email: "google@exemplo.com", providerData: [{ providerId: "google.com" }] });
export const signInWithRedirect = async () => {};
export const getRedirectResult = async () => null;
export const signOut = async () => {
  current = null;
  emit();
};
export const updateProfile = async (user, data) => Object.assign(user, data);
export const sendPasswordResetEmail = async (_auth, email) => void globalThis.__authLog.push(["reset", email]);
export const sendEmailVerification = async () => void globalThis.__authLog.push(["verify"]);
export const reauthenticateWithCredential = async () => ({});
export const reauthenticateWithPopup = async () => ({});
export const deleteUser = async () => {
  current = null;
  globalThis.__authLog.push(["deleteUser"]);
  emit();
};
export class GoogleAuthProvider {
  setCustomParameters() {}
}
export const EmailAuthProvider = { credential: (email, password) => ({ email, password }) };
