// =========================================================
// AportFy — ui/investments.js
// Aba Investimentos: carteira, filtros, detalhe do ativo e modais de compra, preço e venda.
// =========================================================

import { setDatePickerValue, closeDatePicker } from "../datepicker.js";
import { refreshDropdown } from "../dropdown.js";
import { calcInvestmentMetrics, buildMonthlyContributions, buildMarketComparison } from "../calc.js";
import { baseLineOptions, hexToRgba } from "./charts.js";
import { AUTO_QUOTE_CATEGORIES, B3_CATEGORIES, INVESTMENT_CATEGORY_COLORS, el, escapeHtml, formatCurrency, formatDate, getModeColor, showToast, state, todayISO } from "./core.js";
import { renderChangeBadge } from "./dashboard.js";
import { formatMonthLabel } from "./dividends.js";
import { openDeleteModal } from "./forms.js";

/* ---------------------------------------------------------------
   Investimentos (view: Investimentos)

   Fórmulas:
   - Preço médio ao somar uma nova compra do mesmo ativo (calculado
     em app.js, não aqui): novoPM = (qtdAntiga*pmAntigo + qtdNova*precoNovo) / (qtdAntiga+qtdNova)
   - Saldo Total (valor de mercado hoje):  precoAtual * quantidade
   - Custo (capital investido no ativo):   precoMedio * quantidade
   - Rendimento em R$:                     saldoTotal - custo
   - Rentabilidade %:                      ((precoAtual - precoMedio) / precoMedio) * 100
--------------------------------------------------------------- */

export function formatQuantity(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

export let editInvestmentPriceHandler = null;

export function onEditInvestmentPrice(handler) {
  editInvestmentPriceHandler = handler;
}

/** Aplica ativo, categoria e busca da barra de filtros — usado por tabela, KPIs, gráficos e aportes. */
export function getFilteredInvestments(investments, { includeClosed = false } = {}) {
  const term = (el.invSearchInput.value || "").toLowerCase().trim();
  const categoryFilter = el.invCategoryFilter.value;

  // Posições vendidas por completo ficam com quantidade 0: somem da carteira, mas seguem no histórico.
  let filtered = includeClosed ? investments : investments.filter((inv) => (Number(inv.quantity) || 0) > 0);
  if (state.invAssetFilterValue !== "all") filtered = filtered.filter((inv) => inv.ticker === state.invAssetFilterValue);
  if (categoryFilter !== "all") filtered = filtered.filter((inv) => inv.category === categoryFilter);
  if (term) {
    filtered = filtered.filter(
      (inv) => inv.ticker.toLowerCase().includes(term) || (inv.name || "").toLowerCase().includes(term)
    );
  }
  return filtered;
}

/** Redesenha tudo na aba Investimentos que depende dos filtros (tabela, KPIs, gráficos e aportes). */
export function refreshInvestmentViews() {
  const filtered = getFilteredInvestments(state.lastInvestments);
  renderInvestmentsTable(state.lastInvestments);
  updateInvestmentKPIs(filtered);
  updateInvestmentCharts(filtered);
  // Aportes e a comparação com o mercado contam também posições já vendidas.
  const withClosed = getFilteredInvestments(state.lastInvestments, { includeClosed: true });
  renderMonthlyContributions(withClosed);
  renderMarketComparison(withClosed);
}

export function renderInvestmentsTable(investments) {
  const filtered = getFilteredInvestments(investments);

  const withMetrics = filtered.map((inv) => ({ inv, m: calcInvestmentMetrics(inv) }));

  if (state.invTypeSort === "profit") withMetrics.sort((a, b) => b.m.profitPct - a.m.profitPct);
  else if (state.invTypeSort === "balance") withMetrics.sort((a, b) => b.m.totalValue - a.m.totalValue);
  else withMetrics.sort((a, b) => (b.inv.purchaseDate || "").localeCompare(a.inv.purchaseDate || ""));

  el.invCount.textContent = `${withMetrics.length} ativo${withMetrics.length === 1 ? "" : "s"}`;

  if (withMetrics.length === 0) {
    el.investmentsTbody.innerHTML = "";
    el.investmentsEmpty.classList.remove("hidden");
    el.investmentsEmpty.classList.add("flex");
    return;
  }

  el.investmentsEmpty.classList.add("hidden");
  el.investmentsEmpty.classList.remove("flex");

  el.investmentsTbody.innerHTML = withMetrics
    .map(({ inv, m }) => {
      const color = INVESTMENT_CATEGORY_COLORS[inv.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
      const positive = m.profitPct >= 0;
      const isB3 = B3_CATEGORIES.includes(inv.category);
      const warningIcon = inv.lastQuoteError
        ? `<i class="ph-fill ph-warning-circle text-amber-400 ml-1.5" title="Não foi possível atualizar a cotação agora. Mostrando o último preço salvo."></i>`
        : "";
      const b3Badge = isB3
        ? `<i class="ph-fill ph-globe text-slate-600 ml-1.5" title="Cotação automática via B3 (Brapi)"></i>`
        : inv.category === "Criptomoedas"
          ? `<i class="ph-fill ph-globe text-slate-600 ml-1.5" title="Cotação automática (Binance / CoinGecko)"></i>`
          : "";
      return `
        <tr class="animate-fade-in" data-id="${inv.id}">
          <td class="px-5 sm:px-6 py-4 font-medium">
            <div class="flex items-center gap-3">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold" style="background:${color}22; color:${color};">
                ${escapeHtml((inv.ticker || "?").slice(0, 2).toUpperCase())}
              </span>
              <div class="min-w-0">
                <p class="truncate max-w-[140px] flex items-center">${escapeHtml(inv.ticker)}${b3Badge}${warningIcon}</p>
                ${inv.name && inv.name !== inv.ticker ? `<p class="text-[11px] text-slate-500 truncate max-w-[140px]">${escapeHtml(inv.name)}</p>` : ""}
              </div>
            </div>
          </td>
          <td class="px-5 sm:px-6 py-4">
            <span class="category-badge">
              <span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>
              ${escapeHtml(inv.category)}
            </span>
          </td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${formatCurrency(m.avgPrice)}</td>
          <td class="px-5 sm:px-6 py-4 text-right">
            <button class="edit-price-btn hover:text-blue-400 transition-colors" data-id="${inv.id}" title="Editar preço atual">
              ${formatCurrency(m.currentPrice)} <i class="ph-bold ph-pencil-simple text-xs ml-0.5"></i>
            </button>
          </td>
          <td class="px-5 sm:px-6 py-4 text-right text-slate-400">${formatQuantity(m.quantity)}</td>
          <td class="px-5 sm:px-6 py-4 text-right font-semibold">${formatCurrency(m.totalValue)}</td>
          <td class="px-5 sm:px-6 py-4 text-right font-semibold ${positive ? "text-emerald-400" : "text-red-400"}">
            <div class="flex items-center justify-end gap-1">
              <i class="ph-bold ${positive ? "ph-trend-up" : "ph-trend-down"}"></i>
              ${positive ? "+" : ""}${m.profitPct.toFixed(2)}%
            </div>
          </td>
          <td class="px-5 sm:px-6 py-4">
            <div class="flex items-center justify-end gap-1.5">
              <button class="row-action-btn sell-investment-btn" data-id="${inv.id}" title="Registrar venda">
                <i class="ph-bold ph-hand-coins"></i>
              </button>
              <button class="row-action-btn edit-investment-btn" data-id="${inv.id}" title="Editar ativo">
                <i class="ph-bold ph-pencil-simple"></i>
              </button>
              <button class="row-action-btn delete-btn delete-investment-btn" data-id="${inv.id}" title="Excluir">
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  el.investmentsTbody.querySelectorAll(".edit-price-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = investments.find((i) => i.id === btn.dataset.id);
      if (inv) openPriceEditModal(inv);
    });
  });
  el.investmentsTbody.querySelectorAll(".sell-investment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = investments.find((i) => i.id === btn.dataset.id);
      if (inv) openSellModal(inv);
    });
  });
  el.investmentsTbody.querySelectorAll(".edit-investment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inv = investments.find((i) => i.id === btn.dataset.id);
      if (inv) editInvestmentHandler?.(inv);
    });
  });
  el.investmentsTbody.querySelectorAll(".delete-investment-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, "investment"));
  });
}

export function updateInvestmentKPIs(investments) {
  const withMetrics = investments.map((inv) => ({ inv, m: calcInvestmentMetrics(inv) }));

  const totalValue = withMetrics.reduce((sum, x) => sum + x.m.totalValue, 0);
  const totalCost = withMetrics.reduce((sum, x) => sum + x.m.costBasis, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitPct = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  el.invKpiTotal.textContent = formatCurrency(totalValue);
  el.invKpiProfit.textContent = formatCurrency(totalProfit);
  el.invKpiProfit.classList.toggle("text-emerald-400", totalProfit >= 0);
  el.invKpiProfit.classList.toggle("text-red-400", totalProfit < 0);
  renderChangeBadge(el.invKpiProfitPct, totalProfitPct);

  // Rendimento do mês: apenas ativos comprados no mês atual (mede como as
  // compras recentes estão performando, já que não guardamos histórico
  // diário de preços para recalcular o patrimônio em datas passadas).
  const now = new Date();
  const monthPositions = withMetrics.filter((x) => {
    const d = new Date(`${x.inv.purchaseDate}T00:00:00`);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthCost = monthPositions.reduce((sum, x) => sum + x.m.costBasis, 0);
  const monthProfit = monthPositions.reduce((sum, x) => sum + x.m.profitValue, 0);
  const monthPct = monthCost > 0 ? (monthProfit / monthCost) * 100 : 0;
  el.invKpiMonth.textContent = `${monthPct >= 0 ? "+" : ""}${monthPct.toFixed(1)}%`;
  el.invKpiMonth.classList.toggle("text-emerald-400", monthPct >= 0 && monthPositions.length > 0);
  el.invKpiMonth.classList.toggle("text-red-400", monthPct < 0);

  if (withMetrics.length === 0) {
    el.invKpiBestTicker.textContent = "—";
    el.invKpiBestPct.textContent = "0%";
    return;
  }

  const best = withMetrics.reduce((a, b) => (b.m.profitPct > a.m.profitPct ? b : a));
  el.invKpiBestTicker.textContent = best.inv.ticker;
  el.invKpiBestPct.textContent = `${best.m.profitPct >= 0 ? "+" : ""}${best.m.profitPct.toFixed(2)}%`;
  el.invKpiBestPct.classList.toggle("text-emerald-400", best.m.profitPct >= 0);
  el.invKpiBestPct.classList.toggle("text-red-400", best.m.profitPct < 0);
}

export function initInvestmentCharts() {
  initMarketChart();
  state.invEvolutionChart = new Chart(el.invEvolutionCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });

  state.invContribChart = new Chart(el.invContribCanvas.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
        y: {
          grid: { color: "rgba(51,65,85,0.35)" },
          ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + v },
        },
      },
    },
  });

  state.invAllocationChart = new Chart(el.invAllocationCanvas.getContext("2d"), {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#0f172a", borderColor: "#334155", borderWidth: 1, padding: 10 },
      },
    },
  });
}

/** Aportes (compras) por mês nos últimos 12 meses — respeita o filtro de ativo da aba. */
export function renderMonthlyContributions(investments) {
  if (!state.invContribChart) return;

  const months = buildMonthlyContributions(investments, 12);

  const total = months.reduce((sum, m) => sum + m.total, 0);
  el.invContribTotal.textContent = formatCurrency(total);
  el.invContribAvg.textContent = formatCurrency(total / months.length);
  el.invContribSubtitle.textContent =
    state.invAssetFilterValue !== "all"
      ? `Quanto você investiu em ${state.invAssetFilterValue} nos últimos 12 meses`
      : investments.length < state.lastInvestments.length
        ? "Quanto você investiu nos ativos filtrados nos últimos 12 meses"
        : "Quanto você investiu em cada um dos últimos 12 meses";

  const modeColor = getModeColor();
  state.invContribChart.data.labels = months.map((m) => m.label);
  state.invContribChart.data.datasets = [
    { label: "Aportes", data: months.map((m) => m.total), backgroundColor: hexToRgba(modeColor, 0.7), borderRadius: 6, barThickness: 22 },
  ];
  state.invContribChart.update();

  el.invContribTbody.innerHTML = months
    .slice()
    .reverse()
    .map(
      (m) => `
        <tr class="border-b border-slate-800/40 last:border-0">
          <td class="py-3 font-medium capitalize">${formatMonthLabel(m.key)}</td>
          <td class="py-3 text-right text-slate-400">${m.count || "—"}</td>
          <td class="py-3 text-right font-semibold ${m.total > 0 ? "" : "text-slate-600"}">${m.total > 0 ? formatCurrency(m.total) : "—"}</td>
        </tr>`
    )
    .join("");
}

export function updateInvestmentCharts(investments) {
  if (!state.invEvolutionChart || !state.invAllocationChart) return;

  // Capital investido acumulado por mês, segmentado por categoria (custo
  // de aquisição, não valor de mercado — não há preço histórico diário
  // para reconstruir a evolução real de mercado no passado).
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") });
  }

  const categoriesPresent = [...new Set(investments.map((inv) => inv.category))];

  const evolutionDatasets = categoriesPresent.map((category) => {
    const color = INVESTMENT_CATEGORY_COLORS[category] || INVESTMENT_CATEGORY_COLORS["Outros"];
    const monthlyCost = months.map(() => 0);

    investments
      .filter((inv) => inv.category === category)
      .forEach((inv) => {
        const d = new Date(`${inv.purchaseDate}T00:00:00`);
        const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
        if (idx === -1) return;
        monthlyCost[idx] += (Number(inv.avgPrice) || 0) * (Number(inv.quantity) || 0);
      });

    let running = 0;
    const cumulative = monthlyCost.map((v) => (running += v));

    return {
      label: category,
      data: cumulative,
      borderColor: color,
      backgroundColor: hexToRgba(color, 0.08),
      fill: false,
      tension: 0.4,
      pointRadius: 2.5,
      pointBackgroundColor: color,
      pointBorderColor: "#0f172a",
      pointBorderWidth: 1.5,
      borderWidth: 2.25,
    };
  });

  state.invEvolutionChart.data.labels = months.map((m) => m.label);
  state.invEvolutionChart.data.datasets = evolutionDatasets;
  state.invEvolutionChart.update();

  el.invEvolutionLegend.innerHTML = categoriesPresent.length
    ? categoriesPresent
        .map((c) => {
          const color = INVESTMENT_CATEGORY_COLORS[c] || INVESTMENT_CATEGORY_COLORS["Outros"];
          return `<span class="flex items-center gap-1.5 text-slate-400"><span class="w-2.5 h-2.5 rounded-full" style="background:${color};"></span>${escapeHtml(c)}</span>`;
        })
        .join("")
    : `<p class="text-slate-600">Sem ativos cadastrados.</p>`;

  const totals = {};
  investments.forEach((inv) => {
    const m = calcInvestmentMetrics(inv);
    totals[inv.category] = (totals[inv.category] || 0) + m.totalValue;
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);
  const colors = labels.map((c) => INVESTMENT_CATEGORY_COLORS[c] || INVESTMENT_CATEGORY_COLORS["Outros"]);

  state.invAllocationChart.data.labels = labels;
  state.invAllocationChart.data.datasets = [
    {
      data: values.length ? values : [1],
      backgroundColor: values.length ? colors : ["#1e293b"],
      borderColor: "#0f172a",
      borderWidth: 3,
      hoverOffset: 6,
    },
  ];
  state.invAllocationChart.update();

  const total = values.reduce((a, b) => a + b, 0);
  el.invAllocationLegend.innerHTML = labels.length
    ? labels
        .map((label, i) => {
          const pct = total > 0 ? ((values[i] / total) * 100).toFixed(0) : 0;
          return `
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-slate-400">
              <span class="w-2.5 h-2.5 rounded-full" style="background:${colors[i]};"></span>
              ${escapeHtml(label)}
            </span>
            <span class="font-semibold text-slate-300">${pct}%</span>
          </div>`;
        })
        .join("")
    : `<p class="text-slate-600 text-center">Sem ativos cadastrados.</p>`;
}

/* ---------------------------------------------------------------
   Filtro por ativo (compartilhado entre tabela, detalhe e proventos)
--------------------------------------------------------------- */
export function populateAssetFilter(investments) {
  const tickers = [...new Set(investments.map((inv) => inv.ticker))].sort();
  const current = el.invAssetFilter.value;

  el.invAssetFilter.innerHTML =
    `<option value="all">Todos os ativos</option>` +
    tickers.map((t) => `<option value="${t.replace(/"/g, "&quot;")}">${escapeHtml(t)}</option>`).join("");

  el.invAssetFilter.value = tickers.includes(current) ? current : "all";
  state.invAssetFilterValue = el.invAssetFilter.value;
  refreshDropdown("inv-asset-filter");
}

export function populateDividendTickerSelect(investments) {
  const tickers = [...new Set(investments.map((inv) => inv.ticker))].sort();
  const current = el.dividendTicker.value;

  el.dividendTicker.innerHTML = tickers.length
    ? tickers.map((t) => `<option value="${t.replace(/"/g, "&quot;")}">${escapeHtml(t)}</option>`).join("")
    : `<option value="">Cadastre um ativo primeiro</option>`;

  if (tickers.includes(current)) el.dividendTicker.value = current;
  refreshDropdown("dividend-ticker");
}

/* ---------------------------------------------------------------
   Detalhe do ativo selecionado (evolução de preço + proventos)
--------------------------------------------------------------- */
export function initAssetDetailChart() {
  state.assetDetailChart = new Chart(el.assetDetailCanvas.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: baseLineOptions,
  });
}

export function renderAssetDetail(investments, dividends) {
  if (state.invAssetFilterValue === "all") {
    el.assetDetailCard.classList.add("hidden");
    return;
  }

  const inv = investments.find((i) => i.ticker === state.invAssetFilterValue);
  if (!inv) {
    el.assetDetailCard.classList.add("hidden");
    return;
  }

  el.assetDetailCard.classList.remove("hidden");

  const m = calcInvestmentMetrics(inv);
  const color = INVESTMENT_CATEGORY_COLORS[inv.category] || INVESTMENT_CATEGORY_COLORS["Outros"];

  el.assetDetailIcon.style.background = `${color}22`;
  el.assetDetailIcon.style.color = color;
  el.assetDetailIcon.textContent = (inv.ticker || "?").slice(0, 2).toUpperCase();
  el.assetDetailTicker.textContent = inv.ticker;
  el.assetDetailCategory.innerHTML = `<span class="w-1.5 h-1.5 rounded-full" style="background:${color};"></span>${escapeHtml(inv.category)}`;
  el.assetDetailQty.textContent = formatQuantity(m.quantity);
  el.assetDetailAvg.textContent = formatCurrency(m.avgPrice);
  el.assetDetailTotal.textContent = formatCurrency(m.totalValue);

  const tickerDividends = dividends.filter((d) => d.ticker === inv.ticker);
  const totalDividends = tickerDividends.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  el.assetDetailDividends.textContent = formatCurrency(totalDividends);

  const history = Array.isArray(inv.priceHistory) ? inv.priceHistory : [];
  if (!state.assetDetailChart) return;

  if (history.length < 2) {
    el.assetDetailChartWrap.classList.add("hidden");
    el.assetDetailEmptyHint.classList.remove("hidden");
    return;
  }
  el.assetDetailChartWrap.classList.remove("hidden");
  el.assetDetailEmptyHint.classList.add("hidden");

  const ctx = el.assetDetailCanvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, hexToRgba(color, 0.3));
  gradient.addColorStop(1, hexToRgba(color, 0));

  state.assetDetailChart.data.labels = history.map((h) => formatDate(h.date));
  state.assetDetailChart.data.datasets = [
    {
      label: inv.ticker,
      data: history.map((h) => h.price),
      borderColor: color,
      backgroundColor: gradient,
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: color,
      pointBorderColor: "#0f172a",
      pointBorderWidth: 2,
      borderWidth: 2.25,
    },
  ];
  state.assetDetailChart.update();
}

/* ---------------------------------------------------------------
   Modal: Novo Investimento
--------------------------------------------------------------- */
export let investmentSubmitHandler = null;

export function onInvestmentFormSubmit(handler) {
  investmentSubmitHandler = handler;
}

export const INVESTMENT_DATE_PLACEHOLDER = "Selecionar data";
export let priceManuallyEdited = false;

export let editInvestmentHandler = null;

export function onEditInvestment(handler) {
  editInvestmentHandler = handler;
}

export function openInvestmentModal(investment = null) {
  el.investmentForm.reset();

  if (investment) {
    el.investmentModalTitle.textContent = "Editar Ativo";
    el.investmentSubmitLabel.textContent = "Salvar Alterações";
    el.investmentMergeHint.textContent = "Você está editando esta posição diretamente — quantidade e preço médio serão substituídos pelos valores informados.";
    el.investmentId.value = investment.id;
    el.investmentTicker.value = investment.ticker;
    el.investmentCategory.value = investment.category;
    el.investmentQuantity.value = investment.quantity;
    el.investmentPrice.value = investment.avgPrice;
    setDatePickerValue("investment-date", "investment-date-label", investment.purchaseDate, INVESTMENT_DATE_PLACEHOLDER);
    // Evita que um blur acidental no ticker sobrescreva o preço médio já
    // registrado com a cotação atual — só o botão manual faz isso na edição.
    priceManuallyEdited = true;
  } else {
    el.investmentModalTitle.textContent = "Novo Ativo";
    el.investmentSubmitLabel.textContent = "Salvar Investimento";
    el.investmentMergeHint.textContent = "Se você já tem esse ativo na carteira, a nova compra é somada e o preço médio recalculado automaticamente.";
    el.investmentId.value = "";
    setDatePickerValue("investment-date", "investment-date-label", todayISO(), INVESTMENT_DATE_PLACEHOLDER);
    priceManuallyEdited = false;
  }

  refreshDropdown("investment-category");
  el.investmentPriceHint.classList.add("hidden");
  el.investmentModal.classList.remove("hidden");
  el.investmentModal.classList.add("flex");
}

export function closeInvestmentModal() {
  el.investmentModal.classList.add("hidden");
  el.investmentModal.classList.remove("flex");
  closeDatePicker();
}

/* -------- Busca automática do preço atual na B3 (Ações/FIIs) -------- */
export let fetchB3PriceHandler = null;

/** Registra o handler que efetivamente consulta a Brapi (implementado em app.js). */
export function onFetchB3Price(handler) {
  fetchB3PriceHandler = handler;
}

export function setB3PriceFetchLoading(loading) {
  el.investmentFetchPriceBtn.disabled = loading;
  el.investmentFetchPriceIcon.classList.toggle("animate-spin", loading);
}

/** Preenche o campo de preço com a cotação buscada (não conta como edição manual). */
export function fillInvestmentPrice(price) {
  el.investmentPrice.value = price.toFixed(2);
  showInvestmentPriceHint(`Preço atual da B3: ${formatCurrency(price)}`, false);
}

export function showInvestmentPriceHint(message, isError) {
  el.investmentPriceHint.textContent = message;
  el.investmentPriceHint.classList.remove("hidden");
  el.investmentPriceHint.classList.toggle("text-red-400", isError);
  el.investmentPriceHint.classList.toggle("text-emerald-400", !isError);
}

export function triggerB3PriceFetch() {
  const ticker = el.investmentTicker.value.trim();
  const category = el.investmentCategory.value;
  if (!ticker || !AUTO_QUOTE_CATEGORIES.includes(category)) return;
  if (priceManuallyEdited) return;
  fetchB3PriceHandler?.(ticker, category);
}

export function bindInvestmentModal() {
  el.newInvestmentBtn?.addEventListener("click", () => openInvestmentModal());
  el.investmentModalCloseBtn?.addEventListener("click", closeInvestmentModal);
  el.investmentModalBackdrop?.addEventListener("click", closeInvestmentModal);

  // Digitou o ticker ou trocou a categoria para Ações/FIIs: busca o preço
  // atual sozinho, sem esperar o usuário clicar em nada.
  el.investmentTicker?.addEventListener("blur", triggerB3PriceFetch);
  el.investmentCategory?.addEventListener("change", triggerB3PriceFetch);

  // Botão explícito sempre busca de novo, mesmo que o preço já tenha sido
  // editado manualmente (ação intencional do usuário sobrepõe o valor).
  el.investmentFetchPriceBtn?.addEventListener("click", () => {
    const ticker = el.investmentTicker.value.trim();
    const category = el.investmentCategory.value;
    if (!ticker) {
      showInvestmentPriceHint("Digite o ticker antes de buscar.", true);
      return;
    }
    if (!AUTO_QUOTE_CATEGORIES.includes(category)) {
      showInvestmentPriceHint("Essa categoria não tem cotação automática — informe o preço manualmente.", true);
      return;
    }
    priceManuallyEdited = false;
    fetchB3PriceHandler?.(ticker, category);
  });

  // Se o usuário digitar um valor à mão, o próximo blur do ticker não
  // deve sobrescrever silenciosamente o que ele já escreveu.
  el.investmentPrice?.addEventListener("input", () => {
    priceManuallyEdited = true;
  });

  el.investmentForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!el.investmentDate.value) {
      showToast("Selecione a data da compra.", "error");
      return;
    }
    const data = {
      ticker: el.investmentTicker.value.trim(),
      category: el.investmentCategory.value,
      purchaseDate: el.investmentDate.value,
      quantity: parseFloat(el.investmentQuantity.value),
      price: parseFloat(el.investmentPrice.value),
    };
    const editingId = el.investmentId.value || null;
    investmentSubmitHandler?.(data, editingId);
  });
}

/* ---------------------------------------------------------------
   Modal: Editar Preço Atual
--------------------------------------------------------------- */
export let priceEditSubmitHandler = null;

export function onPriceEditSubmit(handler) {
  priceEditSubmitHandler = handler;
}

export function openPriceEditModal(investment) {
  el.priceEditId.value = investment.id;
  el.priceEditTickerDisplay.value = investment.ticker;
  el.priceEditValue.value = investment.currentPrice;
  el.priceEditModal.classList.remove("hidden");
  el.priceEditModal.classList.add("flex");
}

export function closePriceEditModal() {
  el.priceEditModal.classList.add("hidden");
  el.priceEditModal.classList.remove("flex");
}

export function bindPriceEditModal() {
  el.priceEditModalCloseBtn?.addEventListener("click", closePriceEditModal);
  el.priceEditModalBackdrop?.addEventListener("click", closePriceEditModal);

  el.priceEditForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = el.priceEditId.value;
    const price = parseFloat(el.priceEditValue.value);
    priceEditSubmitHandler?.(id, price);
    closePriceEditModal();
  });
}

/* ---------------------------------------------------------------
   Modal: Registrar Venda (view: Investimentos)
--------------------------------------------------------------- */
export const sellEl = {
  modal: document.getElementById("sell-modal"),
  backdrop: document.getElementById("sell-modal-backdrop"),
  closeBtn: document.getElementById("sell-modal-close-btn"),
  form: document.getElementById("sell-form"),
  id: document.getElementById("sell-id"),
  ticker: document.getElementById("sell-ticker"),
  position: document.getElementById("sell-position"),
  allBtn: document.getElementById("sell-all-btn"),
  quantity: document.getElementById("sell-quantity"),
  price: document.getElementById("sell-price"),
  date: document.getElementById("sell-date"),
  total: document.getElementById("sell-total"),
  resultLabel: document.getElementById("sell-result-label"),
  result: document.getElementById("sell-result"),
};
export const SELL_DATE_PLACEHOLDER = "Selecionar data";
export let sellSubmitHandler = null;
export let sellingInvestment = null;

export function onSellSubmit(handler) {
  sellSubmitHandler = handler;
}

export function updateSellPreview() {
  if (!sellingInvestment) return;
  const quantity = Number(sellEl.quantity.value) || 0;
  const price = Number(sellEl.price.value) || 0;
  const result = (price - (Number(sellingInvestment.avgPrice) || 0)) * quantity;
  sellEl.total.textContent = formatCurrency(quantity * price);
  sellEl.resultLabel.textContent = result >= 0 ? "Lucro estimado" : "Prejuízo estimado";
  sellEl.result.textContent = formatCurrency(Math.abs(result));
  sellEl.result.classList.toggle("text-emerald-400", result > 0);
  sellEl.result.classList.toggle("text-red-400", result < 0);
}

export function openSellModal(investment) {
  sellingInvestment = investment;
  sellEl.form.reset();
  sellEl.id.value = investment.id;
  sellEl.ticker.textContent = investment.ticker;
  sellEl.position.textContent = `${formatQuantity(Number(investment.quantity) || 0)} em carteira · preço médio ${formatCurrency(Number(investment.avgPrice) || 0)}`;
  sellEl.quantity.max = investment.quantity;
  sellEl.price.value = Number(investment.currentPrice) || "";
  setDatePickerValue("sell-date", "sell-date-label", todayISO(), SELL_DATE_PLACEHOLDER);
  updateSellPreview();
  sellEl.modal.classList.remove("hidden");
  sellEl.modal.classList.add("flex");
}

export function closeSellModal() {
  sellEl.modal.classList.add("hidden");
  sellEl.modal.classList.remove("flex");
  closeDatePicker();
  sellingInvestment = null;
}

export function bindSellModal() {
  sellEl.closeBtn?.addEventListener("click", closeSellModal);
  sellEl.backdrop?.addEventListener("click", closeSellModal);
  sellEl.quantity?.addEventListener("input", updateSellPreview);
  sellEl.price?.addEventListener("input", updateSellPreview);
  sellEl.allBtn?.addEventListener("click", () => {
    if (!sellingInvestment) return;
    sellEl.quantity.value = sellingInvestment.quantity;
    updateSellPreview();
  });
  sellEl.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!sellingInvestment) return;
    const quantity = Number(sellEl.quantity.value);
    const price = Number(sellEl.price.value);
    const available = Number(sellingInvestment.quantity) || 0;
    if (!(quantity > 0) || quantity > available + 1e-9) {
      showToast(`Informe uma quantidade entre 0 e ${formatQuantity(available)}.`, "error");
      return;
    }
    if (!(price >= 0)) {
      showToast("Informe o preço de venda.", "error");
      return;
    }
    if (!sellEl.date.value) {
      showToast("Selecione a data da venda.", "error");
      return;
    }
    sellSubmitHandler?.({ id: sellingInvestment.id, quantity, price, date: sellEl.date.value });
  });
}

/* ---------------------------------------------------------------
   Carteira x Mercado (CDI, IBOV, IFIX)
--------------------------------------------------------------- */
const marketEl = {
  cards: document.getElementById("market-cards"),
  chartWrap: document.getElementById("market-chart-wrap"),
  canvas: document.getElementById("market-chart"),
  status: document.getElementById("market-status"),
};
const MARKET_SERIES = {
  cdi: { label: "CDI", color: "#34d399" },
  ibov: { label: "IBOV", color: "#f59e0b" },
  ifix: { label: "IFIX", color: "#f97316" },
};
let marketChart = null;
let marketIndices = null;
let marketStatus = "idle";

function initMarketChart() {
  if (!marketEl.canvas) return;
  marketChart = new Chart(marketEl.canvas.getContext("2d"), {
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
          filter: (item) => item.parsed.y != null,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 11 }, maxTicksLimit: 12 } },
        y: { grid: { color: "rgba(51,65,85,0.35)" }, ticks: { color: "#64748b", font: { size: 11 }, callback: (v) => "R$ " + Number(v).toLocaleString("pt-BR") } },
      },
    },
  });
}

/** Chamado pelo app.js com as séries de índices (status: idle | loading | ready | error). */
export function setMarketIndices(indices, status) {
  marketIndices = indices;
  marketStatus = status;
  renderMarketComparison(getFilteredInvestments(state.lastInvestments, { includeClosed: true }));
}

function marketCardHtml(label, value, pct, color, highlight, diffVsPortfolio) {
  const pctLabel = pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const diff =
    diffVsPortfolio == null
      ? ""
      : `<p class="text-[11px] mt-1 ${diffVsPortfolio >= 0 ? "text-emerald-400" : "text-red-400"}">Carteira ${diffVsPortfolio >= 0 ? "à frente" : "atrás"} em ${Math.abs(diffVsPortfolio).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.</p>`;
  return `
    <div class="rounded-xl p-4 border ${highlight ? "bg-slate-900/70 border-slate-700" : "bg-slate-900/40 border-slate-800/80"}">
      <p class="flex items-center gap-2 text-[11px] text-slate-400"><span class="w-2 h-2 rounded-full" style="background:${color};"></span>${label}</p>
      <p class="text-lg font-extrabold mt-1">${formatCurrency(value)}</p>
      <p class="text-xs font-semibold ${pct == null ? "text-slate-500" : pct >= 0 ? "text-emerald-400" : "text-red-400"}">${pctLabel}</p>
      ${diff}
    </div>`;
}

export function renderMarketComparison(investments) {
  if (!marketEl.cards) return;
  const showStatus = (message) => {
    marketEl.status.textContent = message;
    marketEl.status.classList.toggle("hidden", !message);
    marketEl.chartWrap.classList.toggle("hidden", !!message);
  };

  const tickers = new Set(investments.map((inv) => inv.ticker));
  const today = new Date().toLocaleDateString("sv-SE");
  const comparison = buildMarketComparison(investments, state.lastDividends.filter((d) => tickers.has(d.ticker)), marketIndices || {}, today);

  if (comparison.empty) {
    marketEl.cards.innerHTML = "";
    return showStatus("Registre compras para comparar a carteira com o mercado.");
  }

  const modeColor = getModeColor();
  const cards = [marketCardHtml("Sua carteira", comparison.portfolioTotal, comparison.portfolioPct, modeColor, true, null)];
  for (const [key, meta] of Object.entries(MARKET_SERIES)) {
    const b = comparison.benchmarks[key];
    const hasData = marketStatus === "ready" && b;
    const diff = hasData && comparison.portfolioPct != null && b.pct != null ? comparison.portfolioPct - b.pct : null;
    cards.push(marketCardHtml(meta.label, hasData ? b.final : 0, hasData ? b.pct : null, meta.color, false, diff));
  }
  marketEl.cards.innerHTML = cards.join("");

  if (marketStatus === "loading") return showStatus("Buscando CDI, IBOV e IFIX…");
  if (marketStatus === "error") return showStatus("Não foi possível buscar os índices agora (disponível com o app publicado na Vercel).");
  if (marketStatus !== "ready") return showStatus("");
  showStatus("");

  if (!marketChart) return;
  const labels = comparison.dates.map((d, i) =>
    i === comparison.dates.length - 1 ? "Hoje" : new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "")
  );
  const lastIndex = comparison.dates.length - 1;
  marketChart.data.labels = labels;
  marketChart.data.datasets = [
    { label: "Valor investido", data: comparison.invested, borderColor: "#64748b", borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false },
    ...Object.entries(MARKET_SERIES)
      .filter(([key]) => comparison.benchmarks[key])
      .map(([key, meta]) => ({ label: meta.label, data: comparison.benchmarks[key].values, borderColor: meta.color, borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false })),
    {
      label: "Sua carteira (hoje)",
      data: comparison.dates.map((_, i) => (i === lastIndex ? comparison.portfolioTotal : null)),
      borderColor: modeColor,
      backgroundColor: modeColor,
      pointRadius: 6,
      pointHoverRadius: 7,
      showLine: false,
    },
  ];
  marketChart.update();
}
