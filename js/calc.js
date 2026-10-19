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
  const upTo = (list) =>
    list.filter((x) => String(x.date).slice(0, 10) <= isoDate).reduce((sum, x) => sum + (Number(x.quantity) || 0), 0);
  return Math.max(0, upTo(getInvestmentPurchases(inv)) - upTo(getInvestmentSales(inv)));
}

/** Vendas registradas de uma posição (cada uma guarda o preço médio da época). */
export function getInvestmentSales(inv) {
  return Array.isArray(inv.sales) ? inv.sales : [];
}

const roundQty = (q) => Math.round(q * 1e8) / 1e8;

/**
 * Atualização de uma posição ao registrar uma venda: reduz a quantidade e
 * guarda a venda com o preço médio da época (o preço médio não muda ao vender).
 * Também grava o histórico de compras, para posições antigas não perderem a
 * base de cálculo quando a quantidade diminuir.
 * @param {{quantity:number, price:number, date:string}} sale
 */
export function applyInvestmentSale(inv, { quantity, price, date }) {
  const current = Number(inv.quantity) || 0;
  if (!(quantity > 0) || roundQty(quantity) > roundQty(current)) throw new Error("Quantidade de venda inválida.");
  if (!(price >= 0)) throw new Error("Preço de venda inválido.");
  const avgPrice = Number(inv.avgPrice) || 0;
  return {
    quantity: Math.max(0, roundQty(current - quantity)),
    purchases: getInvestmentPurchases(inv),
    sales: [...getInvestmentSales(inv), { date, quantity, price, avgPrice }],
  };
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

/* =========================================================
   Saúde da Carteira
   Análise educativa baseada nas metas que o próprio usuário define —
   não indica ativos específicos nem substitui um profissional.
   ========================================================= */

export const HEALTH_CATEGORIES = ["Ações", "FIIs", "Renda Fixa", "Tesouro", "Criptomoedas", "Imóveis", "Outros"];

/** Perfis de referência genéricos (pontos de partida editáveis, não recomendação). */
export const ALLOCATION_PRESETS = {
  conservador: {
    label: "Conservador",
    targets: { "Ações": 10, "FIIs": 15, "Renda Fixa": 45, "Tesouro": 25, "Criptomoedas": 0, "Imóveis": 0, "Outros": 5 },
  },
  moderado: {
    label: "Moderado",
    targets: { "Ações": 25, "FIIs": 25, "Renda Fixa": 25, "Tesouro": 15, "Criptomoedas": 5, "Imóveis": 0, "Outros": 5 },
  },
  arrojado: {
    label: "Arrojado",
    targets: { "Ações": 45, "FIIs": 25, "Renda Fixa": 10, "Tesouro": 5, "Criptomoedas": 10, "Imóveis": 0, "Outros": 5 },
  },
};

export const DEFAULT_PORTFOLIO_SETTINGS = {
  preset: "moderado",
  targets: { ...ALLOCATION_PRESETS.moderado.targets },
  maxAssetPct: 15,
  minAssets: 8,
};

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const num1 = (v) => v.toFixed(1).replace(".", ",");

/** Data ISO de N meses antes (mesmo dia), usada para a janela de 12 meses de proventos. */
function isoMonthsBefore(isoDate, months) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1 - months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Diagnóstico da carteira: distribuição por categoria e por ativo, nota de 0 a
 * 100 (com os componentes) e alertas, sempre comparando com as metas do usuário.
 * @param {Array<Object>} investments posições
 * @param {Array<{ticker:string, amount:number, date:string}>} dividends proventos recebidos
 * @param {{targets:Object<string,number>, maxAssetPct:number, minAssets:number}} settings
 * @param {string} today data ISO
 */
export function analyzePortfolioHealth(investments, dividends, settings, today) {
  const { targets, maxAssetPct, minAssets } = { ...DEFAULT_PORTFOLIO_SETTINGS, ...settings };
  const positions = investments
    .map((inv) => ({ ticker: inv.ticker, category: inv.category || "Outros", value: calcInvestmentMetrics(inv).totalValue }))
    .filter((p) => p.value > 0);
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  if (totalValue <= 0) return { empty: true, totalValue: 0, byCategory: [], byAsset: [], alerts: [], components: [], score: null };

  const byAsset = positions.map((p) => ({ ...p, pct: (p.value / totalValue) * 100 })).sort((a, b) => b.value - a.value);

  const categoryNames = [...new Set([...HEALTH_CATEGORIES.filter((c) => (targets[c] || 0) > 0), ...positions.map((p) => p.category)])];
  const byCategory = categoryNames
    .map((category) => {
      const value = positions.filter((p) => p.category === category).reduce((sum, p) => sum + p.value, 0);
      const pct = (value / totalValue) * 100;
      const target = Number(targets[category]) || 0;
      return { category, value, pct, target, diff: pct - target };
    })
    .sort((a, b) => b.pct - a.pct || b.target - a.target);

  // Proventos dos últimos 12 meses por pagador
  const since = isoMonthsBefore(today, 12);
  const incomeByTicker = {};
  const windowDividends = dividends.filter((d) => d.date > since && d.date <= today);
  windowDividends.forEach((d) => (incomeByTicker[d.ticker] = (incomeByTicker[d.ticker] || 0) + (Number(d.amount) || 0)));
  // Meses cobertos pelo histórico (do primeiro provento da janela até hoje), para anualizar o yield.
  const firstIncome = windowDividends.reduce((min, d) => (d.date < min ? d.date : min), today);
  const monthIndex = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  const incomeMonths = clamp(monthIndex(today) - monthIndex(firstIncome) + 1, 1, 12);
  const income12m = Object.values(incomeByTicker).reduce((a, b) => a + b, 0);
  const topPayer = Object.entries(incomeByTicker).sort((a, b) => b[1] - a[1])[0];
  const topPayerShare = topPayer && income12m > 0 ? (topPayer[1] / income12m) * 100 : 0;

  // Componentes da nota
  const overLimitPenalty = byAsset.reduce((sum, a) => sum + Math.max(0, a.pct - maxAssetPct) * 2.5, 0);
  const misallocated = byCategory.reduce((sum, c) => sum + Math.abs(c.diff), 0) / 2;
  const effectiveAssets = 1 / byAsset.reduce((sum, a) => sum + (a.pct / 100) ** 2, 0);
  const components = [
    { key: "allocation", label: "Alinhamento às metas", weight: 35, score: clamp(100 - misallocated * 1.25) },
    { key: "concentration", label: "Concentração por ativo", weight: 30, score: clamp(100 - overLimitPenalty) },
    { key: "diversification", label: "Diversificação", weight: 20, score: clamp((effectiveAssets / Math.max(1, minAssets)) * 100) },
  ];
  if (income12m > 0) {
    components.push({ key: "income", label: "Fontes de renda", weight: 15, score: clamp(100 - Math.max(0, topPayerShare - 35) * 2) });
  }
  const weightSum = components.reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round(components.reduce((sum, c) => sum + c.score * c.weight, 0) / weightSum);

  // Alertas
  const alerts = [];
  byAsset
    .filter((a) => a.pct > maxAssetPct)
    .forEach((a) =>
      alerts.push({
        level: a.pct > maxAssetPct * 2 ? "critical" : "warning",
        title: `${a.ticker} representa ${num1(a.pct)}% da carteira`,
        detail: `Acima do seu limite de ${maxAssetPct}% por ativo — um problema nele pesaria muito no total.`,
      })
    );
  byCategory.forEach((c) => {
    if (c.diff > 10) {
      alerts.push({
        level: c.diff > 25 ? "critical" : "warning",
        title: `Excesso em ${c.category}: ${num1(c.pct)}% (meta ${c.target}%)`,
        detail: `${num1(c.diff)} p.p. acima da meta. Aportar em outras categorias reequilibra sem precisar vender.`,
      });
    } else if (c.diff < -10) {
      alerts.push({
        level: "info",
        title: `Falta ${c.category}: ${num1(c.pct)}% (meta ${c.target}%)`,
        detail: `${num1(Math.abs(c.diff))} p.p. abaixo da meta — boa candidata para os próximos aportes.`,
      });
    }
  });
  if (byAsset.length < minAssets) {
    alerts.push({
      level: "warning",
      title: `Poucos ativos: ${byAsset.length} de ${minAssets}`,
      detail: `Com poucos ativos, cada um pesa mais no resultado. Seu mínimo configurado é ${minAssets}.`,
    });
  }
  if (topPayer && topPayerShare > 50) {
    alerts.push({
      level: "warning",
      title: `${topPayer[0]} gera ${topPayerShare.toFixed(0)}% dos seus proventos`,
      detail: "Sua renda passiva dos últimos 12 meses depende muito de um único pagador.",
    });
  }
  const levelOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return {
    empty: false,
    totalValue,
    byCategory,
    byAsset,
    income12m,
    incomeMonths,
    dividendYield12m: ((income12m * (12 / incomeMonths)) / totalValue) * 100,
    effectiveAssets,
    components,
    score,
    status: score >= 75 ? "healthy" : score >= 50 ? "attention" : "critical",
    alerts,
  };
}

/**
 * Como dividir um aporte entre categorias para aproximar a carteira das metas:
 * prioriza as categorias abaixo da meta (proporcional ao que falta); se nenhuma
 * estiver abaixo, segue a proporção das próprias metas.
 * @returns {Array<{category:string, amount:number}>}
 */
export function suggestContribution(analysis, targets, amount) {
  if (!(amount > 0)) return [];
  const active = Object.entries(targets).filter(([, t]) => Number(t) > 0);
  if (active.length === 0) return [];

  const futureTotal = (analysis.totalValue || 0) + amount;
  const current = (cat) => analysis.byCategory?.find((c) => c.category === cat)?.value || 0;
  const deficits = active.map(([category, t]) => ({ category, weight: Math.max(0, (futureTotal * t) / 100 - current(category)) }));
  const deficitSum = deficits.reduce((sum, d) => sum + d.weight, 0);
  const base = deficitSum > 0 ? deficits : active.map(([category, t]) => ({ category, weight: Number(t) }));
  const baseSum = base.reduce((sum, d) => sum + d.weight, 0);

  const items = base
    .map((d) => ({ category: d.category, amount: Math.floor(((amount * d.weight) / baseSum) * 100) / 100 }))
    .filter((i) => i.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  // Sobra de arredondamento vai para a maior parcela, pra soma bater exatamente com o aporte.
  const remainder = Math.round((amount - items.reduce((sum, i) => sum + i.amount, 0)) * 100) / 100;
  if (items.length > 0) items[0].amount = Math.round((items[0].amount + remainder) * 100) / 100;
  return items;
}

/**
 * Projeção mês a mês do patrimônio com aportes mensais, valorização anual e
 * dividend yield anual (reinvestido ou não).
 * @returns {{points:Array<{month:number, balance:number, contributed:number}>, finalBalance:number, totalContributed:number, monthlyIncome:number, incomeReceived:number}}
 */
export function projectPortfolio({ initial, monthlyContribution, annualAppreciation, annualYield, reinvest, years }) {
  const appreciation = Math.pow(1 + (Number(annualAppreciation) || 0) / 100, 1 / 12) - 1;
  const monthlyYield = (Number(annualYield) || 0) / 100 / 12;
  const contribution = Math.max(0, Number(monthlyContribution) || 0);

  let balance = Math.max(0, Number(initial) || 0);
  let contributed = balance;
  let incomeReceived = 0;
  const points = [{ month: 0, balance, contributed }];

  for (let month = 1; month <= years * 12; month++) {
    const income = balance * monthlyYield;
    incomeReceived += income;
    balance = balance * (1 + appreciation) + contribution + (reinvest ? income : 0);
    contributed += contribution;
    points.push({ month, balance, contributed });
  }

  return { points, finalBalance: balance, totalContributed: contributed, monthlyIncome: balance * monthlyYield, incomeReceived };
}

/* =========================================================
   Histórico de movimentações (compras, vendas e proventos)
   ========================================================= */

const HISTORY_KIND_ORDER = { dividend: 0, sell: 1, buy: 2 };

/**
 * Linha do tempo de movimentações, da mais recente para a mais antiga.
 * Compras de posições sem histórico detalhado (anteriores ao campo `purchases`)
 * aparecem como uma compra única marcada como aproximada.
 * @returns {Array<{id:string, kind:"buy"|"sell"|"dividend", date:string, ticker:string, category:string, quantity:number|null, price:number|null, amount:number, result?:number, avgPrice?:number, dividendType?:string, approximate?:boolean}>}
 */
export function buildInvestmentHistory(investments, dividends) {
  const events = [];
  const categoryOf = {};

  investments.forEach((inv) => {
    categoryOf[inv.ticker] = inv.category;
    const approximate = !(Array.isArray(inv.purchases) && inv.purchases.length > 0);
    getInvestmentPurchases(inv).forEach((p, i) => {
      const quantity = Number(p.quantity) || 0;
      const price = Number(p.price) || 0;
      events.push({ id: `buy-${inv.id}-${i}`, kind: "buy", date: p.date, ticker: inv.ticker, category: inv.category, quantity, price, amount: quantity * price, approximate });
    });
    getInvestmentSales(inv).forEach((s, i) => {
      const quantity = Number(s.quantity) || 0;
      const price = Number(s.price) || 0;
      const avgPrice = Number(s.avgPrice) || 0;
      events.push({
        id: `sell-${inv.id}-${i}`,
        kind: "sell",
        date: s.date,
        ticker: inv.ticker,
        category: inv.category,
        quantity,
        price,
        avgPrice,
        amount: quantity * price,
        result: (price - avgPrice) * quantity,
      });
    });
  });

  dividends.forEach((d) => {
    events.push({
      id: `dividend-${d.id}`,
      kind: "dividend",
      date: d.date,
      ticker: d.ticker,
      category: categoryOf[d.ticker] || "",
      quantity: d.shares ?? null,
      price: d.rate ?? null,
      amount: Number(d.amount) || 0,
      dividendType: d.type,
    });
  });

  return events.sort(
    (a, b) => String(b.date).localeCompare(String(a.date)) || HISTORY_KIND_ORDER[a.kind] - HISTORY_KIND_ORDER[b.kind] || a.ticker.localeCompare(b.ticker)
  );
}

/** Totais de um conjunto de movimentações (compras, vendas, proventos e resultado das vendas). */
export function summarizeHistory(events) {
  return events.reduce(
    (acc, e) => {
      if (e.kind === "buy") acc.bought += e.amount;
      else if (e.kind === "sell") {
        acc.sold += e.amount;
        acc.realized += e.result || 0;
      } else acc.dividends += e.amount;
      return acc;
    },
    { bought: 0, sold: 0, dividends: 0, realized: 0 }
  );
}

/* =========================================================
   Carteira x Mercado (CDI, IBOV, IFIX)
   Compara a carteira com o que os MESMOS aportes e vendas, nas mesmas
   datas, teriam virado se tivessem ido para cada índice.
   ========================================================= */

const pad2 = (n) => String(n).padStart(2, "0");
const parseBrNumber = (v) => Number(String(v).replace(/\./g, "").replace(",", "."));

/**
 * Converte a matriz dia × mês da B3 (GetPortfolioDay: { day, rateValue1..12 }, valores
 * "160.538,69") em pontos [data ISO, valor], em ordem cronológica.
 */
export function parseB3IndexYear(results, year) {
  const points = [];
  (Array.isArray(results) ? results : []).forEach((row) => {
    for (let month = 1; month <= 12; month++) {
      const raw = row[`rateValue${month}`];
      if (raw == null || raw === "") continue;
      const value = parseBrNumber(raw);
      if (Number.isFinite(value) && value > 0) points.push([`${year}-${pad2(month)}-${pad2(row.day)}`, value]);
    }
  });
  return points.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Índice acumulado do CDI a partir das taxas diárias (% ao dia): [[data, índice]], começando em 1. */
export function buildCdiIndex(rows) {
  let index = 1;
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      index *= 1 + (Number(r.rate) || 0) / 100;
      return [r.date, index];
    });
}

/** Valor da série na data (último ponto até a data; antes do início, o primeiro ponto). */
function valueAt(series, date) {
  let lo = 0;
  let hi = series.length - 1;
  if (date < series[0][0]) return series[0][1];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (series[mid][0] <= date) lo = mid;
    else hi = mid - 1;
  }
  return series[lo][1];
}

/** Fluxos de caixa da carteira: compras entram (+), vendas saem (−), em ordem de data. */
export function investmentCashFlows(investments) {
  const flows = [];
  investments.forEach((inv) => {
    getInvestmentPurchases(inv).forEach((p) => flows.push({ date: String(p.date).slice(0, 10), amount: (Number(p.quantity) || 0) * (Number(p.price) || 0) }));
    getInvestmentSales(inv).forEach((s) => flows.push({ date: String(s.date).slice(0, 10), amount: -(Number(s.quantity) || 0) * (Number(s.price) || 0) }));
  });
  return flows.filter((f) => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
}

/** Valor, em cada data, dos mesmos fluxos aplicados na série do índice. */
export function simulateBenchmark(flows, series, dates) {
  if (!Array.isArray(series) || series.length === 0) return null;
  return dates.map((date) => {
    const valueOnDate = valueAt(series, date);
    return flows.filter((f) => f.date <= date).reduce((sum, f) => sum + (f.amount * valueOnDate) / valueAt(series, f.date), 0);
  });
}

/**
 * Comparação completa para a tela: carteira (valor atual + proventos recebidos) contra
 * CDI, IBOV e IFIX com os mesmos aportes e vendas.
 * @param {{cdi:Array<{date:string, rate:number}>, ibov:Array<[string, number]>, ifix:Array<[string, number]>}} indices
 */
export function buildMarketComparison(investments, dividends, indices, today) {
  const flows = investmentCashFlows(investments).filter((f) => f.date <= today);
  if (flows.length === 0) return { empty: true };

  const firstDate = flows[0].date;
  const tickers = new Set(investments.map((inv) => inv.ticker));
  const netInvested = flows.reduce((sum, f) => sum + f.amount, 0);
  const portfolioValue = investments.reduce((sum, inv) => sum + calcInvestmentMetrics(inv).totalValue, 0);
  const dividendsReceived = dividends
    .filter((d) => tickers.has(d.ticker) && d.date >= firstDate && d.date <= today)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const portfolioTotal = portfolioValue + dividendsReceived;
  const pctOf = (value) => (netInvested > 0 ? ((value - netInvested) / netInvested) * 100 : null);

  // Um ponto por fim de mês, do primeiro aporte até hoje.
  const dates = [];
  const [fy, fm] = firstDate.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  for (let y = fy, m = fm; y < ty || (y === ty && m < tm); m === 12 ? (y++, (m = 1)) : m++) {
    dates.push(`${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`);
  }
  dates.push(today);

  const series = { cdi: buildCdiIndex(indices?.cdi || []), ibov: indices?.ibov || [], ifix: indices?.ifix || [] };
  const benchmarks = {};
  for (const [key, s] of Object.entries(series)) {
    const values = simulateBenchmark(flows, s, dates);
    benchmarks[key] = values ? { values, final: values[values.length - 1], pct: pctOf(values[values.length - 1]) } : null;
  }

  return {
    empty: false,
    firstDate,
    dates,
    invested: dates.map((d) => flows.filter((f) => f.date <= d).reduce((sum, f) => sum + f.amount, 0)),
    netInvested,
    portfolioValue,
    dividendsReceived,
    portfolioTotal,
    portfolioPct: pctOf(portfolioTotal),
    benchmarks,
  };
}

/* =========================================================
   Calendário de proventos
   ========================================================= */

/**
 * Grade de um mês (semanas de domingo a sábado) com os proventos de cada dia.
 * @param {string} yyyyMm mês, ex: "2026-10"
 * @param {Array<{paymentDate:string, total:number, status:"received"|"upcoming"}>} events
 * @returns {{ weeks: Array<Array<null|{date:string, day:number, received:number, upcoming:number, count:number}>>, received:number, upcoming:number }}
 */
export function buildDividendCalendar(yyyyMm, events) {
  const [year, month] = yyyyMm.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const byDate = {};
  let received = 0;
  let upcoming = 0;
  events
    .filter((e) => String(e.paymentDate).startsWith(yyyyMm))
    .forEach((e) => {
      const cell = (byDate[e.paymentDate] ||= { received: 0, upcoming: 0, count: 0 });
      const amount = Number(e.total) || 0;
      cell[e.status === "upcoming" ? "upcoming" : "received"] += amount;
      cell.count += 1;
      if (e.status === "upcoming") upcoming += amount;
      else received += amount;
    });

  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${yyyyMm}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, received: 0, upcoming: 0, count: 0, ...byDate[date] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { weeks, received, upcoming };
}

/** Mês anterior/seguinte no formato "AAAA-MM". */
/**
 * Confere a senha de um NOVO cadastro: mínimo de 8 caracteres, com letras e números.
 * Devolve a mensagem do problema, ou null se a senha serve. (O login não usa isto,
 * para não trancar quem criou a conta com a regra antiga.)
 */
export function passwordProblem(password) {
  const p = String(password ?? "");
  if (p.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (p.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(p)) return "Escolha uma senha menos óbvia.";
  return null;
}

export function shiftMonth(yyyyMm, delta) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* =========================================================
   Independência financeira
   ========================================================= */

/**
 * Quando a renda de proventos alcança a meta mensal, seguindo a mesma simulação da
 * projeção (aportes mensais, valorização e dividend yield, com proventos reinvestidos).
 * @returns {{ requiredWealth:number|null, months:number|null, reachedAlready:boolean }}
 *   requiredWealth: patrimônio que, com o yield informado, paga a meta;
 *   months: meses até chegar lá (null se não chega em `maxYears`).
 */
export function financialIndependencePlan({ initial, monthlyContribution, annualAppreciation, annualYield, targetMonthlyIncome, maxYears = 60 }) {
  const target = Number(targetMonthlyIncome) || 0;
  const yieldPct = Number(annualYield) || 0;
  if (target <= 0 || yieldPct <= 0) return { requiredWealth: null, months: null, reachedAlready: false };

  const requiredWealth = (target * 12) / (yieldPct / 100);
  if ((Number(initial) || 0) >= requiredWealth) return { requiredWealth, months: 0, reachedAlready: true };

  const { points } = projectPortfolio({ initial, monthlyContribution, annualAppreciation, annualYield: yieldPct, reinvest: true, years: maxYears });
  const hit = points.find((p) => p.balance >= requiredWealth);
  return { requiredWealth, months: hit ? hit.month : null, reachedAlready: false };
}

/* =========================================================
   Central de alertas
   ========================================================= */

const brl = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE");
};
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
const listTickers = (items) => {
  const tickers = [...new Set(items.map((i) => i.ticker))];
  return tickers.slice(0, 3).join(", ") + (tickers.length > 3 ? ` e mais ${tickers.length - 3}` : "");
};

/**
 * Alertas a partir dos dados do app. Cada alerta tem um `id` estável, para o app saber
 * quais o usuário já viu (o id muda quando a situação muda — ex: mês, valor, quantidade).
 * @returns {Array<{id:string, level:"critical"|"warning"|"success"|"info", icon:string, title:string, detail:string, view:string}>}
 */
export function buildAlerts({ today, dividends = [], upcoming = [], budgets = [], transactions = [], investments = [], health = null, goals = [], joinRequests = 0, bills = [], invoices = [] }) {
  const alerts = [];
  const month = today.slice(0, 7);

  // Proventos que caíram hoje
  const paidToday = dividends.filter((d) => d.date === today);
  if (paidToday.length > 0) {
    const total = paidToday.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    alerts.push({ id: `div-today-${today}-${paidToday.length}`, level: "success", icon: "ph-coins", title: `Caíram ${brl(total)} em proventos hoje`, detail: listTickers(paidToday), view: "investments" });
  }

  // Proventos dos próximos 7 dias
  const nextWeek = upcoming.filter((u) => u.paymentDate > today && u.paymentDate <= addDays(today, 7));
  if (nextWeek.length > 0) {
    const total = nextWeek.reduce((sum, u) => sum + (Number(u.total) || 0), 0);
    const detail = nextWeek
      .slice()
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
      .slice(0, 3)
      .map((u) => `${u.ticker} ${shortDate(u.paymentDate)}`)
      .join(", ");
    alerts.push({ id: `div-week-${today}-${nextWeek.length}`, level: "info", icon: "ph-calendar-check", title: `${brl(total)} em proventos nos próximos 7 dias`, detail, view: "investments" });
  }

  // Orçamentos do mês
  budgets.forEach((b) => {
    const limit = Number(b.monthlyLimit) || 0;
    if (limit <= 0) return;
    const spent = calcBudgetSpent(b.category, transactions, new Date(`${today}T00:00:00`));
    const pct = (spent / limit) * 100;
    if (pct >= 100) {
      alerts.push({ id: `budget-${b.category}-${month}-over`, level: "critical", icon: "ph-warning-octagon", title: `Orçamento de ${b.category} estourado`, detail: `${brl(spent)} gastos de ${brl(limit)} no mês.`, view: "budget" });
    } else if (pct >= 90) {
      alerts.push({ id: `budget-${b.category}-${month}-near`, level: "warning", icon: "ph-warning", title: `${b.category} já usou ${Math.floor(pct)}% do orçamento`, detail: `Restam ${brl(limit - spent)} para o mês.`, view: "budget" });
    }
  });

  // Saúde da carteira: só os pontos críticos (o resto fica na aba)
  (health?.alerts || [])
    .filter((a) => a.level === "critical")
    .forEach((a) => alerts.push({ id: `health-${a.title.replace(/[\d.,]+/g, "#")}`, level: "warning", icon: "ph-heartbeat", title: a.title, detail: a.detail, view: "health" }));

  // Cotações que não atualizaram
  const staleQuotes = investments.filter((inv) => inv.lastQuoteError && (Number(inv.quantity) || 0) > 0);
  if (staleQuotes.length > 0) {
    alerts.push({
      id: `quotes-${today}-${staleQuotes.length}`,
      level: "warning",
      icon: "ph-plugs",
      title: `Cotação desatualizada em ${staleQuotes.length} ativo${staleQuotes.length === 1 ? "" : "s"}`,
      detail: `${listTickers(staleQuotes)}: mostrando o último preço salvo.`,
      view: "investments",
    });
  }

  // Metas com prazo perto ou vencido
  goals.forEach((g) => {
    if (!g.deadline) return;
    const target = Number(g.targetAmount) || 0;
    const progress = target > 0 ? Math.min(100, ((Number(g.currentAmount) || 0) / target) * 100) : 0;
    if (progress >= 100) return;
    const days = daysBetween(today, g.deadline);
    if (days < 0) {
      alerts.push({ id: `goal-${g.id}-overdue`, level: "warning", icon: "ph-target", title: `Prazo da meta "${g.name}" passou`, detail: `${Math.round(progress)}% concluída. Revise o prazo ou o valor.`, view: "goals" });
    } else if (days <= 30) {
      alerts.push({ id: `goal-${g.id}-soon-${g.deadline}`, level: "info", icon: "ph-target", title: `Meta "${g.name}" vence em ${days} dia${days === 1 ? "" : "s"}`, detail: `${Math.round(progress)}% concluída.`, view: "goals" });
    }
  });

  // Contas a pagar: vencidas e vencendo em até 3 dias
  const dueLabel = (date) => {
    const days = daysBetween(today, date);
    return days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
  };
  bills
    .filter((b) => !b.paid && b.dueDate)
    .forEach((b) => {
      const days = daysBetween(today, b.dueDate);
      if (days < 0) {
        alerts.push({ id: `bill-${b.id}-${b.dueDate}-overdue`, level: "critical", icon: "ph-receipt", title: `Conta vencida: ${b.description}`, detail: `${brl(b.amount)} venceu em ${shortDate(b.dueDate)}.`, view: "bills" });
      } else if (days <= 3) {
        alerts.push({ id: `bill-${b.id}-${b.dueDate}-soon`, level: "warning", icon: "ph-receipt", title: `${b.description} vence ${dueLabel(b.dueDate)}`, detail: `${brl(b.amount)} · vencimento ${shortDate(b.dueDate)}.`, view: "bills" });
      }
    });

  // Faturas de cartão: vencidas e vencendo em até 5 dias (só as já fechadas ou com valor)
  invoices.forEach((i) => {
    const days = daysBetween(today, i.dueDate);
    if (days < 0) {
      alerts.push({ id: `invoice-${i.cardId}-${i.month}-overdue`, level: "critical", icon: "ph-credit-card", title: `Fatura ${i.cardName} vencida`, detail: `${brl(i.total)} venceu em ${shortDate(i.dueDate)}.`, view: "bills" });
    } else if (days <= 5) {
      alerts.push({ id: `invoice-${i.cardId}-${i.month}-soon`, level: "warning", icon: "ph-credit-card", title: `Fatura ${i.cardName} vence ${dueLabel(i.dueDate)}`, detail: `${brl(i.total)} · vencimento ${shortDate(i.dueDate)}.`, view: "bills" });
    }
  });

  // Pedidos de entrada no espaço de casal
  if (joinRequests > 0) {
    alerts.push({
      id: `join-${joinRequests}`,
      level: "warning",
      icon: "ph-user-plus",
      title: `${joinRequests} pedido${joinRequests === 1 ? "" : "s"} para entrar no seu espaço de casal`,
      detail: "Aprove ou recuse em Configurações.",
      view: "settings",
    });
  }

  const order = { critical: 0, warning: 1, success: 2, info: 3 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/* =========================================================
   Contas a pagar e cartão de crédito
   ========================================================= */

const toCents = (v) => Math.round((Number(v) || 0) * 100);

/** Dia `day` do mês "YYYY-MM", limitado ao último dia do mês (31 em fevereiro vira 28/29). */
export function dateInMonth(yyyyMm, day) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${yyyyMm}-${pad2(Math.min(Math.max(1, Number(day) || 1), last))}`;
}

/** Mesma data `delta` meses depois, preservando o dia original quando o mês permite. */
export function addMonthsToDate(iso, delta, preferredDay = Number(iso.slice(8, 10))) {
  return dateInMonth(shiftMonth(iso.slice(0, 7), delta), preferredDay);
}

/**
 * Divide um valor em N parcelas em centavos exatos; a diferença de arredondamento fica na 1ª.
 * Ex: 100 em 3 -> [33.34, 33.33, 33.33]
 */
export function splitInstallments(total, count) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  const cents = toCents(total);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? cents - base * (n - 1) : base) / 100);
}

/**
 * Fatura (mês de referência "YYYY-MM") em que cai uma compra: compras a partir do dia do
 * fechamento entram na fatura do mês seguinte.
 */
export function invoiceMonthOf(purchaseDate, closingDay) {
  const month = purchaseDate.slice(0, 7);
  const closing = dateInMonth(month, closingDay);
  return purchaseDate >= closing ? shiftMonth(month, 1) : month;
}

/** Datas de fechamento e vencimento da fatura do mês (vencimento antes do fechamento = mês seguinte). */
export function invoiceDates(month, closingDay, dueDay) {
  const closingDate = dateInMonth(month, closingDay);
  const dueMonth = Number(dueDay) > Number(closingDay) ? month : shiftMonth(month, 1);
  return { closingDate, dueDate: dateInMonth(dueMonth, dueDay) };
}

/**
 * Todas as faturas de um cartão, a partir das compras (cada parcela cai numa fatura).
 * @param {{id:string, closingDay:number, dueDay:number}} card
 * @param {Array<{id:string, cardId:string, description:string, category:string, amount:number, installments:number, purchaseDate:string}>} purchases
 * @param {Array<{cardId:string, month:string, paid:boolean, paidAt?:string}>} paidInvoices
 * @returns {Object<string, {month:string, items:Array, total:number, closingDate:string, dueDate:string, paid:boolean, paidAt:string|null}>}
 */
export function buildCardInvoices(card, purchases, paidInvoices = []) {
  const invoices = {};
  const ensure = (month) => {
    if (!invoices[month]) {
      const paidDoc = paidInvoices.find((p) => p.cardId === card.id && p.month === month && p.paid);
      invoices[month] = {
        month,
        items: [],
        total: 0,
        ...invoiceDates(month, card.closingDay, card.dueDay),
        paid: !!paidDoc,
        paidAt: paidDoc?.paidAt || null,
        transactionIds: paidDoc?.transactionIds || [],
      };
    }
    return invoices[month];
  };

  purchases
    .filter((p) => p.cardId === card.id && p.purchaseDate)
    .forEach((p) => {
      const n = Math.max(1, Math.floor(Number(p.installments) || 1));
      const parts = splitInstallments(p.amount, n);
      const firstMonth = invoiceMonthOf(p.purchaseDate, card.closingDay);
      parts.forEach((value, i) => {
        const inv = ensure(shiftMonth(firstMonth, i));
        inv.items.push({ purchaseId: p.id, description: p.description, category: p.category, amount: value, installment: i + 1, installments: n, purchaseDate: p.purchaseDate });
      });
    });

  Object.values(invoices).forEach((inv) => {
    inv.total = toCents(inv.items.reduce((s, it) => s + it.amount, 0)) / 100;
    inv.items.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || String(a.description).localeCompare(String(b.description)));
  });
  return invoices;
}

/** Fatura de um mês (vazia se não houver compras nela). */
export function invoiceForMonth(card, purchases, paidInvoices, month) {
  const invoices = buildCardInvoices(card, purchases, paidInvoices);
  if (invoices[month]) return invoices[month];
  const paidDoc = paidInvoices.find((p) => p.cardId === card.id && p.month === month && p.paid);
  return { month, items: [], total: 0, ...invoiceDates(month, card.closingDay, card.dueDay), paid: !!paidDoc, paidAt: paidDoc?.paidAt || null, transactionIds: paidDoc?.transactionIds || [] };
}

/** Situação de uma fatura: paga, aberta (ainda recebe compras), fechada (aguardando pagamento) ou vencida. */
export function invoiceStatus(invoice, today) {
  if (invoice.paid) return "paid";
  if (today < invoice.closingDate) return "open";
  if (today > invoice.dueDate) return "overdue";
  return "closed";
}

/**
 * Resumo do cartão para a tela: fatura atual (a que recebe compras hoje), a próxima a pagar,
 * limite usado (parcelas em faturas não pagas) e disponível.
 */
export function cardSummary(card, purchases, paidInvoices, today) {
  const invoices = buildCardInvoices(card, purchases, paidInvoices);
  const month = invoiceMonthOf(today, card.closingDay);
  const current = invoiceForMonth(card, purchases, paidInvoices, month);
  const unpaid = Object.values(invoices).filter((i) => !i.paid);
  const used = toCents(unpaid.reduce((s, i) => s + i.total, 0)) / 100;
  const limit = Number(card.limit) || 0;
  // Fatura já fechada e ainda não paga (a que precisa ser paga agora).
  const toPay = unpaid.filter((i) => i.total > 0 && today >= i.closingDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;
  return { invoices, current, toPay, used, limit, available: limit > 0 ? Math.max(0, toCents(limit - used) / 100) : null };
}

/** Faturas não pagas de todos os cartões, com vencimento (para alertas, saldo projetado e lembretes). */
export function unpaidInvoices(cards, purchases, paidInvoices) {
  return cards
    .flatMap((card) =>
      Object.values(buildCardInvoices(card, purchases, paidInvoices))
        .filter((i) => !i.paid && i.total > 0)
        .map((i) => ({ cardId: card.id, cardName: card.name, month: i.month, closingDate: i.closingDate, dueDate: i.dueDate, total: i.total }))
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Situação de uma conta a pagar. */
export function billStatus(bill, today) {
  if (bill.paid) return "paid";
  if (bill.dueDate < today) return "overdue";
  if (daysBetween(today, bill.dueDate) <= 3) return "soon";
  return "pending";
}

/** Totais de contas do mês: a pagar no mês, vencidas (qualquer mês) e pagas no mês. */
export function billsSummary(bills, today) {
  const month = today.slice(0, 7);
  let toPay = 0, overdue = 0, paid = 0, overdueCount = 0;
  bills.forEach((b) => {
    const amount = Number(b.amount) || 0;
    if (b.paid) {
      if (String(b.paidAt || b.dueDate).slice(0, 7) === month) paid += amount;
    } else if (b.dueDate < today) {
      overdue += amount;
      overdueCount++;
    } else if (b.dueDate.slice(0, 7) === month) {
      toPay += amount;
    }
  });
  const round = (v) => toCents(v) / 100;
  return { toPay: round(toPay), overdue: round(overdue), overdueCount, paid: round(paid) };
}

/** Transações de despesa geradas ao pagar uma fatura (uma por parcela, com a categoria da compra). */
export function invoicePaymentTransactions(card, invoice, payDate) {
  return invoice.items.map((it) => ({
    description: `${it.description}${it.installments > 1 ? ` (${it.installment}/${it.installments})` : ""} · ${card.name}`.slice(0, 200),
    amount: it.amount,
    type: "expense",
    category: it.category || "Outros",
    date: payDate,
  }));
}

/* =========================================================
   Saldo projetado do mês e reserva de emergência
   ========================================================= */

/**
 * Quanto deve sobrar no fim do mês: o que já entrou/saiu até hoje + o que ainda vai entrar/sair
 * (transações com data futura, recorrências ainda não lançadas, contas e faturas a vencer no mês —
 * as vencidas e não pagas também entram, porque ainda vão sair).
 */
export function projectMonthBalance({ today, transactions = [], recurrences = [], bills = [], invoices = [] }) {
  const month = today.slice(0, 7);
  let realized = 0, incoming = 0, outgoing = 0;
  const upcoming = [];

  transactions
    .filter((t) => String(t.date).slice(0, 7) === month)
    .forEach((t) => {
      const amount = Number(t.amount) || 0;
      const signed = t.type === "income" ? amount : -amount;
      if (t.date <= today) {
        realized += signed;
        return;
      }
      if (signed > 0) incoming += amount;
      else outgoing += amount;
      upcoming.push({ date: t.date, description: t.description, amount: signed, kind: "transaction" });
    });

  recurrences
    .filter((r) => r.lastGeneratedMonth !== month)
    .forEach((r) => {
      const amount = Number(r.amount) || 0;
      if (r.type === "income") incoming += amount;
      else outgoing += amount;
      upcoming.push({ date: dateInMonth(month, r.dayOfMonth), description: r.description, amount: r.type === "income" ? amount : -amount, kind: "recurrence" });
    });

  bills
    .filter((b) => !b.paid && b.dueDate.slice(0, 7) <= month)
    .forEach((b) => {
      const amount = Number(b.amount) || 0;
      outgoing += amount;
      upcoming.push({ date: b.dueDate, description: b.description, amount: -amount, kind: "bill" });
    });

  invoices
    .filter((i) => i.dueDate.slice(0, 7) <= month)
    .forEach((i) => {
      outgoing += i.total;
      upcoming.push({ date: i.dueDate, description: `Fatura ${i.cardName}`, amount: -i.total, kind: "invoice" });
    });

  const round = (v) => toCents(v) / 100;
  return {
    realized: round(realized),
    incoming: round(incoming),
    outgoing: round(outgoing),
    projected: round(realized + incoming - outgoing),
    upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Média de despesas dos últimos `months` meses completos que tiveram movimento (null sem histórico). */
export function averageMonthlyExpenses(transactions, today, months = 3) {
  const current = today.slice(0, 7);
  const byMonth = {};
  for (let i = 1; i <= months; i++) byMonth[shiftMonth(current, -i)] = { expense: 0, any: false };
  transactions.forEach((t) => {
    const m = byMonth[String(t.date).slice(0, 7)];
    if (!m) return;
    m.any = true;
    if (t.type === "expense") m.expense += Number(t.amount) || 0;
  });
  const active = Object.values(byMonth).filter((m) => m.any);
  if (active.length === 0) return null;
  return toCents(active.reduce((s, m) => s + m.expense, 0) / active.length) / 100;
}

/**
 * Reserva de emergência: quantos meses de despesas o valor guardado cobre e quanto falta para a meta.
 * @param {{ amount:number, monthlyExpenses:number|null, targetMonths?:number }} params
 */
export function emergencyReserve({ amount, monthlyExpenses, targetMonths = 6 }) {
  const value = Number(amount) || 0;
  const target = Math.max(1, Number(targetMonths) || 6);
  if (!monthlyExpenses || monthlyExpenses <= 0) {
    return { amount: value, months: null, targetMonths: target, targetAmount: null, missing: null, progress: null };
  }
  const targetAmount = monthlyExpenses * target;
  return {
    amount: value,
    months: value / monthlyExpenses,
    targetMonths: target,
    targetAmount,
    missing: Math.max(0, targetAmount - value),
    progress: Math.min(100, (value / targetAmount) * 100),
  };
}

/**
 * Valor da reserva a partir das fontes escolhidas: metas ("goal:ID"), investimentos ("inv:ID")
 * e um valor extra digitado.
 */
export function reserveAmount(sources = [], goals = [], investments = [], extra = 0) {
  let total = Number(extra) || 0;
  sources.forEach((src) => {
    const [kind, id] = String(src).split(":");
    if (kind === "goal") total += Number(goals.find((g) => g.id === id)?.currentAmount) || 0;
    if (kind === "inv") {
      const inv = investments.find((i) => i.id === id);
      if (inv) total += calcInvestmentMetrics(inv).totalValue;
    }
  });
  return toCents(total) / 100;
}

/* =========================================================
   Exportação CSV
   ========================================================= */

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvNumber = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");

/**
 * CSV no padrão do Excel em português (separador ";", vírgula decimal, BOM para os acentos).
 * Despesas saem com valor negativo.
 */
export function transactionsToCsv(transactions) {
  const header = ["Data", "Descrição", "Categoria", "Tipo", "Valor"];
  const rows = transactions
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((t) => [
      t.date ? `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}/${t.date.slice(0, 4)}` : "",
      t.description,
      t.category,
      t.type === "income" ? "Receita" : "Despesa",
      csvNumber(t.type === "income" ? t.amount : -(Number(t.amount) || 0)),
    ]);
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

/* =========================================================
   Lembretes por notificação (servidor, uma vez por dia)
   ========================================================= */

/**
 * Lembretes do dia: contas e faturas que vencem hoje ou amanhã (ou venceram ontem) e
 * proventos que caem amanhã.
 * @returns {Array<{tag:string, title:string, body:string, view:string}>}
 */
export function buildPushReminders({ today, bills = [], invoices = [], upcomingDividends = [] }) {
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const window = [yesterday, today, tomorrow];
  const when = (date) => (date === today ? "hoje" : "amanhã");
  const reminders = [];

  bills
    .filter((b) => !b.paid && window.includes(b.dueDate))
    .forEach((b) =>
      reminders.push({
        tag: `bill-${b.id}-${b.dueDate}`,
        title: b.dueDate === yesterday ? `Conta vencida: ${b.description}` : `${b.description} vence ${when(b.dueDate)}`,
        body: `${brl(b.amount)} · vencimento ${shortDate(b.dueDate)}`,
        view: "bills",
      })
    );

  invoices
    .filter((i) => window.includes(i.dueDate))
    .forEach((i) =>
      reminders.push({
        tag: `invoice-${i.cardId}-${i.month}`,
        title: i.dueDate === yesterday ? `Fatura ${i.cardName} venceu ontem` : `Fatura ${i.cardName} vence ${when(i.dueDate)}`,
        body: `${brl(i.total)} · vencimento ${shortDate(i.dueDate)}`,
        view: "bills",
      })
    );

  const divTomorrow = upcomingDividends.filter((d) => d.paymentDate === tomorrow);
  if (divTomorrow.length > 0) {
    const total = divTomorrow.reduce((s, d) => s + (Number(d.total) || 0), 0);
    reminders.push({ tag: `div-${tomorrow}`, title: `${brl(total)} em proventos amanhã`, body: listTickers(divTomorrow), view: "investments" });
  }
  return reminders;
}
