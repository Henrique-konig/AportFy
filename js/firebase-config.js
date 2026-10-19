// =========================================================
// AportFy — firebase-config.js
// Inicialização do Firebase SDK (v10+) via ES Modules (CDN).
// Credenciais do projeto "ecofy-c332d" (Firebase Console > Configurações do projeto > SDK).
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAye-3l_M5xHO8nwzchQh6dxraDr2CRMuc",
  authDomain: "ecofy-c332d.firebaseapp.com",
  projectId: "ecofy-c332d",
  storageBucket: "ecofy-c332d.firebasestorage.app",
  messagingSenderId: "384519069872",
  appId: "1:384519069872:web:e8484541b07a96e2455b75",
  measurementId: "G-9DXDLSZF8T",
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// App Check (opcional): com uma chave reCAPTCHA v3 aqui, o Firebase só aceita chamadas vindas
// do site de verdade, não de scripts avulsos. Passo a passo no README ("Segurança").
// Enquanto estiver vazio, nada muda.
const APP_CHECK_SITE_KEY = "";
if (APP_CHECK_SITE_KEY) {
  import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js")
    .then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
    })
    .catch((err) => console.warn("App Check indisponível:", err));
}

// Serviços exportados para uso em outros módulos
export const auth = getAuth(app);
// Cache local (IndexedDB): o app abre com os últimos dados mesmo sem internet e sincroniza
// sozinho ao voltar. Navegadores sem IndexedDB caem no Firestore padrão (só em memória).
function createFirestore() {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (err) {
    console.warn("Cache offline do Firestore indisponível; seguindo sem ele.", err);
    return getFirestore(app);
  }
}
export const db = createFirestore();

// Analytics: carregado só depois que o app abriu e o navegador está ocioso (não compete com a
// primeira tela) e só em navegadores compatíveis (não em alguns navegadores privados).
const loadAnalytics = () =>
  import("https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js")
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) getAnalytics(app);
    })
    .catch(() => {});
const whenIdle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 8000 }) : setTimeout(fn, 4000));
if (document.readyState === "complete") whenIdle(loadAnalytics);
else window.addEventListener("load", () => whenIdle(loadAnalytics), { once: true });

export default app;
