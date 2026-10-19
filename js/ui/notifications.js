// =========================================================
// AportFy — ui/notifications.js
// Cartão "Notificações" em Configurações (ativar/desativar/testar
// os lembretes neste aparelho). A parte do Firebase fica em js/push.js.
// =========================================================

const nEl = {
  status: document.getElementById("push-status"),
  enable: document.getElementById("push-enable-btn"),
  disable: document.getElementById("push-disable-btn"),
  test: document.getElementById("push-test-btn"),
};

/**
 * @param {{ supported:boolean, enabled:boolean, permission:string, busy?:boolean, message?:string }} s
 */
export function renderPushStatus({ supported, enabled, permission, busy = false, message = "" }) {
  if (!nEl.status) return;
  let text;
  let tone = "text-slate-400";
  if (!supported) text = "Este navegador não recebe notificações. No iPhone, instale o app na tela de início primeiro (iOS 16.4 ou mais novo).";
  else if (permission === "denied") {
    text = "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo.";
    tone = "text-amber-400";
  } else if (enabled) {
    text = "Ativadas neste aparelho.";
    tone = "text-emerald-400";
  } else text = "Desativadas neste aparelho.";
  if (message) text = message;

  nEl.status.className = `text-xs mb-4 flex items-center gap-1.5 ${tone}`;
  nEl.status.textContent = text;
  nEl.enable.classList.toggle("hidden", !supported || enabled || permission === "denied");
  nEl.disable.classList.toggle("hidden", !supported || !enabled);
  nEl.test.classList.toggle("hidden", !supported || !enabled);
  [nEl.enable, nEl.disable, nEl.test].forEach((b) => (b.disabled = busy));
}

/** @param {{ onEnable:Function, onDisable:Function, onTest:Function }} handlers */
export function bindPushSettings({ onEnable, onDisable, onTest }) {
  nEl.enable?.addEventListener("click", () => onEnable());
  nEl.disable?.addEventListener("click", () => onDisable());
  nEl.test?.addEventListener("click", () => onTest());
}
