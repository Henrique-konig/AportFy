// =========================================================
// AportFy — ui/pwa.js
// Botão "Instalar o app" (PWA) em Configurações.
// =========================================================

const installEl = {
  btn: document.getElementById("install-app-btn"),
  status: document.getElementById("install-app-status"),
};

let deferredPrompt = null;

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function showStatus(message) {
  installEl.status.textContent = message;
  installEl.status.classList.toggle("hidden", !message);
}

function setButtonVisible(visible) {
  installEl.btn.classList.toggle("hidden", !visible);
  installEl.btn.classList.toggle("inline-flex", visible);
}

export function bindInstallApp() {
  if (!installEl.btn) return;

  if (isStandalone()) {
    showStatus("O AportFy já está instalado neste aparelho.");
  } else if (isIos()) {
    showStatus("No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.");
  } else {
    showStatus("Se o botão não aparecer, use o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”.");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setButtonVisible(true);
    showStatus("");
  });

  installEl.btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    deferredPrompt = null;
    setButtonVisible(false);
  });

  window.addEventListener("appinstalled", () => {
    setButtonVisible(false);
    showStatus("Pronto! O AportFy foi instalado.");
  });
}
