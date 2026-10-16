// =========================================================
// AportFy — ui/a11y.js
// Acessibilidade transversal: ícones decorativos escondidos de leitores
// de tela, nome acessível em botões só com ícone, e modais como diálogos
// de verdade (foco ao abrir, Tab preso dentro, Esc fecha, foco volta).
// =========================================================

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]):not(.sr-only-select), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Criados em tempo de execução por dropdown.js e datepicker.js (não estão no index.html).
const POPUP_IDS = ["dropdown-popup", "datepicker-popup"];

const isVisible =(el) => !el.classList.contains("hidden") && el.getClientRects().length > 0;

function labelDecorativeIcons(root) {
  if (root.nodeType !== 1) return;
  const icons = root.matches?.('i[class*="ph-"]') ? [root] : root.querySelectorAll('i[class*="ph-"]');
  icons.forEach((icon) => {
    if (!icon.hasAttribute("aria-hidden")) icon.setAttribute("aria-hidden", "true");
  });
}

function nameIconButtons(root) {
  if (root.nodeType !== 1) return;
  const buttons = root.matches?.("button") ? [root] : root.querySelectorAll("button");
  buttons.forEach((btn) => {
    if (btn.hasAttribute("aria-label") || !btn.title) return;
    if (btn.textContent.trim() === "") btn.setAttribute("aria-label", btn.title);
  });
}

/* -------- Modais -------- */
const modalState = new Map(); // modal -> elemento focado antes de abrir

function getModals() {
  return [...document.querySelectorAll('div[id$="-modal"].fixed')];
}

function setupModal(modal) {
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const title = modal.querySelector("h3");
  if (title) {
    if (!title.id) title.id = `${modal.id}-title`;
    modal.setAttribute("aria-labelledby", title.id);
  }
  // abriu (perdeu "hidden") ou fechou (ganhou "hidden")
  new MutationObserver(() => {
    const open = !modal.classList.contains("hidden");
    if (open && !modalState.has(modal)) {
      modalState.set(modal, document.activeElement);
      requestAnimationFrame(() => {
        const target = modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not(.sr-only-select), textarea') || modal.querySelector(FOCUSABLE);
        target?.focus({ preventScroll: true });
      });
    } else if (!open && modalState.has(modal)) {
      const previous = modalState.get(modal);
      modalState.delete(modal);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    }
  }).observe(modal, { attributes: true, attributeFilter: ["class"] });
}

function openModal() {
  return getModals().find((m) => !m.classList.contains("hidden"));
}

function closeModal(modal) {
  const closer = modal.querySelector('[id$="-close-btn"], [id$="-cancel-btn"], [data-modal-close]') || modal.querySelector('[id$="-backdrop"]');
  closer?.click();
}

function onKeydown(e) {
  const modal = openModal();
  if (!modal) return;
  if (e.key === "Escape") {
    // um dropdown/calendário aberto dentro do modal fecha primeiro (eles tratam o próprio Esc)
    if (POPUP_IDS.some((id) => document.getElementById(id)?.classList.contains("hidden") === false)) return;
    e.preventDefault();
    closeModal(modal);
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = [...modal.querySelectorAll(FOCUSABLE)].filter(isVisible);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
}

export function bindAccessibility() {
  labelDecorativeIcons(document.body);
  nameIconButtons(document.body);
  new MutationObserver((mutations) => {
    mutations.forEach((m) =>
      m.addedNodes.forEach((node) => {
        labelDecorativeIcons(node);
        nameIconButtons(node);
      })
    );
  }).observe(document.body, { childList: true, subtree: true });

  getModals().forEach(setupModal);
  document.addEventListener("keydown", onKeydown);

  document.getElementById("skip-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("main-content")?.focus();
  });
}
