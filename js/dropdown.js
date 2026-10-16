// =========================================================
// AportFy — dropdown.js
// Substitui a lista de opções nativa do <select> (renderizada
// pelo sistema operacional, fora do alcance do CSS) por um
// popup no mesmo tema glass-card do resto do app.
//
// O <select> original é mantido oculto como fonte da verdade:
// todo código que lê/escreve `.value` ou escuta `change`
// continua funcionando sem alterações.
// =========================================================

let popupEl = null;
let activeField = null;
const registry = new Map();

function ensurePopup() {
  if (popupEl) return popupEl;

  popupEl = document.createElement("div");
  popupEl.id = "dropdown-popup";
  popupEl.className = "hidden fixed z-[70] glass-card rounded-2xl p-1.5 animate-scale-in max-h-72 overflow-y-auto custom-scroll";
  popupEl.setAttribute("role", "listbox");
  document.body.appendChild(popupEl);

  // Teclado: setas/Home/End navegam, Esc fecha e devolve o foco, Tab fecha.
  popupEl.addEventListener("keydown", (e) => {
    const options = [...popupEl.querySelectorAll(".dd-option")];
    const index = options.indexOf(document.activeElement);
    const focusAt = (i) => options[Math.max(0, Math.min(options.length - 1, i))]?.focus();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt(index + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAt(options.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown({ restoreFocus: true });
    } else if (e.key === "Tab") {
      closeDropdown({ restoreFocus: true });
    }
  });

  document.addEventListener("click", (e) => {
    if (!activeField) return;
    if (popupEl.contains(e.target) || activeField.triggerBtn.contains(e.target)) return;
    closeDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeField) closeDropdown({ restoreFocus: true });
  });
  // Rolar a própria lista de opções não deve fechá-la — só fecha quando o
  // scroll acontece fora do popup (ex: a página ou um modal por trás dele).
  window.addEventListener(
    "scroll",
    (e) => {
      if (!activeField) return;
      if (popupEl.contains(e.target)) return;
      closeDropdown();
    },
    true
  );
  window.addEventListener("resize", () => { if (activeField) closeDropdown(); });

  return popupEl;
}

function positionPopup(triggerBtn, optionCount) {
  const rect = triggerBtn.getBoundingClientRect();
  const popupWidth = Math.max(rect.width, 180);
  popupEl.style.width = `${popupWidth}px`;

  let left = rect.left;
  if (left + popupWidth > window.innerWidth - 16) left = window.innerWidth - popupWidth - 16;
  if (left < 16) left = 16;

  const estimatedHeight = Math.min(288, optionCount * 42 + 12);
  let top = rect.bottom + 6;
  if (top + estimatedHeight > window.innerHeight - 16) top = rect.top - estimatedHeight - 6;

  popupEl.style.left = `${left}px`;
  popupEl.style.top = `${Math.max(16, top)}px`;
}

function renderOptions() {
  if (!activeField) return;
  const { selectEl } = activeField;
  const options = [...selectEl.options];

  popupEl.innerHTML = options
    .map((opt) => {
      const isSelected = opt.value === selectEl.value;
      const safeValue = opt.value.replace(/"/g, "&quot;");
      return `<button type="button" role="option" aria-selected="${isSelected}" class="dd-option w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors ${isSelected ? "dd-option-selected" : ""}" data-value="${safeValue}">${opt.textContent}</button>`;
    })
    .join("");

  popupEl.querySelectorAll(".dd-option").forEach((btn) => {
    btn.addEventListener("click", () => selectOption(btn.dataset.value));
  });

  positionPopup(activeField.triggerBtn, options.length);
}

function selectOption(value) {
  if (!activeField) return;
  const { selectEl, labelEl } = activeField;
  selectEl.value = value;
  labelEl.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || "";
  updateTriggerName(activeField);
  selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  closeDropdown({ restoreFocus: true });
}

export function closeDropdown({ restoreFocus = false } = {}) {
  if (!popupEl || popupEl.classList.contains("hidden")) return;
  popupEl.classList.add("hidden");
  const trigger = activeField?.triggerBtn;
  trigger?.classList.remove("dp-trigger-open");
  trigger?.setAttribute("aria-expanded", "false");
  activeField = null;
  if (restoreFocus) trigger?.focus();
}

function openDropdownFor(field) {
  ensurePopup();

  const wasOpenForSameField = activeField?.triggerBtn === field.triggerBtn;
  closeDropdown(); // fecha o dropdown anterior (se houver) antes de trocar
  if (wasOpenForSameField) return;

  activeField = field;
  renderOptions();
  popupEl.classList.remove("hidden");
  field.triggerBtn.classList.add("dp-trigger-open");
  field.triggerBtn.setAttribute("aria-expanded", "true");
  (popupEl.querySelector(".dd-option-selected") || popupEl.querySelector(".dd-option"))?.focus({ preventScroll: true });
}

/** Nome acessível do botão: "Rótulo do campo: valor escolhido". */
function updateTriggerName(field) {
  const value = field.labelEl.textContent.trim();
  const fieldLabel = document.querySelector(`label[for="${field.selectEl.id}"]`)?.textContent.trim() || field.selectEl.getAttribute("aria-label") || "";
  field.triggerBtn.setAttribute("aria-label", fieldLabel ? `${fieldLabel}: ${value}` : value);
}

/**
 * Substitui visualmente um <select> nativo pelo trigger + popup
 * customizado. Chame uma vez por <select> depois que o DOM já existe.
 * @param {string} selectId
 */
export function enhanceSelect(selectId) {
  const selectEl = document.getElementById(selectId);
  if (!selectEl || selectEl.dataset.enhanced) return;
  selectEl.dataset.enhanced = "true";

  const triggerBtn = document.createElement("button");
  triggerBtn.type = "button";
  triggerBtn.className = `${selectEl.className} date-trigger flex items-center justify-between gap-2 text-left`;
  triggerBtn.innerHTML = `<span class="dd-label truncate"></span><i class="ph-bold ph-caret-down text-slate-500 text-xs shrink-0"></i>`;

  triggerBtn.setAttribute("aria-haspopup", "listbox");
  triggerBtn.setAttribute("aria-expanded", "false");

  // O <select> original continua guardando o valor, mas sai da ordem do Tab e
  // da árvore de acessibilidade (quem fala com o usuário é o botão).
  selectEl.classList.add("sr-only-select");
  selectEl.tabIndex = -1;
  selectEl.setAttribute("aria-hidden", "true");
  selectEl.insertAdjacentElement("afterend", triggerBtn);
  document.querySelector(`label[for="${selectId}"]`)?.addEventListener("click", (e) => {
    e.preventDefault();
    triggerBtn.focus();
  });

  const labelEl = triggerBtn.querySelector(".dd-label");
  labelEl.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || "";

  const field = { selectEl, triggerBtn, labelEl };
  registry.set(selectId, field);
  updateTriggerName(field);

  triggerBtn.addEventListener("click", () => openDropdownFor(field));
}

/**
 * Sincroniza o rótulo visível depois que algo alterou `.value` do
 * <select> original por código (ex.: form.reset(), pré-preenchimento
 * de edição) sem passar pelo popup customizado.
 * @param {string} selectId
 */
export function refreshDropdown(selectId) {
  const field = registry.get(selectId);
  if (!field) return;
  field.labelEl.textContent = field.selectEl.options[field.selectEl.selectedIndex]?.textContent || "";
  updateTriggerName(field);
}
