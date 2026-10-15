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

/**
 * Quantidade de cotas/ações que o usuário tinha ao fim de uma data (compras
 * feitas até o dia inclusive) — é o que define o direito a um provento na
 * data-com.
 */
export function sharesOnDate(inv, isoDate) {
  return getInvestmentPurchases(inv)
    .filter((p) => String(p.date).slice(0, 10) <= isoDate)
    .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
}

const brDateToIso = (br) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/**
 * Normaliza o `cashDividends` da API pública da B3 (datas dd/mm/aaaa e valor
 * com vírgula) para datas ISO e números. Descarta itens sem pagamento definido.
 * @returns {Array<{label:string, rate:number, exDate:string|null, paymentDate:string, approvedOn:string|null, relatedTo:string}>}
 */
export function parseB3CashDividends(cashDividends) {
  const parsed = (Array.isArray(cashDividends) ? cashDividends : [])
    .map((d) => ({
      label: String(d.label || ""),
      rate: Number(String(d.rate ?? "").replace(",", ".")),
      exDate: brDateToIso(d.lastDatePrior),
      paymentDate: brDateToIso(d.paymentDate),
      approvedOn: brDateToIso(d.approvedOn),
      relatedTo: String(d.relatedTo || ""),
    }))
    .filter((d) => Number.isFinite(d.rate) && d.rate > 0 && d.paymentDate);

  // A B3 às vezes lista o mesmo rendimento duas vezes (mesmo mês de referência,
  // valor e data de pagamento, só com data-com diferente). Conta uma vez só,
  // ficando com a data-com mais recente.
  const unique = new Map();
  parsed.forEach((d) => {
    const key = `${d.paymentDate}|${d.rate}|${d.label}|${d.relatedTo}`;
    const existing = unique.get(key);
    if (!existing || (d.exDate || "") > (existing.exDate || "")) unique.set(key, d);
  });
  return [...unique.values()];
}

// Tipo do papel no código ISIN, a partir do sufixo do ticker (3=ON, 4=PN, 11=unit...).
const ISIN_CLASS_BY_TICKER_SUFFIX = { "3": "ACNOR", "4": "ACNPR", "5": "ACNPA", "6": "ACNPB", "7": "ACNPC", "8": "ACNPD", "11": "CDAM" };

/**
 * A B3 lista os proventos de uma empresa por classe de ação (ON, PN, unit) no
 * mesmo conjunto. Fica só com os da classe do ticker informado (ex: TAEE11 = unit).
 * Tickers de classe desconhecida retornam vazio.
 */
export function filterByAssetClass(cashDividends, ticker) {
  const suffix = String(ticker).toUpperCase().replace(/^[A-Z]{4}/, "");
  const isinClass = ISIN_CLASS_BY_TICKER_SUFFIX[suffix];
  if (!isinClass) return [];
  return (Array.isArray(cashDividends) ? cashDividends : []).filter((d) => String(d.assetIssued || "").slice(6).startsWith(isinClass));
}

/** O JCP é divulgado bruto e cai na conta com 15% de IR retido na fonte; dividendos e rendimentos são isentos. */
export function dividendNetAmount(type, rate, shares) {
  return rate * shares * (type === "JCP" ? 0.85 : 1);
}

/**
 * Proventos já anunciados e ainda não pagos (pagamento depois de hoje — o que cai hoje já conta como recebido), com
 * o total que o usuário receberá = valor por cota × cotas que tinha na data-com.
 * @param {Array<Object>} investments posições da carteira
 * @param {Object<string, Array<{type:string, rate:number, exDate:string|null, paymentDate:string}>>} calendars proventos por ticker
 * @param {string} today data ISO de hoje
 */
export function buildUpcomingDividends(investments, calendars, today) {
  const items = [];
  investments.forEach((inv) => {
    (calendars[inv.ticker] || []).forEach((d) => {
      if (d.paymentDate <= today) return;
      const shares = sharesOnDate(inv, d.exDate || d.paymentDate);
      if (shares <= 0) return;
      items.push({ ticker: inv.ticker, type: d.type, rate: d.rate, exDate: d.exDate, paymentDate: d.paymentDate, shares, total: dividendNetAmount(d.type, d.rate, shares) });
    });
  });
  return items.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.ticker.localeCompare(b.ticker));
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
