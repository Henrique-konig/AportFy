// =========================================================
// EcoFy — datepicker.js
// Calendário customizado no tema do app (glass-card, cores por
// modo Pessoal/Casal), usado no lugar do <input type="date">
// nativo do navegador para manter consistência visual.
// =========================================================

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

let popupEl = null;
let activeField = null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISO(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function formatLabel(iso) {
  const parsed = parseISO(iso);
  if (!parsed) return "";
  return `${pad2(parsed.day)}/${pad2(parsed.month + 1)}/${parsed.year}`;
}

function todayParts() {
  const t = new Date();
  return { year: t.getFullYear(), month: t.getMonth(), day: t.getDate() };
}

function ensurePopup() {
  if (popupEl) return popupEl;

  popupEl = document.createElement("div");
  popupEl.id = "datepicker-popup";
  popupEl.className = "hidden fixed z-[70] glass-card rounded-2xl p-4 w-72 animate-scale-in";
  popupEl.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <button type="button" class="dp-nav-btn" data-nav="prev"><i class="ph-bold ph-caret-left"></i></button>
      <span class="dp-month-label text-sm font-bold capitalize"></span>
      <button type="button" class="dp-nav-btn" data-nav="next"><i class="ph-bold ph-caret-right"></i></button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 font-semibold mb-1.5">
      ${WEEKDAYS_PT.map((d) => `<span>${d}</span>`).join("")}
    </div>
    <div class="dp-days grid grid-cols-7 gap-1"></div>
    <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80 text-xs">
      <button type="button" class="dp-clear-btn font-semibold text-slate-500 hover:text-red-400 transition-colors">Limpar</button>
      <button type="button" class="dp-today-btn font-semibold text-blue-400 hover:text-blue-300 transition-colors">Hoje</button>
    </div>
  `;
  document.body.appendChild(popupEl);

  popupEl.querySelector('[data-nav="prev"]').addEventListener("click", () => shiftMonth(-1));
  popupEl.querySelector('[data-nav="next"]').addEventListener("click", () => shiftMonth(1));
  popupEl.querySelector(".dp-clear-btn").addEventListener("click", () => selectDate(null));
  popupEl.querySelector(".dp-today-btn").addEventListener("click", () => {
    const t = todayParts();
    selectDate(toISO(t.year, t.month, t.day));
  });

  document.addEventListener("click", (e) => {
    if (!activeField) return;
    if (popupEl.contains(e.target) || activeField.triggerBtn.contains(e.target)) return;
    closeDatePicker();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeField) closeDatePicker();
  });
  window.addEventListener("scroll", () => { if (activeField) closeDatePicker(); }, true);
  window.addEventListener("resize", () => { if (activeField) closeDatePicker(); });

  return popupEl;
}

function shiftMonth(delta) {
  if (!activeField) return;
  activeField.viewMonth += delta;
  if (activeField.viewMonth < 0) {
    activeField.viewMonth = 11;
    activeField.viewYear -= 1;
  }
  if (activeField.viewMonth > 11) {
    activeField.viewMonth = 0;
    activeField.viewYear += 1;
  }
  renderCalendar();
}

function applyLabel(labelEl, iso, placeholder) {
  labelEl.textContent = iso ? formatLabel(iso) : placeholder;
  labelEl.classList.toggle("text-slate-600", !iso);
  labelEl.classList.toggle("text-slate-100", !!iso);
}

function selectDate(iso) {
  if (!activeField) return;
  activeField.hiddenInput.value = iso || "";
  applyLabel(activeField.labelEl, iso, activeField.placeholder);
  activeField.hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
  activeField.onChange?.(iso);
  closeDatePicker();
}

function renderCalendar() {
  if (!activeField || !popupEl) return;
  const { viewYear, viewMonth } = activeField;
  popupEl.querySelector(".dp-month-label").textContent = `${MONTHS_PT[viewMonth]} de ${viewYear}`;

  const selected = parseISO(activeField.hiddenInput.value);
  const today = todayParts();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      outside: true,
      y: viewMonth === 0 ? viewYear - 1 : viewYear,
      m: viewMonth === 0 ? 11 : viewMonth - 1,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false, y: viewYear, m: viewMonth });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay,
      outside: true,
      y: viewMonth === 11 ? viewYear + 1 : viewYear,
      m: viewMonth === 11 ? 0 : viewMonth + 1,
    });
    nextDay++;
  }

  const daysContainer = popupEl.querySelector(".dp-days");
  daysContainer.innerHTML = cells
    .map((c) => {
      const iso = toISO(c.y, c.m, c.day);
      const isSelected = !!selected && selected.year === c.y && selected.month === c.m && selected.day === c.day;
      const isToday = today.year === c.y && today.month === c.m && today.day === c.day;
      const classes = [
        "dp-day",
        "w-9 h-9 rounded-lg text-xs font-medium transition-all flex items-center justify-center",
        c.outside ? "dp-day-outside text-slate-600" : "text-slate-200",
        isSelected ? "dp-day-selected" : "",
        isToday && !isSelected ? "dp-day-today" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" class="${classes}" data-iso="${iso}">${c.day}</button>`;
    })
    .join("");

  daysContainer.querySelectorAll(".dp-day").forEach((btn) => {
    btn.addEventListener("click", () => selectDate(btn.dataset.iso));
  });
}

function positionPopup(triggerBtn) {
  const rect = triggerBtn.getBoundingClientRect();
  const popupWidth = 288;
  const estimatedHeight = 360;

  let left = rect.left;
  if (left + popupWidth > window.innerWidth - 16) left = window.innerWidth - popupWidth - 16;
  if (left < 16) left = 16;

  let top = rect.bottom + 8;
  if (top + estimatedHeight > window.innerHeight - 16) top = rect.top - estimatedHeight - 8;
  top = Math.max(16, top);

  popupEl.style.left = `${left}px`;
  popupEl.style.top = `${top}px`;
}

export function closeDatePicker() {
  if (!popupEl || popupEl.classList.contains("hidden")) return;
  popupEl.classList.add("hidden");
  activeField?.triggerBtn.classList.remove("dp-trigger-open");
  activeField = null;
}

function openDatePickerFor(field) {
  ensurePopup();

  if (activeField?.triggerBtn === field.triggerBtn) {
    closeDatePicker();
    return;
  }

  activeField = field;
  const parsed = parseISO(field.hiddenInput.value) || todayParts();
  activeField.viewYear = parsed.year;
  activeField.viewMonth = parsed.month;

  renderCalendar();
  popupEl.classList.remove("hidden");
  positionPopup(field.triggerBtn);
  field.triggerBtn.classList.add("dp-trigger-open");
}

/**
 * Liga um botão de gatilho + input oculto a um calendário customizado.
 * @param {{ triggerId:string, labelId:string, hiddenInputId:string, placeholder?:string, onChange?:(iso:string|null)=>void }} opts
 */
export function attachDatePicker({ triggerId, labelId, hiddenInputId, placeholder = "Selecionar data", onChange }) {
  const triggerBtn = document.getElementById(triggerId);
  const labelEl = document.getElementById(labelId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!triggerBtn || !labelEl || !hiddenInput) return;

  triggerBtn.addEventListener("click", () => {
    openDatePickerFor({ triggerBtn, labelEl, hiddenInput, placeholder, onChange });
  });
}

/**
 * Define programaticamente o valor de um campo de data (ex.: ao editar uma
 * transação/meta existente ou resetar o formulário), sincronizando o input
 * oculto (ISO, usado pelo resto do app) com o rótulo visível formatado.
 */
export function setDatePickerValue(hiddenInputId, labelId, iso, placeholder = "Selecionar data") {
  const hiddenInput = document.getElementById(hiddenInputId);
  const labelEl = document.getElementById(labelId);
  if (!hiddenInput || !labelEl) return;

  hiddenInput.value = iso || "";
  applyLabel(labelEl, iso, placeholder);
}
