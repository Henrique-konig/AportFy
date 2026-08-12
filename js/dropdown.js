// =========================================================
// EcoFy — dropdown.js
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
  document.body.appendChild(popupEl);

  document.addEventListener("click", (e) => {
    if (!activeField) return;
    if (popupEl.contains(e.target) || activeField.triggerBtn.contains(e.target)) return;
    closeDropdown();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeField) closeDropdown();
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
      return `<button type="button" class="dd-option w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors ${isSelected ? "dd-option-selected" : ""}" data-value="${safeValue}">${opt.textContent}</button>`;
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
  selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  closeDropdown();
}

export function closeDropdown() {
  if (!popupEl || popupEl.classList.contains("hidden")) return;
  popupEl.classList.add("hidden");
  activeField?.triggerBtn.classList.remove("dp-trigger-open");
  activeField = null;
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

  selectEl.classList.add("sr-only-select");
  selectEl.insertAdjacentElement("afterend", triggerBtn);

  const labelEl = triggerBtn.querySelector(".dd-label");
  labelEl.textContent = selectEl.options[selectEl.selectedIndex]?.textContent || "";

  const field = { selectEl, triggerBtn, labelEl };
  registry.set(selectId, field);

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
}
