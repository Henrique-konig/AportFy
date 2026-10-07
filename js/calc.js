// =========================================================
// AportFy — calc.js
// Funções de cálculo puras (sem DOM, sem Firebase, sem fetch).
// Isoladas aqui especificamente pra serem testáveis em Node puro
// (ver tests/calc.test.js) — o resto do app depende de document/
// Firebase no escopo do módulo e não pode ser importado em teste
// sem simular um browser inteiro.
// =========================================================

/**
 * Métricas de uma posição de investimento.
 * @param {{quantity:number, avgPrice:number, currentPrice:number}} inv
 */
export function calcInvestmentMetrics(inv) {
  const quantity = Number(inv.quantity) || 0;
  const avgPrice = Number(inv.avgPrice) || 0;
  const currentPrice = Number(inv.currentPrice) || 0;
  const costBasis = avgPrice * quantity;
  const totalValue = currentPrice * quantity;
  const profitValue = totalValue - costBasis;
  const profitPct = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
  return { quantity, avgPrice, currentPrice, costBasis, totalValue, profitValue, profitPct };
}

/**
 * Recalcula quantidade e preço médio ao somar uma nova compra do mesmo
 * ativo à posição existente: novoPM = (qtdAntiga*pmAntigo + qtdNova*precoNovo) / (qtdAntiga+qtdNova)
 * @param {{quantity:number, avgPrice:number, purchaseDate:string}} existing
 * @param {{quantity:number, price:number, purchaseDate:string}} purchase
 */
export function mergeInvestmentPurchase(existing, purchase) {
  const oldQty = Number(existing.quantity) || 0;
  const oldAvg = Number(existing.avgPrice) || 0;
  const newQty = oldQty + purchase.quantity;
  const newAvg = (oldQty * oldAvg + purchase.quantity * purchase.price) / newQty;
  const purchaseDate = purchase.purchaseDate > existing.purchaseDate ? purchase.purchaseDate : existing.purchaseDate;
  return { quantity: newQty, avgPrice: newAvg, purchaseDate };
}

/**
 * Histórico de compras (aportes) de uma posição. Posições criadas antes do
 * histórico existir não têm `purchases`: viram uma única compra sintética
 * (quantidade × preço médio na data da última compra).
 * @returns {Array<{date:string, quantity:number, price:number}>}
 */
export function getInvestmentPurchases(inv) {
  if (Array.isArray(inv.purchases) && inv.purchases.length > 0) return inv.purchases;
  if (!inv.purchaseDate) return [];
  return [{ date: inv.purchaseDate, quantity: Number(inv.quantity) || 0, price: Number(inv.avgPrice) || 0 }];
}

/**
 * Total aportado por mês nos últimos N meses (do mais antigo ao mais recente),
 * somando quantidade × preço de cada compra.
 * @returns {Array<{key:string, label:string, total:number, count:number}>}
 */
export function buildMonthlyContributions(investments, monthsCount = 12, referenceDate = new Date()) {
  const months = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0, count: 0 });
  }

  investments.forEach((inv) => {
    getInvestmentPurchases(inv).forEach((p) => {
      const month = months.find((m) => m.key === String(p.date).slice(0, 7));
      if (!month) return;
      month.total += (Number(p.quantity) || 0) * (Number(p.price) || 0);
      month.count += 1;
    });
  });

  return months;
}

/** Variação percentual entre dois valores (usado nos KPIs do dashboard). */
export function pctChange(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Série mensal de receitas/despesas dos últimos N meses (base dos
 * gráficos de fluxo de caixa do Dashboard e de Relatórios).
 * @param {Array<{date:string, type:"income"|"expense", amount:number}>} transactions
 * @param {number} monthsCount
 */
export function buildMonthlySeries(transactions, monthsCount = 6, referenceDate = new Date()) {
  const months = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }) });
  }

  const income = months.map(() => 0);
  const expense = months.map(() => 0);

  transactions.forEach((t) => {
    const d = new Date(`${t.date}T00:00:00`);
    const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx === -1) return;
    const amount = Number(t.amount) || 0;
    if (t.type === "income") income[idx] += amount;
    else expense[idx] += amount;
  });

  return { labels: months.map((m) => m.label.replace(".", "")), income, expense };
}

/** Soma as despesas de uma categoria no mês corrente (base dos cards de Orçamento). */
export function calcBudgetSpent(category, transactions, referenceDate = new Date()) {
  return transactions
    .filter((t) => t.type === "expense" && t.category === category)
    .filter((t) => {
      const d = new Date(`${t.date}T00:00:00`);
      return d.getFullYear() === referenceDate.getFullYear() && d.getMonth() === referenceDate.getMonth();
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

/**
 * Data (YYYY-MM-DD) em que uma recorrência deve ser lançada num mês/ano
 * específico, com o dia limitado ao último dia do mês (ex: dia 31
 * configurado cai no dia 28/29 em fevereiro).
 * @param {number} year
 * @param {number} month0 - mês indexado em 0 (janeiro = 0)
 * @param {number} dayOfMonth
 */
export function recurrenceDateForMonth(year, month0, dayOfMonth) {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const day = Math.min(Number(dayOfMonth) || 1, daysInMonth);
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Chave de deduplicação usada ao importar proventos da B3 (evita reimportar o mesmo lançamento). */
export function dividendDedupeKey(ticker, date, type) {
  return `${ticker}|${date}|${type}`;
}
