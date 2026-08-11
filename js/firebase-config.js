// =========================================================
// EcoFy — firebase-config.js
// Inicialização do Firebase SDK (v10+) via ES Modules (CDN).
// Credenciais do projeto "ecofy-c332d" (Firebase Console > Configurações do projeto > SDK).
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAnalytics, isSupported as isAnalyticsSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";

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

// Serviços exportados para uso em outros módulos
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics só funciona em navegadores compatíveis (não em SSR/alguns navegadores privados)
isAnalyticsSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});

export default app;
