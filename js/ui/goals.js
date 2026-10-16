// =========================================================
// AportFy — ui/goals.js
// Aba Metas.
// =========================================================

import { setDatePickerValue, closeDatePicker } from "../datepicker.js";
import { el, escapeHtml, formatCurrency, getModeColor, state } from "./core.js";
import { openDeleteModal } from "./forms.js";
import { scheduleAlertsRender } from "./alerts.js";

/* ---------------------------------------------------------------
   Metas (view: Metas)
--------------------------------------------------------------- */
export let editGoalHandler = null;

export function onEditGoal(handler) {
  editGoalHandler = handler;
}

export function daysUntil(deadline) {
  if (!deadline) return null;
  const diff = new Date(`${deadline}T00:00:00`) - new Date(new Date().toDateString());
  return Math.ceil(diff / 86400000);
}

export function renderGoals(goals) {
  scheduleAlertsRender();
  state.lastGoals = goals;

  if (goals.length === 0) {
    el.goalsGrid.innerHTML = "";
    el.goalsEmpty.classList.remove("hidden");
    el.goalsEmpty.classList.add("flex");
    return;
  }

  el.goalsEmpty.classList.add("hidden");
  el.goalsEmpty.classList.remove("flex");

  const modeColor = getModeColor();

  el.goalsGrid.innerHTML = goals
    .map((g) => {
      const target = Number(g.targetAmount) || 0;
      const current = Number(g.currentAmount) || 0;
      const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      const complete = pct >= 100;
      const barColor = complete ? "#10b981" : modeColor;
      const days = daysUntil(g.deadline);
      let deadlineLabel = "";
      if (g.deadline) {
        if (days === null) deadlineLabel = "";
        else if (days < 0) deadlineLabel = `<span class="text-red-400">Prazo vencido</span>`;
        else if (days === 0) deadlineLabel = `<span class="text-amber-400">Vence hoje</span>`;
        else deadlineLabel = `${days} dia${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"}`;
      }

      return `
        <div class="goal-card glass-card rounded-2xl p-5" data-id="${g.id}">
          <div class="flex items-start justify-between mb-4">
            <div class="min-w-0">
              <h4 class="font-bold text-sm truncate">${escapeHtml(g.name)}</h4>
              ${deadlineLabel ? `<p class="text-[11px] text-slate-500 mt-0.5">${deadlineLabel}</p>` : ""}
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button class="row-action-btn edit-goal-btn" data-id="${g.id}" title="Editar"><i class="ph-bold ph-pencil-simple"></i></button>
              <button class="row-action-btn delete-btn delete-goal-btn" data-id="${g.id}" title="Excluir"><i class="ph-bold ph-trash"></i></button>
            </div>
          </div>

          <div class="flex items-end justify-between mb-2">
            <span class="text-xl font-extrabold">${formatCurrency(current)}</span>
            <span class="text-xs text-slate-500">de ${formatCurrency(target)}</span>
          </div>

          <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="goal-progress-bar h-full rounded-full" style="width:${pct}%; background:${barColor};"></div>
          </div>

          <div class="flex items-center justify-between mt-2.5">
            <span class="text-xs font-semibold" style="color:${barColor};">${pct.toFixed(0)}%</span>
            ${complete ? `<span class="text-[11px] text-emerald-400 font-semibold flex items-center gap-1"><i class="ph-fill ph-check-circle"></i> Concluída</span>` : ""}
          </div>
        </div>`;
    })
    .join("");

  el.goalsGrid.querySelectorAll(".edit-goal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const g = goals.find((goal) => goal.id === btn.dataset.id);
      if (g && editGoalHandler) editGoalHandler(g);
    });
  });
  el.goalsGrid.querySelectorAll(".delete-goal-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "goal"));
  });
}

export let goalSubmitHandler = null;

export function onGoalFormSubmit(handler) {
  goalSubmitHandler = handler;
}

export const GOAL_DEADLINE_PLACEHOLDER = "Sem prazo definido";

export function openGoalModal(goal = null) {
  el.goalForm.reset();
  if (goal) {
    el.goalModalTitle.textContent = "Editar Meta";
    el.goalId.value = goal.id;
    el.goalName.value = goal.name;
    el.goalCurrent.value = goal.currentAmount;
    el.goalTarget.value = goal.targetAmount;
    setDatePickerValue("goal-deadline", "goal-deadline-label", goal.deadline || null, GOAL_DEADLINE_PLACEHOLDER);
  } else {
    el.goalModalTitle.textContent = "Nova Meta";
    el.goalId.value = "";
    el.goalCurrent.value = "0";
    setDatePickerValue("goal-deadline", "goal-deadline-label", null, GOAL_DEADLINE_PLACEHOLDER);
  }
  el.goalModal.classList.remove("hidden");
  el.goalModal.classList.add("flex");
}

export function closeGoalModal() {
  el.goalModal.classList.add("hidden");
  el.goalModal.classList.remove("flex");
  closeDatePicker();
}

export function bindGoalModal() {
  el.newGoalBtn?.addEventListener("click", () => openGoalModal());
  el.goalModalCloseBtn?.addEventListener("click", closeGoalModal);
  el.goalModalBackdrop?.addEventListener("click", closeGoalModal);

  el.goalForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      name: el.goalName.value.trim(),
      currentAmount: parseFloat(el.goalCurrent.value) || 0,
      targetAmount: parseFloat(el.goalTarget.value),
      deadline: el.goalDeadline.value || null,
    };
    const editingId = el.goalId.value || null;
    goalSubmitHandler?.(data, editingId);
  });
}

