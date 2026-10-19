// =========================================================
// AportFy — ui/account.js
// Segurança da conta: aviso de e-mail não confirmado e exclusão da conta.
// =========================================================

const acEl = {
  banner: document.getElementById("verify-banner"),
  bannerEmail: document.getElementById("verify-email"),
  resendBtn: document.getElementById("verify-resend-btn"),
  checkBtn: document.getElementById("verify-check-btn"),
  emailStatus: document.getElementById("settings-email-status"),
  deleteBtn: document.getElementById("settings-delete-account-btn"),
  modal: document.getElementById("delete-account-modal"),
  modalBackdrop: document.getElementById("delete-account-modal-backdrop"),
  form: document.getElementById("delete-account-form"),
  password: document.getElementById("delete-account-password"),
  error: document.getElementById("delete-account-error"),
  cancelBtn: document.getElementById("delete-account-cancel-btn"),
  confirmBtn: document.getElementById("delete-account-confirm-btn"),
  passwordWrap: document.getElementById("delete-account-password-wrap"),
  googleNote: document.getElementById("delete-account-google-note"),
};

// Conta sem senha (entrou com Google): a exclusão é confirmada entrando de novo com o Google.
let usesPassword = true;

/** Mostra ou esconde o aviso de e-mail e o status em Configurações. */
export function renderAccountSecurity(user) {
  const verified = !!user?.emailVerified;
  usesPassword = !user?.providerData || user.providerData.length === 0 || user.providerData.some((p) => p.providerId === "password");
  acEl.passwordWrap?.classList.toggle("hidden", !usesPassword);
  acEl.googleNote?.classList.toggle("hidden", usesPassword);
  if (acEl.password) acEl.password.required = usesPassword;
  acEl.banner?.classList.toggle("hidden", !user || verified);
  if (acEl.bannerEmail) acEl.bannerEmail.textContent = user?.email || "";
  if (acEl.emailStatus) {
    acEl.emailStatus.innerHTML = verified
      ? `<i class="ph-fill ph-seal-check text-emerald-400" aria-hidden="true"></i><span class="text-emerald-400 font-semibold">E-mail confirmado</span>`
      : `<i class="ph-fill ph-warning-circle text-amber-400" aria-hidden="true"></i><span class="text-amber-400 font-semibold">E-mail ainda não confirmado</span>`;
  }
}

export function openDeleteAccountModal() {
  acEl.form?.reset();
  showDeleteAccountError("");
  setDeleteAccountBusy(false);
  acEl.modal.classList.remove("hidden");
  acEl.modal.classList.add("flex");
  acEl.password?.focus();
}

export function closeDeleteAccountModal() {
  acEl.modal.classList.add("hidden");
  acEl.modal.classList.remove("flex");
  acEl.form?.reset();
}

export function showDeleteAccountError(message) {
  if (!acEl.error) return;
  acEl.error.textContent = message;
  acEl.error.classList.toggle("hidden", !message);
}

export function setDeleteAccountBusy(busy) {
  if (!acEl.confirmBtn) return;
  acEl.confirmBtn.disabled = busy;
  acEl.cancelBtn.disabled = busy;
  acEl.confirmBtn.classList.toggle("opacity-60", busy);
  acEl.confirmBtn.textContent = busy ? "Excluindo..." : "Excluir tudo";
}

/**
 * Liga os botões. O app.js entrega o que cada um faz:
 * { onResend(), onCheck(), onDelete(password) }
 */
export function bindAccountSecurity({ onResend, onCheck, onDelete }) {
  acEl.resendBtn?.addEventListener("click", async () => {
    acEl.resendBtn.disabled = true;
    try {
      await onResend();
    } finally {
      // Evita disparar vários e-mails seguidos.
      setTimeout(() => (acEl.resendBtn.disabled = false), 15000);
    }
  });
  acEl.checkBtn?.addEventListener("click", async () => {
    acEl.checkBtn.disabled = true;
    try {
      await onCheck();
    } finally {
      acEl.checkBtn.disabled = false;
    }
  });

  acEl.deleteBtn?.addEventListener("click", openDeleteAccountModal);
  acEl.cancelBtn?.addEventListener("click", closeDeleteAccountModal);
  acEl.modalBackdrop?.addEventListener("click", closeDeleteAccountModal);
  acEl.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!usesPassword) {
      showDeleteAccountError("");
      onDelete(null);
      return;
    }
    const password = acEl.password.value;
    if (!password) {
      showDeleteAccountError("Digite sua senha para confirmar.");
      return;
    }
    showDeleteAccountError("");
    onDelete(password);
  });
}
