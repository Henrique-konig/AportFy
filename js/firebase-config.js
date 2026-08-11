// =========================================================
// EcoFy — firebase-config.js
// Inicialização do Firebase SDK (v10+) via ES Modules (CDN).
// Substitua os placeholders abaixo pelas credenciais do seu
// projeto Firebase (Console > Configurações do projeto > SDK).
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// -----------------------------------------------------------------
// TODO: Substitua pelos valores reais do seu projeto no Firebase Console.
// -----------------------------------------------------------------
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SUA_APP_ID",
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Serviços exportados para uso em outros módulos
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
