// =========================================================
// AportFy — ui/settings.js
// Aba Configurações (perfil, espaço do casal, backup).
// =========================================================

import { el, escapeHtml, showToast, state } from "./core.js";
import { scheduleAlertsRender } from "./alerts.js";

/* ---------------------------------------------------------------
   Configurações (view: Configurações)
--------------------------------------------------------------- */
export function renderProfileSettings(user) {
  el.settingsNameInput.value = user.displayName || "";
  el.settingsEmailDisplay.value = user.email || "";
}

export function renderCoupleSettings(coupleId) {
  el.settingsCoupleId.value = coupleId || "";
}

export let profileUpdateHandler = null;
export let joinCoupleHandler = null;
export let cancelJoinHandler = null;
export let joinDecisionHandler = null;
export let passwordResetHandler = null;
export let exportBackupHandler = null;
export let importBackupHandler = null;

export function onProfileUpdate(handler) {
  profileUpdateHandler = handler;
}

export function onJoinCouple(handler) {
  joinCoupleHandler = handler;
}

export function onCancelJoinRequest(handler) {
  cancelJoinHandler = handler;
}

export function onJoinRequestDecision(handler) {
  joinDecisionHandler = handler;
}

/** Mostra (ou esconde, com null) o aviso de pedido de entrada pendente de quem pediu para entrar. */
export function renderJoinStatus(info) {
  if (!el.settingsJoinStatus) return;
  el.settingsJoinStatus.classList.toggle("hidden", !info);
  el.settingsJoinStatus.classList.toggle("flex", !!info);
  if (!info) return;
  el.settingsJoinStatus.querySelector("[data-join-status-text]").textContent = `Pedido enviado ao espaço ${info.coupleId.slice(0, 6)}… — aguardando a aprovação do dono.`;
}

/** Dono: lista os pedidos de entrada pendentes no próprio espaço, com aprovar/recusar. */
export function renderJoinRequests(requests) {
  state.joinRequestsCount = requests.length;
  scheduleAlertsRender();
  if (!el.settingsJoinRequests) return;
  el.settingsJoinRequests.classList.toggle("hidden", requests.length === 0);
  el.settingsJoinRequestsList.innerHTML = requests
    .map(
      (r) => `
      <div class="flex items-center justify-between gap-3 bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate">${escapeHtml(r.displayName || "Sem nome")}</p>
          <p class="text-xs text-slate-500 truncate">${escapeHtml(r.email || "")}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" data-join-decision="reject" data-uid="${escapeHtml(r.id)}" class="text-xs font-semibold text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg transition-colors">Recusar</button>
          <button type="button" data-join-decision="approve" data-uid="${escapeHtml(r.id)}" class="text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-lg transition-colors">Aprovar</button>
        </div>
      </div>`
    )
    .join("");
}

export function onPasswordReset(handler) {
  passwordResetHandler = handler;
}

export function onExportBackup(handler) {
  exportBackupHandler = handler;
}

export function onImportBackup(handler) {
  importBackupHandler = handler;
}

export function bindSettingsForms() {
  el.settingsProfileForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    profileUpdateHandler?.(el.settingsNameInput.value.trim());
  });

  el.settingsCopyCoupleBtn?.addEventListener("click", async () => {
    if (!el.settingsCoupleId.value) return;
    try {
      await navigator.clipboard.writeText(el.settingsCoupleId.value);
      showToast("Código copiado para a área de transferência!", "success");
    } catch {
      showToast("Não foi possível copiar automaticamente.", "error");
    }
  });

  el.settingsJoinForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = el.settingsJoinInput.value.trim();
    if (!value) return;
    joinCoupleHandler?.(value);
    el.settingsJoinInput.value = "";
  });

  el.settingsJoinStatus?.querySelector("[data-join-cancel]")?.addEventListener("click", () => cancelJoinHandler?.());
  el.settingsJoinRequestsList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-decision]");
    if (btn) joinDecisionHandler?.(btn.dataset.uid, btn.dataset.joinDecision);
  });

  el.settingsResetPasswordBtn?.addEventListener("click", () => passwordResetHandler?.());

  el.settingsExportBackupBtn?.addEventListener("click", () => exportBackupHandler?.());

  el.settingsImportBackupBtn?.addEventListener("click", () => el.settingsImportBackupInput?.click());
  el.settingsImportBackupInput?.addEventListener("change", () => {
    const file = el.settingsImportBackupInput.files?.[0];
    el.settingsImportBackupInput.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (file) importBackupHandler?.(file);
  });
}

export { el as elements };

