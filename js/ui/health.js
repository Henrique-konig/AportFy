// =========================================================
// AportFy — ui/health.js
// Aba Saúde da Carteira.
// =========================================================

import { refreshDropdown } from "../dropdown.js";
import { buildMonthlyContributions, analyzePortfolioHealth, suggestContribution, projectPortfolio, financialIndependencePlan, HEALTH_CATEGORIES, ALLOCATION_PRESETS, DEFAULT_PORTFOLIO_SETTINGS } from "../calc.js";
import { hexToRgba } from "./charts.js";
import { INVESTMENT_CATEGORY_COLORS, escapeHtml, formatCurrency, getModeColor, showToast, state } from "./core.js";
import { scheduleAlertsRender } from "./alerts.js";

/* ---------------------------------------------------------------
   Saúde da Carteira (view: Saúde da Carteira)
--------------------------------------------------------------- */
export const healthEl = {
  empty: document.getElementById("health-empty"),
  content: document.getElementById("health-content"),
  ring: document.getElementById("health-score-ring"),
  score: document.getElementById("health-score"),
  status: document.getElementById("health-status"),
  statusDesc: document.getElementById("health-status-desc"),
  profileLabel: document.getElementById("health-profile-label"),
  components: document.getElementById("health-components"),
  total: document.getElementById("health-total"),
  assets: document.getElementById("health-assets"),
  yield: document.getElementById("health-yield"),
  alerts: document.getElementById("health-alerts"),
  categories: document.getElementById("health-categories"),
  assetBars: document.getElementById("health-asset-bars"),
  assetsSubtitle: document.getElementById("health-assets-subtitle"),
  contributionInput: document.getElementById("health-contribution-input"),
  suggestion: document.getElementById("health-suggestion"),
  projContribution: document.getElementById("proj-contribution"),
  projAppreciation: document.getElementById("proj-appreciation"),
  projYield: document.getElementById("proj-yield"),
  projYears: document.getElementById("proj-years"),
  projReinvest: document.getElementById("proj-reinvest"),
  projFinalLabel: document.getElementById("proj-final-label"),
  projFinal: document.getElementById("proj-final"),
  projRange: document.getElementById("proj-range"),
  projContributed: document.getElementById("proj-contributed"),
  projGain: document.getElementById("proj-gain"),
  projIncome: document.getElementById("proj-income"),
  projIncomeNote: document.getElementById("proj-income-note"),
  projCanvas: document.getElementById("health-projection-chart"),
  settingsBtn: document.getElementById("health-settings-btn"),
  modal: document.getElementById("health-settings-modal"),
  modalBackdrop: document.getElementById("health-settings-backdrop"),
  modalCloseBtn: document.getElementById("health-settings-close-btn"),
  form: document.getElementById("health-settings-form"),
  preset: document.getElementById("health-preset"),
  targetsGrid: document.getElementById("health-targets-grid"),
  targetSum: document.getElementById("health-target-sum"),
  maxAsset: document.getElementById("health-max-asset"),
  minAssets: document.getElementById("health-min-assets"),
};

export let portfolioSettings = null; // null = ainda não configurado (usa o perfil Moderado como referência)
export let lastHealthAnalysis = null;
export let healthProjectionChart = null;
// Os campos da projeção/aporte começam com valores tirados da carteira real, até o usuário editá-los.
export const healthTouched = { contribution: false, projContribution: false, projYield: false };

export const HEALTH_STATUS = {
  healthy: { label: "Carteira saudável", color: "#34d399", desc: "Distribuição dentro das suas metas, com risco bem espalhado." },
  attention: { label: "Pede atenção", color: "#f59e0b", desc: "Alguns pontos fogem das suas metas — veja o diagnóstico abaixo." },
  critical: { label: "Precisa de ajustes", color: "#f87171", desc: "A carteira está concentrada ou longe das metas. Os próximos aportes podem corrigir isso." },
};

export const ALERT_STYLE = {
  critical: { icon: "ph-warning-octagon", color: "text-red-400", bg: "bg-red-500/10 border-red-500/25" },
  warning: { icon: "ph-warning", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25" },
  info: { icon: "ph-info", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25" },
};

export const currentHealthSettings = () => portfolioSettings || DEFAULT_PORTFOLIO_SETTINGS;
export const formatPct = (v, digits = 1) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
export const scoreColor = (s) => (s >= 75 ? "#34d399" : s >= 50 ? "#f59e0b" : "#f87171");

export function initHealthCharts() {
  healthProjectionChart = new Chart(healthEl.projCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true, position: "bottom", labels: { color: "#94a3b8", boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } } },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          titleColor: "#e2e8f0",
          bodyColor: "#cbd5e1",
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 }, maxTicksLimit: 12 } },
        y: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            callback: (v) => (v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)} mi` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)} mil` : `R$ ${v}`),
          },
        },
      },
    },
  });
}

export function renderHealthOverview(a, settings) {
  const status = HEALTH_STATUS[a.status];
  healthEl.ring.style.setProperty("--score", a.score);
  healthEl.ring.style.setProperty("--ring-color", status.color);
  healthEl.score.textContent = a.score;
  healthEl.score.style.color = status.color;
  healthEl.status.textContent = status.label;
  healthEl.status.style.color = status.color;
  healthEl.statusDesc.textContent = status.desc;

  healthEl.profileLabel.textContent = portfolioSettings
    ? `Comparando com as suas metas (${ALLOCATION_PRESETS[settings.preset]?.label || "Personalizado"}) · limite de ${settings.maxAssetPct}% por ativo`
    : "Usando o perfil Moderado como referência — defina as suas metas para uma análise sob medida.";

  healthEl.components.innerHTML = a.components
    .map(
      (c) => `
      <div>
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-medium">${c.label} <span class="text-slate-600">· peso ${c.weight}</span></span>
          <span class="font-bold" style="color:${scoreColor(c.score)};">${Math.round(c.score)}</span>
        </div>
        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-700" style="width:${c.score}%; background:${scoreColor(c.score)};"></div>
        </div>
      </div>`
    )
    .join("");

  healthEl.total.textContent = formatCurrency(a.totalValue);
  healthEl.assets.textContent = `${a.byAsset.length} (${a.effectiveAssets.toLocaleString("pt-BR", { maximumFractionDigits: 1 })})`;
  healthEl.yield.textContent = a.income12m > 0 ? formatPct(a.dividendYield12m, 2) : "—";
}

export function renderHealthAlerts(a) {
  if (a.alerts.length === 0) {
    healthEl.alerts.innerHTML = `
      <div class="flex items-start gap-3 rounded-xl border bg-emerald-500/10 border-emerald-500/25 p-4">
        <i class="ph-fill ph-check-circle text-xl text-emerald-400 shrink-0"></i>
        <div>
          <p class="text-sm font-semibold">Tudo dentro das suas metas</p>
          <p class="text-xs text-slate-400 mt-0.5">Nenhum ativo acima do limite e categorias próximas do planejado. Continue aportando conforme as metas.</p>
        </div>
      </div>`;
    return;
  }
  healthEl.alerts.innerHTML = a.alerts
    .map((al) => {
      const st = ALERT_STYLE[al.level];
      return `
      <div class="flex items-start gap-3 rounded-xl border ${st.bg} p-4">
        <i class="ph-fill ${st.icon} text-xl ${st.color} shrink-0"></i>
        <div>
          <p class="text-sm font-semibold">${escapeHtml(al.title)}</p>
          <p class="text-xs text-slate-400 mt-0.5">${escapeHtml(al.detail)}</p>
        </div>
      </div>`;
    })
    .join("");
}

export function renderHealthDistribution(a, settings) {
  healthEl.categories.innerHTML = a.byCategory
    .map((c) => {
      const color = INVESTMENT_CATEGORY_COLORS[c.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
      const diffColor = Math.abs(c.diff) <= 5 ? "text-emerald-400" : Math.abs(c.diff) <= 10 ? "text-amber-400" : "text-red-400";
      const diffLabel = `${c.diff >= 0 ? "+" : ""}${c.diff.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
      return `
      <div>
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="flex items-center gap-2 text-slate-300 font-medium">
            <span class="w-2.5 h-2.5 rounded-full" style="background:${color};"></span>${escapeHtml(c.category)}
          </span>
          <span class="text-slate-400">
            <span class="font-semibold text-slate-200">${formatPct(c.pct)}</span> / meta ${c.target}%
            <span class="${diffColor} font-semibold ml-1">${diffLabel}</span>
          </span>
        </div>
        <div class="relative w-full h-2 bg-slate-800 rounded-full">
          <div class="h-full rounded-full transition-all duration-700" style="width:${Math.min(100, c.pct)}%; background:${color};"></div>
          <div class="absolute -top-1 w-0.5 h-4 bg-slate-200 rounded-full" style="left:calc(${Math.min(100, c.target)}% - 1px);" title="Meta: ${c.target}%"></div>
        </div>
      </div>`;
    })
    .join("");

  const top = a.byAsset.slice(0, 10);
  const scale = Math.max(top[0]?.pct || 0, settings.maxAssetPct) * 1.1;
  healthEl.assetsSubtitle.textContent =
    a.byAsset.length > top.length
      ? `Os ${top.length} maiores de ${a.byAsset.length} ativos · linha tracejada = seu limite de ${settings.maxAssetPct}%`
      : `Linha tracejada = seu limite de ${settings.maxAssetPct}% por ativo`;
  healthEl.assetBars.innerHTML = top
    .map((asset) => {
      const over = asset.pct > settings.maxAssetPct;
      const color = INVESTMENT_CATEGORY_COLORS[asset.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
      return `
      <div class="flex items-center gap-3">
        <span class="w-16 text-xs font-semibold text-slate-300 truncate">${escapeHtml(asset.ticker)}</span>
        <div class="relative flex-1 h-2 bg-slate-800 rounded-full">
          <div class="h-full rounded-full transition-all duration-700" style="width:${(asset.pct / scale) * 100}%; background:${over ? "#f87171" : color};"></div>
          <div class="absolute -top-1 h-4 border-l border-dashed border-slate-400/70" style="left:${(settings.maxAssetPct / scale) * 100}%;"></div>
        </div>
        <span class="w-14 text-right text-xs font-semibold ${over ? "text-red-400" : "text-slate-400"}">${formatPct(asset.pct)}</span>
      </div>`;
    })
    .join("");
}

export function renderHealthSuggestion() {
  const a = lastHealthAnalysis;
  if (!a || a.empty) return;
  const settings = currentHealthSettings();
  const amount = Number(healthEl.contributionInput.value) || 0;
  const items = suggestContribution(a, settings.targets, amount);

  if (items.length === 0) {
    healthEl.suggestion.innerHTML = `<p class="text-xs text-slate-500 col-span-full">Informe um valor para ver como dividir o aporte.</p>`;
    return;
  }

  const futureTotal = a.totalValue + amount;
  healthEl.suggestion.innerHTML = items
    .map((item) => {
      const color = INVESTMENT_CATEGORY_COLORS[item.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
      const current = a.byCategory.find((c) => c.category === item.category)?.value || 0;
      const after = ((current + item.amount) / futureTotal) * 100;
      const target = settings.targets[item.category] || 0;
      return `
      <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4">
        <p class="flex items-center gap-2 text-xs text-slate-400"><span class="w-2.5 h-2.5 rounded-full" style="background:${color};"></span>${escapeHtml(item.category)}</p>
        <p class="text-lg font-extrabold mt-1">${formatCurrency(item.amount)}</p>
        <p class="text-[11px] text-slate-500 mt-1">${formatPct((item.amount / amount) * 100, 0)} do aporte · fica com ${formatPct(after)} (meta ${target}%)</p>
      </div>`;
    })
    .join("");
}

export function renderHealthProjection() {
  renderFinancialIndependence();
  const a = lastHealthAnalysis;
  if (!healthProjectionChart || !a || a.empty) return;

  const years = Number(healthEl.projYears.value) || 10;
  const base = {
    initial: a.totalValue,
    monthlyContribution: Number(healthEl.projContribution.value) || 0,
    annualYield: Number(healthEl.projYield.value) || 0,
    reinvest: healthEl.projReinvest.checked,
    years,
  };
  const baseRate = Number(healthEl.projAppreciation.value) || 0;
  const scenarios = {
    pessimistic: projectPortfolio({ ...base, annualAppreciation: baseRate - 3 }),
    base: projectPortfolio({ ...base, annualAppreciation: baseRate }),
    optimistic: projectPortfolio({ ...base, annualAppreciation: baseRate + 3 }),
  };

  // Até 2 anos mostra mês a mês; acima disso, um ponto por ano.
  const step = years <= 2 ? 1 : 12;
  const pick = (points) => points.filter((p) => p.month % step === 0);
  const labels = pick(scenarios.base.points).map((p) => (step === 1 ? (p.month === 0 ? "Hoje" : `Mês ${p.month}`) : p.month === 0 ? "Hoje" : `Ano ${p.month / 12}`));

  const modeColor = getModeColor();
  healthProjectionChart.data.labels = labels;
  healthProjectionChart.data.datasets = [
    { label: "Otimista", data: pick(scenarios.optimistic.points).map((p) => p.balance), borderColor: "#34d399", borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.35, fill: false },
    { label: "Base", data: pick(scenarios.base.points).map((p) => p.balance), borderColor: modeColor, backgroundColor: hexToRgba(modeColor, 0.12), borderWidth: 2.5, pointRadius: 0, tension: 0.35, fill: true },
    { label: "Pessimista", data: pick(scenarios.pessimistic.points).map((p) => p.balance), borderColor: "#f87171", borderDash: [5, 5], borderWidth: 2, pointRadius: 0, tension: 0.35, fill: false },
    { label: "Total aportado", data: pick(scenarios.base.points).map((p) => p.contributed), borderColor: "#64748b", borderDash: [2, 4], borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false },
  ];
  healthProjectionChart.update();

  const b = scenarios.base;
  const horizon = `${years} ano${years === 1 ? "" : "s"}`;
  healthEl.projFinalLabel.textContent = `Patrimônio estimado em ${horizon}`;
  healthEl.projFinal.textContent = formatCurrency(b.finalBalance);
  healthEl.projRange.textContent = `Entre ${formatCurrency(scenarios.pessimistic.finalBalance)} e ${formatCurrency(scenarios.optimistic.finalBalance)}`;
  healthEl.projContributed.textContent = formatCurrency(b.totalContributed);
  healthEl.projGain.textContent = `Rendimento estimado: ${formatCurrency(b.finalBalance - b.totalContributed)}`;
  healthEl.projIncome.textContent = formatCurrency(b.monthlyIncome);
  healthEl.projIncomeNote.textContent = base.reinvest
    ? `Ao final de ${horizon}, com proventos reinvestidos até lá`
    : `Ao final de ${horizon} · ${formatCurrency(b.incomeReceived)} recebidos no período`;
}

/** Redesenha a aba inteira a partir da carteira, dos proventos e das metas atuais. */
export function renderPortfolioHealth() {
  if (!healthEl.content) return;
  const settings = currentHealthSettings();
  const a = analyzePortfolioHealth(state.lastInvestments, state.lastDividends, settings, new Date().toLocaleDateString("sv-SE"));
  lastHealthAnalysis = a;

  healthEl.empty.classList.toggle("hidden", !a.empty);
  healthEl.empty.classList.toggle("flex", a.empty);
  healthEl.content.classList.toggle("hidden", a.empty);
  if (a.empty) return;

  // Valores iniciais tirados da carteira real (aporte médio dos últimos 12 meses e yield), até o usuário editar.
  const months = buildMonthlyContributions(state.lastInvestments, 12);
  const avgContribution = Math.round(months.reduce((sum, m) => sum + m.total, 0) / months.length);
  if (!healthTouched.contribution) healthEl.contributionInput.value = avgContribution || 1000;
  if (!healthTouched.projContribution) healthEl.projContribution.value = avgContribution;
  if (!healthTouched.projYield) healthEl.projYield.value = a.income12m > 0 ? Math.round(a.dividendYield12m * 10) / 10 : 0;

  renderHealthOverview(a, settings);
  renderHealthAlerts(a);
  renderHealthDistribution(a, settings);
  renderHealthSuggestion();
  renderHealthProjection();
}

/** Chamado pelo app.js quando as metas salvas no Firestore mudam (null = não configuradas). */
export function setPortfolioSettings(settings) {
  scheduleAlertsRender();
  // A meta de renda (independência financeira) pode existir sem as metas de alocação.
  fiMonthlyIncome = Number(settings?.fiMonthlyIncome) || null;
  portfolioSettings = settings?.targets
    ? {
        ...DEFAULT_PORTFOLIO_SETTINGS,
        ...settings,
        targets: { ...Object.fromEntries(HEALTH_CATEGORIES.map((c) => [c, 0])), ...(settings.targets || {}) },
      }
    : null;
  renderPortfolioHealth();
}

/* -------- Modal: Metas de alocação -------- */
export let portfolioSettingsSubmitHandler = null;

export function onPortfolioSettingsSubmit(handler) {
  portfolioSettingsSubmitHandler = handler;
}

export function readTargetInputs() {
  return Object.fromEntries(
    [...healthEl.targetsGrid.querySelectorAll("input[data-category]")].map((input) => [input.dataset.category, Number(input.value) || 0])
  );
}

export function updateTargetSum() {
  const sum = Object.values(readTargetInputs()).reduce((a, b) => a + b, 0);
  const ok = Math.abs(sum - 100) < 0.01;
  healthEl.targetSum.textContent = ok ? "Total: 100%" : `Total: ${sum.toLocaleString("pt-BR")}% (precisa somar 100%)`;
  healthEl.targetSum.className = `text-xs font-semibold ${ok ? "text-emerald-400" : "text-red-400"}`;
  return ok;
}

export function fillTargetInputs(targets) {
  healthEl.targetsGrid.innerHTML = HEALTH_CATEGORIES.map((category) => {
    const color = INVESTMENT_CATEGORY_COLORS[category] || INVESTMENT_CATEGORY_COLORS["Outros"];
    return `
      <label class="flex items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
        <span class="flex items-center gap-2 text-xs text-slate-300"><span class="w-2 h-2 rounded-full" style="background:${color};"></span>${escapeHtml(category)}</span>
        <input type="number" min="0" max="100" step="1" data-category="${escapeHtml(category)}" value="${Number(targets[category]) || 0}"
          class="w-16 bg-transparent text-right text-sm font-semibold focus:outline-none" />
      </label>`;
  }).join("");
  updateTargetSum();
}

export function openPortfolioSettingsModal() {
  const settings = currentHealthSettings();
  healthEl.preset.value = settings.preset in ALLOCATION_PRESETS ? settings.preset : "personalizado";
  refreshDropdown("health-preset");
  fillTargetInputs(settings.targets);
  healthEl.maxAsset.value = settings.maxAssetPct;
  healthEl.minAssets.value = settings.minAssets;
  healthEl.modal.classList.remove("hidden");
  healthEl.modal.classList.add("flex");
}

export function closePortfolioSettingsModal() {
  healthEl.modal.classList.add("hidden");
  healthEl.modal.classList.remove("flex");
}

export function bindPortfolioHealth() {
  healthEl.settingsBtn?.addEventListener("click", openPortfolioSettingsModal);
  healthEl.modalCloseBtn?.addEventListener("click", closePortfolioSettingsModal);
  healthEl.modalBackdrop?.addEventListener("click", closePortfolioSettingsModal);

  healthEl.preset?.addEventListener("change", () => {
    const preset = ALLOCATION_PRESETS[healthEl.preset.value];
    if (preset) fillTargetInputs(preset.targets);
  });
  healthEl.targetsGrid?.addEventListener("input", () => {
    updateTargetSum();
    if (healthEl.preset.value !== "personalizado") {
      healthEl.preset.value = "personalizado";
      refreshDropdown("health-preset");
    }
  });

  healthEl.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!updateTargetSum()) {
      showToast("As metas por categoria precisam somar 100%.", "error");
      return;
    }
    const maxAssetPct = Number(healthEl.maxAsset.value);
    const minAssets = Math.round(Number(healthEl.minAssets.value));
    if (!(maxAssetPct >= 1 && maxAssetPct <= 100) || !(minAssets >= 1 && minAssets <= 50)) {
      showToast("Confira o limite por ativo (1 a 100%) e o mínimo de ativos (1 a 50).", "error");
      return;
    }
    portfolioSettingsSubmitHandler?.({ preset: healthEl.preset.value, targets: readTargetInputs(), maxAssetPct, minAssets });
  });

  healthEl.contributionInput?.addEventListener("input", () => {
    healthTouched.contribution = true;
    renderHealthSuggestion();
  });
  healthEl.projContribution?.addEventListener("input", () => {
    healthTouched.projContribution = true;
    renderHealthProjection();
  });
  healthEl.projYield?.addEventListener("input", () => {
    healthTouched.projYield = true;
    renderHealthProjection();
  });
  healthEl.projAppreciation?.addEventListener("input", renderHealthProjection);
  healthEl.projYears?.addEventListener("change", renderHealthProjection);
  healthEl.projReinvest?.addEventListener("change", renderHealthProjection);
}

/* -------- Independência financeira -------- */
const fiEl = {
  input: document.getElementById("fi-target-input"),
  current: document.getElementById("fi-current"),
  progress: document.getElementById("fi-progress"),
  progressBar: document.getElementById("fi-progress-bar"),
  progressLabel: document.getElementById("fi-progress-label"),
  required: document.getElementById("fi-required"),
  requiredNote: document.getElementById("fi-required-note"),
  missing: document.getElementById("fi-missing"),
  eta: document.getElementById("fi-eta"),
  etaNote: document.getElementById("fi-eta-note"),
};
let fiMonthlyIncome = null; // meta salva no Firestore
let fiDraftTouched = false;
let fiTargetHandler = null;

export function onFinancialIndependenceTargetChange(handler) {
  fiTargetHandler = handler;
}

function describeMonths(months) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ano${years === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "mês" : "meses"}`);
  return parts.join(" e ") || "menos de 1 mês";
}

export function renderFinancialIndependence() {
  const a = lastHealthAnalysis;
  if (!fiEl.input || !a || a.empty) return;
  if (!fiDraftTouched) fiEl.input.value = fiMonthlyIncome ?? "";

  const target = Number(fiEl.input.value) || 0;
  const currentIncome = (a.totalValue * (a.dividendYield12m || 0)) / 100 / 12;
  const annualYield = Number(healthEl.projYield.value) || 0;
  fiEl.current.textContent = formatCurrency(currentIncome);

  const progress = target > 0 ? Math.min(100, (currentIncome / target) * 100) : 0;
  fiEl.progressBar.style.width = `${progress}%`;
  fiEl.progressLabel.textContent = target > 0 ? `${progress.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
  fiEl.progress.setAttribute("aria-valuenow", Math.round(progress));

  if (target <= 0) {
    fiEl.required.textContent = "—";
    fiEl.requiredNote.textContent = "Informe a renda mensal desejada.";
    fiEl.missing.textContent = "—";
    fiEl.eta.textContent = "—";
    fiEl.etaNote.textContent = "Usa o aporte, a valorização e o yield da projeção.";
    return;
  }

  const plan = financialIndependencePlan({
    initial: a.totalValue,
    monthlyContribution: Number(healthEl.projContribution.value) || 0,
    annualAppreciation: Number(healthEl.projAppreciation.value) || 0,
    annualYield,
    targetMonthlyIncome: target,
  });

  if (plan.requiredWealth == null) {
    fiEl.required.textContent = "—";
    fiEl.requiredNote.textContent = "Informe um dividend yield maior que zero na projeção.";
    fiEl.missing.textContent = "—";
    fiEl.eta.textContent = "—";
    fiEl.etaNote.textContent = "Sem yield, os proventos não pagam renda nenhuma.";
    return;
  }

  fiEl.required.textContent = formatCurrency(plan.requiredWealth);
  fiEl.requiredNote.textContent = `Com yield de ${annualYield.toLocaleString("pt-BR")}% ao ano`;
  fiEl.missing.textContent = formatCurrency(Math.max(0, plan.requiredWealth - a.totalValue));

  if (plan.reachedAlready) {
    fiEl.eta.textContent = "Já alcançada";
    fiEl.etaNote.textContent = "O patrimônio atual já paga a renda desejada.";
  } else if (plan.months == null) {
    fiEl.eta.textContent = "Mais de 60 anos";
    fiEl.etaNote.textContent = "Aumente o aporte mensal ou revise a meta.";
  } else {
    const when = new Date();
    when.setMonth(when.getMonth() + plan.months);
    fiEl.eta.textContent = when.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
    fiEl.etaNote.textContent = `Em ${describeMonths(plan.months)}`;
  }
}

export function bindFinancialIndependence() {
  fiEl.input?.addEventListener("input", () => {
    fiDraftTouched = true;
    renderFinancialIndependence();
  });
  // Salva quando o usuário termina de editar (sair do campo ou Enter).
  fiEl.input?.addEventListener("change", () => {
    const value = Number(fiEl.input.value) || 0;
    fiDraftTouched = false;
    fiMonthlyIncome = value || null;
    fiTargetHandler?.(value);
  });
}
