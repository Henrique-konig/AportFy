// =========================================================
// AportFy — ui/privacy.js
// Modo privacidade: esconde os valores em reais (útil em público).
// O formatCurrency mascara os valores e os gráficos ficam borrados;
// um script no <head> aplica a escolha antes da página aparecer.
// =========================================================

const PRIVACY_KEY = "aportfy_privacy";
const toggleBtn = document.getElementById("privacy-toggle");

export function isPrivacyOn() {
  return document.documentElement.classList.contains("privacy-on");
}

/** Esconde valores monetários dentro de um texto já pronto (ex: alertas). */
export function maskMoneyText(text) {
  return isPrivacyOn() ? String(text).replace(/-?R\$\s?[\d.,]+/g, "R$ •••••") : text;
}

function paintToggle() {
  if (!toggleBtn) return;
  const on = isPrivacyOn();
  const label = on ? "Mostrar valores" : "Esconder valores";
  toggleBtn.setAttribute("aria-label", label);
  toggleBtn.setAttribute("title", label);
  toggleBtn.setAttribute("aria-pressed", String(on));
  const icon = toggleBtn.querySelector("i");
  if (icon) icon.className = `ph-bold ${on ? "ph-eye-slash" : "ph-eye"} text-xl`;
}

export function setPrivacy(on) {
  document.documentElement.classList.toggle("privacy-on", on);
  try {
    localStorage.setItem(PRIVACY_KEY, on ? "1" : "0");
  } catch {
    /* sem storage: vale só nesta visita */
  }
  paintToggle();
}

/** @param {() => void} onChange o app redesenha as telas com os valores (des)mascarados */
export function bindPrivacy(onChange) {
  paintToggle();
  toggleBtn?.addEventListener("click", () => {
    setPrivacy(!isPrivacyOn());
    onChange?.();
  });
}
