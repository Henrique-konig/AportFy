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
