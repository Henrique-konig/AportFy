import { describe, it, expect } from "vitest";
import {
  calcInvestmentMetrics,
  estimateSalesTax,
  netWorthSeries,
  parseB3Trades,
  planB3Import,
  historyToCsv,
  mergeInvestmentPurchase,
  pctChange,
  buildMonthlySeries,
  calcBudgetSpent,
  recurrenceDateForMonth,
  dividendDedupeKey,
  getInvestmentPurchases,
  buildMonthlyContributions,
  sharesOnDate,
  parseB3CashDividends,
  buildUpcomingDividends,
  filterByAssetClass,
  dividendNetAmount,
  analyzePortfolioHealth,
  suggestContribution,
  projectPortfolio,
  applyInvestmentSale,
  buildInvestmentHistory,
  summarizeHistory,
  parseB3IndexYear,
  buildCdiIndex,
  simulateBenchmark,
  buildMarketComparison,
  buildDividendCalendar,
  shiftMonth,
  financialIndependencePlan,
  buildAlerts,
  passwordProblem,
  filterFiiQuotas,
  pickMovers,
  parseTesouro,
  parseBcbLast,
  indexStats,
  fixedIncomeRanking,
  dateInMonth,
  addMonthsToDate,
  splitInstallments,
  invoiceMonthOf,
  invoiceDates,
  buildCardInvoices,
  invoiceForMonth,
  invoiceStatus,
  cardSummary,
  unpaidInvoices,
  billStatus,
  billsSummary,
  invoicePaymentTransactions,
  projectMonthBalance,
  averageMonthlyExpenses,
  emergencyReserve,
  reserveAmount,
  transactionsToCsv,
  buildPushReminders,
  splitBalance,
  unrecordedQuantity,
  registerPurchase,
  FUNDAMENTUS_FII_COLUMNS,
  brNumber,
  parseFundamentusTable,
  applyScreen,
  dividendSummary,
  priceStats,
  portfolioIndicators,
  etfClass,
  etfLabel,
  etfStats,
  pickEtfs,
  alertLabel,
  evaluateAlerts,
  compareSeries,
  bestIndexes,
  editedInvestmentPurchases,
} from "../js/calc.js";

describe("applyInvestmentSale", () => {
  it("reduz a quantidade, mantém o preço médio e grava a venda", () => {
    const inv = { quantity: 10, avgPrice: 20, purchaseDate: "2026-01-10" };
    const u = applyInvestmentSale(inv, { quantity: 4, price: 25, date: "2026-05-01" });
    expect(u.quantity).toBe(6);
    expect(u.sales).toEqual([{ date: "2026-05-01", quantity: 4, price: 25, avgPrice: 20 }]);
    // posição antiga sem histórico: as compras são gravadas com a quantidade de antes da venda
    expect(u.purchases).toEqual([{ date: "2026-01-10", quantity: 10, price: 20 }]);
  });

  it("recusa vender mais do que tem", () => {
    expect(() => applyInvestmentSale({ quantity: 3, avgPrice: 1 }, { quantity: 4, price: 1, date: "2026-01-01" })).toThrow();
    expect(() => applyInvestmentSale({ quantity: 3, avgPrice: 1 }, { quantity: 0, price: 1, date: "2026-01-01" })).toThrow();
  });

  it("cotas na data descontam as vendas", () => {
    const inv = { purchases: [{ date: "2026-01-10", quantity: 10, price: 20 }], sales: [{ date: "2026-05-01", quantity: 4, price: 25, avgPrice: 20 }] };
    expect(sharesOnDate(inv, "2026-04-30")).toBe(10);
    expect(sharesOnDate(inv, "2026-05-01")).toBe(6);
  });
});

describe("buildInvestmentHistory", () => {
  const investments = [
    { id: "a", ticker: "MXRF11", category: "FIIs", purchases: [{ date: "2026-01-10", quantity: 10, price: 10 }], sales: [{ date: "2026-06-01", quantity: 5, price: 12, avgPrice: 10 }] },
    { id: "b", ticker: "PETR4", category: "Ações", quantity: 2, avgPrice: 30, purchaseDate: "2026-03-01" },
  ];
  const dividends = [{ id: "d1", ticker: "MXRF11", type: "Rendimento", amount: 1, date: "2026-02-15", rate: 0.1, shares: 10 }];

  it("junta compras, vendas e proventos em ordem do mais recente", () => {
    const h = buildInvestmentHistory(investments, dividends);
    expect(h.map((e) => `${e.kind}:${e.ticker}:${e.date}`)).toEqual([
      "sell:MXRF11:2026-06-01",
      "buy:PETR4:2026-03-01",
      "dividend:MXRF11:2026-02-15",
      "buy:MXRF11:2026-01-10",
    ]);
    expect(h[0]).toMatchObject({ amount: 60, result: 10 });
    expect(h.find((e) => e.ticker === "PETR4").approximate).toBe(true);
    expect(h.find((e) => e.kind === "dividend").category).toBe("FIIs");
  });

  it("resume os totais", () => {
    expect(summarizeHistory(buildInvestmentHistory(investments, dividends))).toEqual({ bought: 160, sold: 60, dividends: 1, realized: 10 });
  });
});

describe("dividendNetAmount", () => {
  it("desconta 15% de IR só do JCP", () => {
    expect(dividendNetAmount("JCP", 1, 100)).toBeCloseTo(85);
    expect(dividendNetAmount("Dividendo", 1, 100)).toBe(100);
    expect(dividendNetAmount("Rendimento", 0.1, 100)).toBeCloseTo(10);
  });
});

describe("filterByAssetClass", () => {
  const all = [
    { assetIssued: "BRTAEEACNOR9", rate: "1" },
    { assetIssued: "BRTAEEACNPR6", rate: "2" },
    { assetIssued: "BRTAEECDAM10", rate: "3" },
  ];

  it("separa os proventos pela classe do ticker (ON, PN e unit)", () => {
    expect(filterByAssetClass(all, "TAEE3").map((d) => d.rate)).toEqual(["1"]);
    expect(filterByAssetClass(all, "TAEE4").map((d) => d.rate)).toEqual(["2"]);
    expect(filterByAssetClass(all, "TAEE11").map((d) => d.rate)).toEqual(["3"]);
  });

  it("retorna vazio para sufixo desconhecido", () => {
    expect(filterByAssetClass(all, "TAEE99")).toEqual([]);
  });
});

describe("sharesOnDate", () => {
  const inv = { purchases: [{ date: "2026-08-05", quantity: 10, price: 10 }, { date: "2026-10-02", quantity: 20, price: 10 }] };

  it("conta só as compras feitas até a data (inclusive)", () => {
    expect(sharesOnDate(inv, "2026-08-04")).toBe(0);
    expect(sharesOnDate(inv, "2026-08-05")).toBe(10);
    expect(sharesOnDate(inv, "2026-09-30")).toBe(10);
    expect(sharesOnDate(inv, "2026-10-02")).toBe(30);
  });
});

describe("parseB3CashDividends", () => {
  it("converte datas dd/mm/aaaa e valor com vírgula, descartando itens sem pagamento", () => {
    const parsed = parseB3CashDividends([
      { label: "RENDIMENTO", rate: "0,10000000000", lastDatePrior: "30/09/2026", paymentDate: "15/10/2026", approvedOn: "30/09/2026", relatedTo: "Setembro-2026/2026" },
      { label: "RENDIMENTO", rate: "0,1", lastDatePrior: "30/09/2026", paymentDate: "" },
    ]);
    expect(parsed).toEqual([
      { label: "RENDIMENTO", rate: 0.1, exDate: "2026-09-30", paymentDate: "2026-10-15", approvedOn: "2026-09-30", relatedTo: "Setembro-2026/2026" },
    ]);
  });

  it("tolera entrada inválida", () => {
    expect(parseB3CashDividends(undefined)).toEqual([]);
  });

  it("não conta duas vezes o mesmo rendimento listado com datas-com diferentes", () => {
    const base = { label: "RENDIMENTO", rate: "1,05", paymentDate: "15/10/2026", relatedTo: "SETEMBRO/2026" };
    const parsed = parseB3CashDividends([
      { ...base, lastDatePrior: "07/10/2026" },
      { ...base, lastDatePrior: "30/09/2026" },
      { ...base, rate: "1,05", paymentDate: "15/09/2026", relatedTo: "AGOSTO/2026", lastDatePrior: "31/08/2026" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed.find((d) => d.paymentDate === "2026-10-15").exDate).toBe("2026-10-07");
  });
});

describe("buildUpcomingDividends", () => {
  const investments = [
    { ticker: "MXRF11", purchases: [{ date: "2026-08-05", quantity: 100, price: 10 }] },
    { ticker: "VGIR11", purchases: [{ date: "2026-10-14", quantity: 50, price: 9 }] },
  ];
  const calendars = {
    MXRF11: [
      { type: "Rendimento", rate: 0.1, exDate: "2026-09-30", paymentDate: "2026-10-15" },
      { type: "Rendimento", rate: 0.1, exDate: "2026-08-31", paymentDate: "2026-09-15" },
    ],
    VGIR11: [{ type: "Rendimento", rate: 0.13, exDate: "2026-10-13", paymentDate: "2026-10-20" }],
  };

  it("lista só o que ainda será pago e calcula pelas cotas da data-com", () => {
    const items = buildUpcomingDividends(investments, calendars, "2026-10-14");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ ticker: "MXRF11", shares: 100, total: 10, paymentDate: "2026-10-15" });
  });

  it("o que é pago hoje já conta como recebido, não como a receber", () => {
    expect(buildUpcomingDividends(investments, calendars, "2026-10-15")).toHaveLength(0);
  });
});

describe("getInvestmentPurchases", () => {
  it("usa o histórico salvo quando existe", () => {
    const purchases = [{ date: "2026-09-05", quantity: 2, price: 10 }];
    expect(getInvestmentPurchases({ purchases, purchaseDate: "2026-01-01", quantity: 9, avgPrice: 9 })).toBe(purchases);
  });

  it("sintetiza uma compra única para posições sem histórico", () => {
    expect(getInvestmentPurchases({ purchaseDate: "2026-08-10", quantity: 5, avgPrice: 20 })).toEqual([
      { date: "2026-08-10", quantity: 5, price: 20 },
    ]);
  });
});

describe("buildMonthlyContributions", () => {
  const ref = new Date(2026, 8, 15); // setembro/2026

  it("soma quantidade × preço de cada compra no mês certo", () => {
    const investments = [
      { purchases: [{ date: "2026-09-05", quantity: 2, price: 100 }, { date: "2026-08-20", quantity: 1, price: 50 }] },
      { purchaseDate: "2026-09-30", quantity: 10, avgPrice: 5 },
    ];
    const months = buildMonthlyContributions(investments, 3, ref);
    expect(months.map((m) => m.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(months.map((m) => m.total)).toEqual([0, 50, 250]);
    expect(months.map((m) => m.count)).toEqual([0, 1, 2]);
  });

  it("ignora compras fora da janela de meses", () => {
    const months = buildMonthlyContributions([{ purchaseDate: "2025-01-10", quantity: 1, avgPrice: 100 }], 3, ref);
    expect(months.every((m) => m.total === 0)).toBe(true);
  });
});

describe("calcInvestmentMetrics", () => {
  it("calcula rentabilidade positiva corretamente", () => {
    const m = calcInvestmentMetrics({ quantity: 10, avgPrice: 20, currentPrice: 25 });
    expect(m.costBasis).toBe(200);
    expect(m.totalValue).toBe(250);
    expect(m.profitValue).toBe(50);
    expect(m.profitPct).toBeCloseTo(25);
  });

  it("calcula rentabilidade negativa corretamente", () => {
    const m = calcInvestmentMetrics({ quantity: 4, avgPrice: 100, currentPrice: 80 });
    expect(m.profitValue).toBe(-80);
    expect(m.profitPct).toBeCloseTo(-20);
  });

  it("não divide por zero quando avgPrice é 0 (ativo recém-criado sem preço)", () => {
    const m = calcInvestmentMetrics({ quantity: 5, avgPrice: 0, currentPrice: 10 });
    expect(m.profitPct).toBe(0);
  });

  it("trata campos ausentes/não numéricos como zero", () => {
    const m = calcInvestmentMetrics({});
    expect(m).toEqual({ quantity: 0, avgPrice: 0, currentPrice: 0, costBasis: 0, totalValue: 0, profitValue: 0, profitPct: 0 });
  });
});

describe("mergeInvestmentPurchase", () => {
  it("recalcula preço médio ponderado ao somar nova compra", () => {
    // 10 cotas a R$20 + 10 cotas a R$30 = 20 cotas a R$25 de médio
    const merged = mergeInvestmentPurchase(
      { quantity: 10, avgPrice: 20, purchaseDate: "2026-01-01" },
      { quantity: 10, price: 30, purchaseDate: "2026-02-01" }
    );
    expect(merged.quantity).toBe(20);
    expect(merged.avgPrice).toBeCloseTo(25);
  });

  it("mantém a data de compra mais recente entre a existente e a nova", () => {
    const merged = mergeInvestmentPurchase(
      { quantity: 1, avgPrice: 10, purchaseDate: "2026-05-01" },
      { quantity: 1, price: 10, purchaseDate: "2026-01-01" }
    );
    expect(merged.purchaseDate).toBe("2026-05-01");
  });
});

describe("pctChange", () => {
  it("calcula variação percentual normal", () => {
    expect(pctChange(120, 100)).toBeCloseTo(20);
    expect(pctChange(80, 100)).toBeCloseTo(-20);
  });

  it("trata base zero sem gerar Infinity/NaN", () => {
    expect(pctChange(50, 0)).toBe(100);
    expect(pctChange(0, 0)).toBe(0);
  });

  it("usa valor absoluto da base quando ela é negativa", () => {
    expect(pctChange(-50, -100)).toBeCloseTo(50);
  });
});

describe("buildMonthlySeries", () => {
  const ref = new Date(2026, 2, 15); // 15/mar/2026

  it("agrupa receitas e despesas no mês correto dentro da janela", () => {
    const transactions = [
      { date: "2026-03-10", type: "income", amount: 1000 },
      { date: "2026-03-20", type: "expense", amount: 300 },
      { date: "2026-02-05", type: "expense", amount: 50 },
    ];
    const { labels, income, expense } = buildMonthlySeries(transactions, 3, ref);
    expect(labels).toHaveLength(3); // jan, fev, mar
    expect(income[2]).toBe(1000); // março é o último mês da janela
    expect(expense[2]).toBe(300);
    expect(expense[1]).toBe(50); // fevereiro
  });

  it("ignora transações fora da janela de meses", () => {
    const transactions = [{ date: "2025-01-01", type: "income", amount: 999 }];
    const { income } = buildMonthlySeries(transactions, 3, ref);
    expect(income.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("calcBudgetSpent", () => {
  const ref = new Date(2026, 7, 14); // 14/ago/2026

  it("soma só despesas da categoria no mês de referência", () => {
    const transactions = [
      { type: "expense", category: "Alimentação", amount: 100, date: "2026-08-05" },
      { type: "expense", category: "Alimentação", amount: 50, date: "2026-08-20" },
      { type: "expense", category: "Transporte", amount: 999, date: "2026-08-01" }, // categoria diferente
      { type: "income", category: "Alimentação", amount: 999, date: "2026-08-01" }, // tipo diferente
      { type: "expense", category: "Alimentação", amount: 999, date: "2026-07-01" }, // mês diferente
    ];
    expect(calcBudgetSpent("Alimentação", transactions, ref)).toBe(150);
  });

  it("retorna 0 quando não há gasto na categoria", () => {
    expect(calcBudgetSpent("Lazer", [], ref)).toBe(0);
  });
});

describe("recurrenceDateForMonth", () => {
  it("usa o dia configurado quando ele existe no mês", () => {
    expect(recurrenceDateForMonth(2026, 0, 15)).toBe("2026-01-15"); // janeiro
  });

  it("limita ao último dia do mês quando o dia configurado não existe (fevereiro não bissexto)", () => {
    expect(recurrenceDateForMonth(2026, 1, 31)).toBe("2026-02-28");
  });

  it("limita corretamente em ano bissexto", () => {
    expect(recurrenceDateForMonth(2028, 1, 31)).toBe("2028-02-29");
  });

  it("limita ao dia 30 em meses com 30 dias", () => {
    expect(recurrenceDateForMonth(2026, 3, 31)).toBe("2026-04-30"); // abril
  });
});

describe("dividendDedupeKey", () => {
  it("gera a mesma chave pros mesmos dados", () => {
    expect(dividendDedupeKey("PETR4", "2026-01-01", "Dividendo")).toBe(
      dividendDedupeKey("PETR4", "2026-01-01", "Dividendo")
    );
  });

  it("gera chaves diferentes quando qualquer campo muda", () => {
    const base = dividendDedupeKey("PETR4", "2026-01-01", "Dividendo");
    expect(dividendDedupeKey("VALE3", "2026-01-01", "Dividendo")).not.toBe(base);
    expect(dividendDedupeKey("PETR4", "2026-02-01", "Dividendo")).not.toBe(base);
    expect(dividendDedupeKey("PETR4", "2026-01-01", "JCP")).not.toBe(base);
  });
});

describe("analyzePortfolioHealth", () => {
  const settings = { targets: { "FIIs": 50, "Ações": 50 }, maxAssetPct: 30, minAssets: 4 };
  const inv = (ticker, category, value) => ({ ticker, category, quantity: 1, avgPrice: value, currentPrice: value });

  it("carteira alinhada e diversificada tem nota alta e nenhum alerta", () => {
    const investments = [inv("A11", "FIIs", 25), inv("B11", "FIIs", 25), inv("C3", "Ações", 25), inv("D3", "Ações", 25)];
    const a = analyzePortfolioHealth(investments, [], settings, "2026-10-15");
    expect(a.totalValue).toBe(100);
    expect(a.score).toBe(100);
    expect(a.status).toBe("healthy");
    expect(a.alerts).toEqual([]);
  });

  it("aponta ativo acima do limite, excesso de categoria e poucos ativos", () => {
    const investments = [inv("A11", "FIIs", 80), inv("C3", "Ações", 20)];
    const a = analyzePortfolioHealth(investments, [], settings, "2026-10-15");
    const titles = a.alerts.map((x) => x.title);
    expect(titles).toContain("A11 representa 80,0% da carteira");
    expect(titles).toContain("Excesso em FIIs: 80,0% (meta 50%)");
    expect(titles).toContain("Falta Ações: 20,0% (meta 50%)");
    expect(titles).toContain("Poucos ativos: 2 de 4");
    expect(a.alerts[0].level).toBe("critical");
    expect(a.score).toBeLessThan(50);
  });

  it("considera a concentração de proventos dos últimos 12 meses", () => {
    const investments = [inv("A11", "FIIs", 25), inv("B11", "FIIs", 25), inv("C3", "Ações", 25), inv("D3", "Ações", 25)];
    const dividends = [
      { ticker: "A11", amount: 90, date: "2026-09-15" },
      { ticker: "B11", amount: 10, date: "2026-09-15" },
      { ticker: "B11", amount: 500, date: "2025-01-15" }, // fora da janela
    ];
    const a = analyzePortfolioHealth(investments, dividends, settings, "2026-10-15");
    expect(a.income12m).toBe(100);
    // 2 meses de histórico (set e out): R$ 100 anualizados = R$ 600 sobre R$ 100 de patrimônio
    expect(a.incomeMonths).toBe(2);
    expect(a.dividendYield12m).toBeCloseTo(600);
    expect(a.alerts.map((x) => x.title)).toContain("A11 gera 90% dos seus proventos");
    expect(a.components.find((c) => c.key === "income").score).toBe(0);
  });

  it("carteira vazia não quebra", () => {
    expect(analyzePortfolioHealth([], [], settings, "2026-10-15").empty).toBe(true);
  });
});

describe("suggestContribution", () => {
  it("direciona o aporte às categorias abaixo da meta e soma exatamente o valor", () => {
    const analysis = { totalValue: 1000, byCategory: [{ category: "FIIs", value: 800 }, { category: "Ações", value: 200 }] };
    const items = suggestContribution(analysis, { "FIIs": 50, "Ações": 50 }, 500);
    expect(items).toEqual([{ category: "Ações", amount: 500 }]);
  });

  it("sem déficit, segue a proporção das metas", () => {
    const analysis = { totalValue: 0, byCategory: [] };
    const items = suggestContribution(analysis, { "FIIs": 70, "Ações": 30 }, 100);
    expect(items).toEqual([{ category: "FIIs", amount: 70 }, { category: "Ações", amount: 30 }]);
    expect(suggestContribution(analysis, { "FIIs": 100 }, 0)).toEqual([]);
  });
});

describe("projectPortfolio", () => {
  it("sem rendimento, o patrimônio final é o inicial mais os aportes", () => {
    const p = projectPortfolio({ initial: 1000, monthlyContribution: 100, annualAppreciation: 0, annualYield: 0, reinvest: true, years: 1 });
    expect(p.finalBalance).toBeCloseTo(2200);
    expect(p.totalContributed).toBeCloseTo(2200);
    expect(p.points).toHaveLength(13);
  });

  it("valorização anual composta e proventos reinvestidos ou não", () => {
    const grow = projectPortfolio({ initial: 1000, monthlyContribution: 0, annualAppreciation: 10, annualYield: 0, reinvest: true, years: 1 });
    expect(grow.finalBalance).toBeCloseTo(1100);
    const withIncome = projectPortfolio({ initial: 1200, monthlyContribution: 0, annualAppreciation: 0, annualYield: 12, reinvest: false, years: 1 });
    expect(withIncome.finalBalance).toBeCloseTo(1200);
    expect(withIncome.incomeReceived).toBeCloseTo(144);
    expect(withIncome.monthlyIncome).toBeCloseTo(12);
  });
});

describe("parseB3IndexYear", () => {
  it("converte a matriz dia × mês da B3 em pontos ordenados, pulando dias vazios", () => {
    const results = [
      { day: 2, rateValue1: "3.778,89", rateValue2: null, rateValue3: "" },
      { day: 1, rateValue1: null, rateValue2: "3.853,10" },
    ];
    expect(parseB3IndexYear(results, 2026)).toEqual([
      ["2026-01-02", 3778.89],
      ["2026-02-01", 3853.1],
    ]);
  });
});

describe("buildCdiIndex", () => {
  it("acumula as taxas diárias", () => {
    const idx = buildCdiIndex([{ date: "2026-01-02", rate: 1 }, { date: "2026-01-01", rate: 1 }]);
    expect(idx[0][0]).toBe("2026-01-01");
    expect(idx[1][1]).toBeCloseTo(1.0201);
  });
});

describe("simulateBenchmark e buildMarketComparison", () => {
  // Índice que dobra entre jan e mar.
  const series = [["2026-01-01", 100], ["2026-02-01", 150], ["2026-03-01", 200]];

  it("aplica cada aporte na data em que foi feito", () => {
    const flows = [{ date: "2026-01-01", amount: 1000 }, { date: "2026-02-01", amount: 1500 }];
    expect(simulateBenchmark(flows, series, ["2026-03-01"])).toEqual([2000 + 2000]);
    expect(simulateBenchmark(flows, [], ["2026-03-01"])).toBeNull();
  });

  it("vendas retiram dinheiro da simulação na data da venda", () => {
    const flows = [{ date: "2026-01-01", amount: 1000 }, { date: "2026-02-01", amount: -750 }];
    // 1000 -> 2000 em mar; os 750 tirados em fev valeriam 1000 em mar
    expect(simulateBenchmark(flows, series, ["2026-03-01"])[0]).toBeCloseTo(1000);
  });

  it("compara a carteira (valor atual + proventos) com cada índice", () => {
    const investments = [
      { ticker: "A11", category: "FIIs", quantity: 10, avgPrice: 100, currentPrice: 120, purchases: [{ date: "2026-01-01", quantity: 10, price: 100 }] },
    ];
    const dividends = [{ ticker: "A11", amount: 30, date: "2026-02-15" }, { ticker: "OUTRO", amount: 999, date: "2026-02-15" }];
    const indices = { cdi: [{ date: "2026-01-01", rate: 0 }], ibov: series, ifix: [] };
    const c = buildMarketComparison(investments, dividends, indices, "2026-03-01");

    expect(c.netInvested).toBe(1000);
    expect(c.portfolioTotal).toBe(1230); // 1200 em carteira + 30 de proventos
    expect(c.portfolioPct).toBeCloseTo(23);
    expect(c.benchmarks.ibov.final).toBeCloseTo(2000);
    expect(c.benchmarks.ibov.pct).toBeCloseTo(100);
    expect(c.benchmarks.cdi.final).toBeCloseTo(1000);
    expect(c.benchmarks.ifix).toBeNull();
    expect(c.dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-01"]);
    expect(c.invested).toEqual([1000, 1000, 1000]);
  });

  it("sem aportes, devolve vazio", () => {
    expect(buildMarketComparison([], [], {}, "2026-03-01").empty).toBe(true);
  });
});

describe("buildDividendCalendar", () => {
  const events = [
    { paymentDate: "2026-10-15", total: 10, status: "received" },
    { paymentDate: "2026-10-15", total: 5, status: "received" },
    { paymentDate: "2026-10-20", total: 30, status: "upcoming" },
    { paymentDate: "2026-11-01", total: 99, status: "upcoming" },
  ];

  it("monta as semanas do mês (domingo a sábado) com os totais de cada dia", () => {
    const cal = buildDividendCalendar("2026-10", events);
    // 01/10/2026 é uma quinta-feira: 4 células vazias antes
    expect(cal.weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(cal.weeks[0][4]).toMatchObject({ date: "2026-10-01", day: 1, count: 0 });
    expect(cal.weeks.every((w) => w.length === 7)).toBe(true);
    const all = cal.weeks.flat().filter(Boolean);
    expect(all).toHaveLength(31);
    expect(all.find((c) => c.day === 15)).toMatchObject({ received: 15, upcoming: 0, count: 2 });
    expect(all.find((c) => c.day === 20)).toMatchObject({ received: 0, upcoming: 30, count: 1 });
    expect(cal.received).toBe(15);
    expect(cal.upcoming).toBe(30);
  });

  it("navega entre meses", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("financialIndependencePlan", () => {
  it("calcula o patrimônio necessário e quando a renda alcança a meta", () => {
    const plan = financialIndependencePlan({ initial: 100000, monthlyContribution: 1000, annualAppreciation: 0, annualYield: 12, targetMonthlyIncome: 2000 });
    expect(plan.requiredWealth).toBeCloseTo(200000); // 2.000 × 12 / 12%
    expect(plan.months).toBeGreaterThan(0);
    expect(plan.months).toBeLessThan(12 * 10);
  });

  it("já atingida, sem meta ou sem yield", () => {
    expect(financialIndependencePlan({ initial: 300000, monthlyContribution: 0, annualAppreciation: 0, annualYield: 12, targetMonthlyIncome: 2000 })).toMatchObject({ months: 0, reachedAlready: true });
    expect(financialIndependencePlan({ initial: 1, monthlyContribution: 0, annualAppreciation: 0, annualYield: 12, targetMonthlyIncome: 0 }).months).toBeNull();
    expect(financialIndependencePlan({ initial: 1, monthlyContribution: 0, annualAppreciation: 0, annualYield: 0, targetMonthlyIncome: 2000 }).requiredWealth).toBeNull();
  });

  it("não alcançada no prazo máximo", () => {
    const plan = financialIndependencePlan({ initial: 10, monthlyContribution: 0, annualAppreciation: 0, annualYield: 1, targetMonthlyIncome: 1e9, maxYears: 5 });
    expect(plan.months).toBeNull();
  });
});

describe("buildAlerts", () => {
  const today = "2026-10-16";

  it("sem nada relevante, nenhum alerta", () => {
    expect(buildAlerts({ today })).toEqual([]);
  });

  it("proventos de hoje e dos próximos 7 dias", () => {
    const alerts = buildAlerts({
      today,
      dividends: [{ ticker: "MXRF11", amount: 2.2, date: today }, { ticker: "TVRI11", amount: 50, date: "2026-10-01" }],
      upcoming: [
        { ticker: "VGIR11", total: 30, paymentDate: "2026-10-20" },
        { ticker: "ISAE4", total: 16, paymentDate: "2026-12-07" }, // fora da semana
      ],
    });
    expect(alerts.map((a) => a.title.replace(/\s/g, " "))).toEqual(["Caíram R$ 2,20 em proventos hoje", "R$ 30,00 em proventos nos próximos 7 dias"]);
    expect(alerts[1].detail).toBe("VGIR11 20/10");
  });

  it("orçamento estourado e perto do limite", () => {
    const transactions = [
      { type: "expense", category: "Alimentação", amount: 1100, date: "2026-10-05" },
      { type: "expense", category: "Lazer", amount: 460, date: "2026-10-05" },
      { type: "expense", category: "Lazer", amount: 999, date: "2026-09-05" }, // outro mês
    ];
    const alerts = buildAlerts({ today, transactions, budgets: [{ category: "Alimentação", monthlyLimit: 1000 }, { category: "Lazer", monthlyLimit: 500 }] });
    expect(alerts[0]).toMatchObject({ level: "critical", title: "Orçamento de Alimentação estourado" });
    expect(alerts[1]).toMatchObject({ level: "warning", title: "Lazer já usou 92% do orçamento" });
  });

  it("metas, cotações, saúde crítica e pedidos de entrada", () => {
    const alerts = buildAlerts({
      today,
      goals: [
        { id: "g1", name: "Viagem", targetAmount: 1000, currentAmount: 500, deadline: "2026-10-26" },
        { id: "g2", name: "Carro", targetAmount: 1000, currentAmount: 100, deadline: "2026-09-01" },
        { id: "g3", name: "Feita", targetAmount: 100, currentAmount: 100, deadline: "2026-10-20" },
      ],
      investments: [{ ticker: "PETR4", quantity: 1, lastQuoteError: true }, { ticker: "OLD", quantity: 0, lastQuoteError: true }],
      health: { alerts: [{ level: "critical", title: "TVRI11 representa 40,0% da carteira", detail: "x" }, { level: "info", title: "Falta Ações", detail: "y" }] },
      joinRequests: 2,
    });
    const titles = alerts.map((a) => a.title.replace(/\s/g, " "));
    expect(titles).toContain('Meta "Viagem" vence em 10 dias');
    expect(titles).toContain('Prazo da meta "Carro" passou');
    expect(titles.some((t) => t.includes("Feita"))).toBe(false);
    expect(titles).toContain("Cotação desatualizada em 1 ativo");
    expect(titles).toContain("TVRI11 representa 40,0% da carteira");
    expect(titles).not.toContain("Falta Ações");
    expect(titles).toContain("2 pedidos para entrar no seu espaço de casal");
    // ids estáveis mesmo quando o percentual muda
    const again = buildAlerts({ today, health: { alerts: [{ level: "critical", title: "TVRI11 representa 41,3% da carteira", detail: "x" }] } });
    expect(again[0].id).toBe(alerts.find((a) => a.view === "health").id);
  });
});

describe("passwordProblem (senha de cadastro)", () => {
  it("aceita senha com 8+ caracteres, letras e números", () => {
    expect(passwordProblem("minhaSenha123")).toBeNull();
    expect(passwordProblem("Senha-forte-2026!")).toBeNull();
    expect(passwordProblem("açaí2026x")).toBeNull();
  });

  it("recusa curta, só letras, só números e repetida", () => {
    expect(passwordProblem("abc123")).toMatch(/pelo menos 8/);
    expect(passwordProblem("somenteletras")).toMatch(/letras e números/);
    expect(passwordProblem("123456789")).toMatch(/letras e números/);
    expect(passwordProblem("aaaaaaaa")).toMatch(/letras e números|menos óbvia/);
    expect(passwordProblem("")).toMatch(/pelo menos 8/);
    expect(passwordProblem(undefined)).toMatch(/pelo menos 8/);
  });

  it("recusa senha gigante", () => {
    expect(passwordProblem("a1".repeat(70))).toMatch(/no máximo 128/);
  });
});

/* =========================================================
   Contas, cartões, saldo projetado, reserva, CSV e lembretes
   ========================================================= */
describe("datas e parcelas", () => {
  it("dateInMonth limita ao último dia do mês", () => {
    expect(dateInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dateInMonth("2028-02", 30)).toBe("2028-02-29");
    expect(dateInMonth("2026-10", 5)).toBe("2026-10-05");
  });

  it("addMonthsToDate preserva o dia preferido quando o mês permite", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDate("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonthsToDate("2026-11-15", 2)).toBe("2027-01-15");
  });

  it("splitInstallments fecha em centavos exatos (diferença na 1ª)", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitInstallments(10, 1)).toEqual([10]);
    expect(splitInstallments(0.05, 2)).toEqual([0.03, 0.02]);
    const parts = splitInstallments(1999.99, 12);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(199999);
  });
});

describe("cartão de crédito", () => {
  const card = { id: "c1", name: "Nubank", closingDay: 10, dueDay: 17, limit: 5000 };
  const purchases = [
    { id: "p1", cardId: "c1", description: "TV", category: "Outros", amount: 1200, installments: 3, purchaseDate: "2026-10-12" },
    { id: "p2", cardId: "c1", description: "Mercado", category: "Alimentação", amount: 300, installments: 1, purchaseDate: "2026-10-02" },
    { id: "p3", cardId: "outro", description: "Não é deste", category: "Outros", amount: 50, installments: 1, purchaseDate: "2026-10-02" },
  ];

  it("compra antes do fechamento entra na fatura do mês; no dia ou depois, na do mês seguinte", () => {
    expect(invoiceMonthOf("2026-10-09", 10)).toBe("2026-10");
    expect(invoiceMonthOf("2026-10-10", 10)).toBe("2026-11");
    expect(invoiceMonthOf("2026-12-20", 10)).toBe("2027-01");
  });

  it("vencimento antes do fechamento cai no mês seguinte", () => {
    expect(invoiceDates("2026-10", 10, 17)).toEqual({ closingDate: "2026-10-10", dueDate: "2026-10-17" });
    expect(invoiceDates("2026-10", 28, 5)).toEqual({ closingDate: "2026-10-28", dueDate: "2026-11-05" });
  });

  it("monta as faturas com cada parcela no seu mês", () => {
    const inv = buildCardInvoices(card, purchases);
    expect(Object.keys(inv).sort()).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
    expect(inv["2026-10"].total).toBe(300);
    expect(inv["2026-11"].items[0]).toMatchObject({ description: "TV", installment: 1, installments: 3, amount: 400 });
    expect(inv["2027-01"].items[0].installment).toBe(3);
  });

  it("status da fatura", () => {
    const inv = buildCardInvoices(card, purchases)["2026-10"];
    expect(invoiceStatus(inv, "2026-10-05")).toBe("open");
    expect(invoiceStatus(inv, "2026-10-12")).toBe("closed");
    expect(invoiceStatus(inv, "2026-10-18")).toBe("overdue");
    expect(invoiceStatus({ ...inv, paid: true }, "2026-10-18")).toBe("paid");
  });

  it("resumo: fatura atual, a pagar e limite usado (faturas pagas liberam o limite)", () => {
    const s = cardSummary(card, purchases, [], "2026-10-19");
    expect(s.current.month).toBe("2026-11");
    expect(s.toPay.month).toBe("2026-10");
    expect(s.used).toBe(1500);
    expect(s.available).toBe(3500);

    const paid = cardSummary(card, purchases, [{ cardId: "c1", month: "2026-10", paid: true, paidAt: "2026-10-15" }], "2026-10-19");
    expect(paid.toPay).toBeNull();
    expect(paid.used).toBe(1200);
  });

  it("faturas não pagas de todos os cartões, ordenadas pelo vencimento", () => {
    const list = unpaidInvoices([card], purchases, [{ cardId: "c1", month: "2026-10", paid: true }]);
    expect(list.map((i) => i.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(list[0]).toMatchObject({ cardName: "Nubank", total: 400, dueDate: "2026-11-17" });
  });

  it("pagar a fatura gera uma despesa por categoria", () => {
    const inv = buildCardInvoices(card, purchases)["2026-11"];
    expect(invoicePaymentTransactions(card, inv, "2026-11-17")).toEqual([
      { description: "Fatura Nubank 11/2026 · Outros", amount: 400, type: "expense", category: "Outros", date: "2026-11-17" },
    ]);
  });

  it("várias compras da mesma categoria viram uma despesa só (centavos exatos)", () => {
    const many = [
      { id: "a", cardId: "c1", description: "Pizza", category: "Alimentação", amount: 10.1, installments: 1, purchaseDate: "2026-10-12" },
      { id: "b", cardId: "c1", description: "Mercado", category: "Alimentação", amount: 20.2, installments: 1, purchaseDate: "2026-10-13" },
      { id: "c", cardId: "c1", description: "Cinema", category: "Lazer", amount: 30, installments: 1, purchaseDate: "2026-10-14" },
    ];
    const inv = buildCardInvoices(card, many)["2026-11"];
    const out = invoicePaymentTransactions(card, inv, "2026-11-17");
    expect(out.map((t) => [t.category, t.amount])).toEqual([["Alimentação", 30.3], ["Lazer", 30]]);
    expect(out.reduce((sum, t) => sum + t.amount, 0)).toBeCloseTo(inv.total, 2);
  });

  it("invoiceForMonth devolve fatura vazia para mês sem compras", () => {
    const inv = invoiceForMonth(card, purchases, [], "2027-05");
    expect(inv).toMatchObject({ month: "2027-05", total: 0, items: [], dueDate: "2027-05-17" });
  });
});

describe("contas a pagar", () => {
  const today = "2026-10-19";
  const bills = [
    { id: "a", description: "Luz", amount: 200, dueDate: "2026-10-15", paid: false },
    { id: "b", description: "Água", amount: 80, dueDate: "2026-10-20", paid: false },
    { id: "c", description: "Aluguel", amount: 1900, dueDate: "2026-10-30", paid: false },
    { id: "d", description: "Net", amount: 120, dueDate: "2026-10-05", paid: true, paidAt: "2026-10-04" },
    { id: "e", description: "IPTU", amount: 300, dueDate: "2026-11-10", paid: false },
  ];

  it("status de cada conta", () => {
    expect(billStatus(bills[0], today)).toBe("overdue");
    expect(billStatus(bills[1], today)).toBe("soon");
    expect(billStatus(bills[2], today)).toBe("pending");
    expect(billStatus(bills[3], today)).toBe("paid");
  });

  it("totais do mês", () => {
    expect(billsSummary(bills, today)).toEqual({ toPay: 1980, overdue: 200, overdueCount: 1, paid: 120 });
  });

  it("alertas de contas vencidas, perto do vencimento e de faturas", () => {
    const alerts = buildAlerts({
      today,
      bills,
      invoices: [{ cardId: "c1", cardName: "Nubank", month: "2026-10", dueDate: "2026-10-21", total: 300 }],
    });
    const titles = alerts.map((a) => a.title);
    expect(titles).toContain("Conta vencida: Luz");
    expect(titles).toContain("Água vence amanhã");
    expect(titles).toContain("Fatura Nubank vence em 2 dias");
    expect(titles.some((t) => t.includes("Aluguel"))).toBe(false);
    expect(alerts[0].level).toBe("critical");
  });
});

describe("saldo projetado do mês", () => {
  it("soma o realizado e o que ainda vai entrar e sair", () => {
    const p = projectMonthBalance({
      today: "2026-10-19",
      transactions: [
        { date: "2026-10-05", type: "income", amount: 5000, description: "Salário" },
        { date: "2026-10-10", type: "expense", amount: 800, description: "Mercado" },
        { date: "2026-10-25", type: "expense", amount: 100, description: "Academia" },
        { date: "2026-09-25", type: "expense", amount: 999, description: "Mês passado" },
      ],
      recurrences: [
        { description: "Freela", amount: 700, type: "income", dayOfMonth: 28, lastGeneratedMonth: "2026-09" },
        { description: "Já lançada", amount: 50, type: "expense", dayOfMonth: 2, lastGeneratedMonth: "2026-10" },
      ],
      bills: [
        { description: "Luz", amount: 200, dueDate: "2026-10-28", paid: false },
        { description: "Vencida", amount: 30, dueDate: "2026-10-01", paid: false },
        { description: "Paga", amount: 999, dueDate: "2026-10-01", paid: true },
        { description: "Novembro", amount: 999, dueDate: "2026-11-10", paid: false },
      ],
      invoices: [
        { cardName: "Nubank", dueDate: "2026-10-21", total: 300 },
        { cardName: "Nubank", dueDate: "2026-11-17", total: 400 },
      ],
    });
    expect(p.realized).toBe(4200);
    expect(p.incoming).toBe(700);
    expect(p.outgoing).toBe(630);
    expect(p.projected).toBe(4270);
    expect(p.upcoming.map((u) => u.description)).toEqual(["Vencida", "Fatura Nubank", "Academia", "Freela", "Luz"]);
  });
});

describe("reserva de emergência", () => {
  const today = "2026-10-19";
  const txs = [
    { date: "2026-09-10", type: "expense", amount: 3000 },
    { date: "2026-08-10", type: "expense", amount: 2000 },
    { date: "2026-08-12", type: "income", amount: 9000 },
    { date: "2026-10-01", type: "expense", amount: 99999 }, // mês atual não conta
  ];

  it("média dos meses completos com movimento", () => {
    expect(averageMonthlyExpenses(txs, today)).toBe(2500);
    expect(averageMonthlyExpenses([], today)).toBeNull();
  });

  it("meses cobertos e quanto falta para a meta", () => {
    expect(emergencyReserve({ amount: 10000, monthlyExpenses: 2500, targetMonths: 6 })).toMatchObject({ months: 4, targetAmount: 15000, missing: 5000 });
    expect(emergencyReserve({ amount: 20000, monthlyExpenses: 2500 })).toMatchObject({ missing: 0, progress: 100 });
    expect(emergencyReserve({ amount: 1000, monthlyExpenses: null }).months).toBeNull();
  });

  it("valor somado das fontes escolhidas", () => {
    const goals = [{ id: "g1", currentAmount: 5000 }];
    const investments = [{ id: "i1", quantity: 10, avgPrice: 100, currentPrice: 110 }];
    expect(reserveAmount(["goal:g1", "inv:i1", "inv:inexistente"], goals, investments, 250)).toBe(6350);
  });
});

describe("transactionsToCsv", () => {
  it("gera CSV no padrão do Excel em português", () => {
    const csv = transactionsToCsv([
      { date: "2026-10-05", description: "Salário", category: "Salário", type: "income", amount: 5000 },
      { date: "2026-10-02", description: 'Mercado; "promo"', category: "Alimentação", type: "expense", amount: 123.4 },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Data;Descrição;Categoria;Tipo;Valor");
    expect(lines[1]).toBe('02/10/2026;"Mercado; ""promo""";Alimentação;Despesa;-123,40');
    expect(lines[2]).toBe("05/10/2026;Salário;Salário;Receita;5000,00");
  });
});

describe("buildPushReminders", () => {
  it("contas e faturas de ontem/hoje/amanhã e proventos de amanhã", () => {
    const r = buildPushReminders({
      today: "2026-10-19",
      bills: [
        { id: "a", description: "Luz", amount: 200, dueDate: "2026-10-19", paid: false },
        { id: "b", description: "Água", amount: 80, dueDate: "2026-10-20", paid: false },
        { id: "c", description: "Gás", amount: 90, dueDate: "2026-10-18", paid: false },
        { id: "d", description: "Paga", amount: 90, dueDate: "2026-10-19", paid: true },
        { id: "e", description: "Longe", amount: 90, dueDate: "2026-10-25", paid: false },
      ],
      invoices: [{ cardId: "c1", cardName: "Nubank", month: "2026-10", dueDate: "2026-10-20", total: 300 }],
      upcomingDividends: [
        { ticker: "MXRF11", paymentDate: "2026-10-20", total: 10 },
        { ticker: "HGLG11", paymentDate: "2026-10-20", total: 5.5 },
        { ticker: "XPML11", paymentDate: "2026-10-25", total: 99 },
      ],
    });
    expect(r.map((x) => x.title.replace(/\s/g, " "))).toEqual([
      "Luz vence hoje",
      "Água vence amanhã",
      "Conta vencida: Gás",
      "Fatura Nubank vence amanhã",
      "R$ 15,50 em proventos amanhã",
    ]);
    expect(r[4].body).toBe("MXRF11, HGLG11");
    expect(r.every((x) => x.tag && x.view)).toBe(true);
  });
});

describe("avisos extras: antecipado de contas e resumo da semana", () => {
  it("conta que vence em 3 dias avisa antes; em 2 ou 4 dias, não", () => {
    const bills = [3, 2, 4].map((d, i) => ({ id: "b" + i, description: "Conta" + d, amount: 10, dueDate: `2026-10-${String(19 + d).padStart(2, "0")}`, paid: false }));
    const r = buildPushReminders({ today: "2026-10-19", bills });
    expect(r.map((x) => x.title)).toEqual(["Conta3 vence em 3 dias"]);
  });

  it("segunda-feira: resume a semana anterior (gastos, receitas e proventos)", () => {
    const transactions = [
      { type: "expense", amount: 100, date: "2026-10-14" },
      { type: "expense", amount: 50.5, date: "2026-10-18" },
      { type: "income", amount: 300, date: "2026-10-15" },
      { type: "expense", amount: 999, date: "2026-10-10" }, // semana antes: fora
      { type: "expense", amount: 999, date: "2026-10-19" }, // hoje: fora
    ];
    const dividends = [{ amount: 12.34, date: "2026-10-16" }];
    const [r] = buildPushReminders({ today: "2026-10-19", transactions, dividends });
    expect(r.title).toBe("Resumo da semana");
    expect(r.body.replace(/\s/g, " ")).toBe("Gastou R$ 150,50 · recebeu R$ 300,00 · R$ 12,34 de proventos");
  });

  it("fora da segunda ou sem movimento: não manda resumo", () => {
    const transactions = [{ type: "expense", amount: 100, date: "2026-10-14" }];
    expect(buildPushReminders({ today: "2026-10-20", transactions })).toEqual([]);
    expect(buildPushReminders({ today: "2026-10-19" })).toEqual([]);
  });
});

describe("compra feita só editando a quantidade", () => {
  it("cotas sem compra no histórico viram uma compra nova, sem mexer nas antigas", () => {
    const inv = { quantity: 233, avgPrice: 10, purchaseDate: "2026-08-01", purchases: [{ date: "2026-08-01", quantity: 232, price: 10 }] };
    expect(unrecordedQuantity(inv)).toBe(1);
    const r = registerPurchase(inv, { quantity: 1, price: 10.5, date: "2026-11-05" });
    expect(r.purchases).toEqual([{ date: "2026-08-01", quantity: 232, price: 10 }, { date: "2026-11-05", quantity: 1, price: 10.5 }]);
    expect(r.purchaseDate).toBe("2026-11-05");
  });

  it("posição antiga (compra única e sintética): a compra sai da mais recente para o total não dobrar", () => {
    const inv = { quantity: 233, avgPrice: 10, purchaseDate: "2026-08-01" };
    expect(unrecordedQuantity(inv)).toBe(0);
    const r = registerPurchase(inv, { quantity: 1, price: 11, date: "2026-11-05" });
    expect(r.purchases).toEqual([{ date: "2026-08-01", quantity: 232, price: 10 }, { date: "2026-11-05", quantity: 1, price: 11 }]);
    expect(r.purchases.reduce((t, p) => t + p.quantity, 0)).toBe(233);
  });

  it("vendas entram na conta e dados inválidos são recusados", () => {
    const inv = { quantity: 90, avgPrice: 10, purchaseDate: "2026-08-01", purchases: [{ date: "2026-08-01", quantity: 100, price: 10 }], sales: [{ date: "2026-09-01", quantity: 10, price: 12, avgPrice: 10 }] };
    expect(unrecordedQuantity(inv)).toBe(0);
    expect(() => registerPurchase(inv, { quantity: 0, price: 10, date: "2026-11-05" })).toThrow();
    expect(() => registerPurchase(inv, { quantity: 91, price: 10, date: "2026-11-05" })).toThrow();
  });
});

describe("splitBalance (acerto do casal)", () => {
  const t = (id, paidBy, amount, extra = {}) => ({ id, type: "expense", paidBy, amount, ...extra });

  it("divide meio a meio: quem pagou mais recebe a diferença", () => {
    const b = splitBalance([t("1", "eu", 100), t("2", "ela", 40), t("3", "eu", 20)], "eu");
    expect(b).toMatchObject({ mine: 120, theirs: 40, owed: 40 });
    expect(b.ids).toEqual(["1", "2", "3"]);
  });

  it("devendo: valor negativo; sem paidBy, acertadas e receitas ficam de fora", () => {
    const b = splitBalance([t("1", "ela", 90), t("2", undefined, 500), t("3", "eu", 500, { settled: true }), { id: "4", type: "income", paidBy: "eu", amount: 500 }], "eu");
    expect(b).toMatchObject({ mine: 0, theirs: 90, owed: -45, ids: ["1"] });
  });

  it("vazio: tudo zero", () => {
    expect(splitBalance([], "eu")).toEqual({ mine: 0, theirs: 0, owed: 0, ids: [] });
    expect(splitBalance(undefined, "eu").owed).toBe(0);
  });
});

describe("filterFiiQuotas (FIIs: só a cota, sem recibos de subscrição)", () => {
  const row = (assetIssued, rate, paymentDate = "13/11/2026") => ({ assetIssued, rate, paymentDate, label: "RENDIMENTO", lastDatePrior: "30/10/2026", relatedTo: "OUTUBRO 2026/2026", approvedOn: "30/10/2026" });

  it("KNCR11: fica só o 1,10 da cota e descarta os recibos (0,47 e 0,20)", () => {
    const raw = [row("BRKNCRCTF000", "1,10"), row("BRKNCRR44M19", "0,47"), row("BRKNCRR45M18", "0,20")];
    const out = parseB3CashDividends(filterFiiQuotas(raw));
    expect(out.map((d) => d.rate)).toEqual([1.1]);
  });

  it("aceita os vários finais de ISIN de cota (CTF000, CTF004, CTF008...)", () => {
    for (const isin of ["BRHGLGCTF004", "BRMXRFCTF008", "BRTVRICTF001", "BRXPMLCTF000"]) {
      expect(filterFiiQuotas([row(isin, "1"), row(isin.slice(0, 6) + "R26M17", "9")])).toHaveLength(1);
    }
  });

  it("formato inesperado: não esconde tudo (devolve a lista original)", () => {
    const raw = [row("XYZ", "1"), row(undefined, "2")];
    expect(filterFiiQuotas(raw)).toEqual(raw);
    expect(filterFiiQuotas(undefined)).toEqual([]);
  });
});

describe("radar do mercado", () => {
  it("pickMovers: só papéis líquidos, sem fracionário, e FIIs sem ETFs (nameMatch)", () => {
    const rows = [
      { stock: "AAAA3", name: "Boa SA", close: 10, change: 5, volume: 1_000_000 },
      { stock: "BBBB3", name: "Ilíquida", close: 3, change: 85, volume: 2 },
      { stock: "CCCC3F", name: "Fracionário", close: 3, change: 60, volume: 9_000_000 },
      { stock: "DDDD4", name: "Cai SA", close: 20, change: -7, volume: 500_000 },
      { stock: "EEEE11", name: "FUNDO IMOBILIÁRIO X", close: 100, change: 2, volume: 50_000 },
      { stock: "FFFF11", name: "HASHDEX FUNDO DE ÍNDICE", close: 30, change: 9, volume: 900_000 },
    ];
    const acoes = pickMovers(rows, { minTurnover: 5_000_000 });
    expect(acoes.up.map((r) => r.ticker)).toEqual(["FFFF11", "AAAA3", "EEEE11"]);
    expect(acoes.down.map((r) => r.ticker)).toEqual(["DDDD4"]);
    const fiis = pickMovers(rows, { minTurnover: 2_000_000, nameMatch: /IMOBILI/i });
    expect(fiis.up.map((r) => r.ticker)).toEqual(["EEEE11"]);
    expect(fiis.mildUp).toBeUndefined();
  });

  it("pickMovers: dia só de queda mostra as que menos caíram no lugar das altas", () => {
    const rows = [
      { stock: "AAAA11", name: "FII A", close: 10, change: -1, volume: 1_000_000 },
      { stock: "BBBB11", name: "FII B", close: 10, change: -5, volume: 1_000_000 },
      { stock: "CCCC11", name: "FII C", close: 10, change: -3, volume: 1_000_000 },
    ];
    const r = pickMovers(rows, { minTurnover: 1, top: 2 });
    expect(r.up).toEqual([]);
    expect(r.mildUp.map((x) => x.ticker)).toEqual(["AAAA11", "CCCC11"]);
    expect(r.down.map((x) => x.ticker)).toEqual(["BBBB11", "CCCC11"]);
    expect(r.mildDown).toBeUndefined();
  });

  it("parseTesouro: só os títulos tradicionais, com tipo e taxa", () => {
    const json = { TesouroLegado: [
      { treasuryBondName: "Tesouro Selic 2031", investmentProfitabilityIndexerName: "SELIC + 0,1057%", segmentCode: 1, maturityDate: "2031-03-01T00:00", investmentBondMinimumValue: 201.3 },
      { treasuryBondName: "Tesouro Prefixado 2029", investmentProfitabilityIndexerName: "15,30%", segmentCode: 1, maturityDate: "2029-01-01T00:00", investmentBondMinimumValue: 7.37 },
      { treasuryBondName: "Tesouro IPCA+ 2032", investmentProfitabilityIndexerName: "IPCA + 8,02%", segmentCode: 1, maturityDate: "2032-08-15T00:00", investmentBondMinimumValue: 30.63 },
      { treasuryBondName: "Tesouro Renda+ 2030", investmentProfitabilityIndexerName: "IPCA + 7,71%", segmentCode: 2 },
      { treasuryBondName: "Sem taxa", investmentProfitabilityIndexerName: "", segmentCode: 1 },
    ] };
    expect(parseTesouro(json)).toEqual([
      { nome: "Tesouro Selic 2031", tipo: "selic", taxa: 0.1057, vencimento: "2031-03-01", minimo: 201.3 },
      { nome: "Tesouro Prefixado 2029", tipo: "pre", taxa: 15.3, vencimento: "2029-01-01", minimo: 7.37 },
      { nome: "Tesouro IPCA+ 2032", tipo: "ipca", taxa: 8.02, vencimento: "2032-08-15", minimo: 30.63 },
    ]);
    expect(parseTesouro(null)).toEqual([]);
  });

  it("parseBcbLast lê o último valor da série", () => {
    expect(parseBcbLast([{ data: "01/01/2026", valor: "13.5" }, { data: "04/11/2026", valor: "13.75" }])).toBe(13.75);
    expect(parseBcbLast([])).toBeNull();
  });

  it("indexStats: valor, dia, 30 dias e 12 meses", () => {
    const series = [["2025-10-30", 100], ["2026-09-30", 110], ["2026-10-29", 120], ["2026-10-30", 126]];
    const s = indexStats(series);
    expect(s).toMatchObject({ date: "2026-10-30", value: 126 });
    expect(s.day).toBeCloseTo(5, 5);
    expect(s.month).toBeCloseTo(((126 / 110) - 1) * 100, 5);
    expect(s.year).toBeCloseTo(26, 5);
    expect(indexStats([])).toBeNull();
  });

  it("fixedIncomeRanking: ordena pelo líquido e calcula o CDB que empata com a LCI", () => {
    const tesouro = [
      { nome: "Tesouro Selic 2031", tipo: "selic", taxa: 0.1, vencimento: "2031-03-01" },
      { nome: "Tesouro IPCA+ 2032", tipo: "ipca", taxa: 8, vencimento: "2032-08-15" },
      { nome: "Tesouro IPCA+ 2040", tipo: "ipca", taxa: 7.5, vencimento: "2040-08-15" },
      { nome: "Tesouro Prefixado 2029", tipo: "pre", taxa: 15, vencimento: "2029-01-01" },
    ];
    const { rows, breakevenCdb } = fixedIncomeRanking({ cdi: 13.65, selic: 13.75, ipca: 4.5, tesouro });
    const liquids = rows.map((r) => r.liquido);
    expect([...liquids].sort((a, b) => b - a)).toEqual(liquids);
    expect(rows.find((r) => r.key === "tesouro-ipca").nome).toBe("Tesouro IPCA+ 2032"); // a de maior taxa
    expect(rows.find((r) => r.key === "tesouro-selic").bruto).toBeCloseTo(13.85, 5);
    expect(rows.find((r) => r.key === "lci-90")).toMatchObject({ ir: 0 });
    expect(rows.find((r) => r.key === "lci-90").liquido).toBeCloseTo(13.65 * 0.9, 5);
    expect(rows.find((r) => r.key === "cdb-100").liquido).toBeCloseTo(13.65 * 0.825, 5);
    expect(rows.at(-1).key).toBe("poupanca");
    expect(breakevenCdb).toBe(109.1);
  });
});

describe("indexStats com cotação ao vivo", () => {
  const series = [["2025-11-03", 100000], ["2026-10-03", 180000], ["2026-10-29", 169186], ["2026-10-30", 167921.8]];

  it("valor e dia vêm da cotação de agora; 30 dias e 12 meses, do histórico", () => {
    const s = indexStats(series, { price: 165336.16, prev: 167921.8, time: "2026-11-03T17:54:00.000Z" });
    expect(s).toMatchObject({ date: "2026-11-03", value: 165336.16, live: true });
    expect(s.day).toBeCloseTo(-1.54, 2);
    expect(s.month).toBeCloseTo(((165336.16 / 180000) - 1) * 100, 5);
    expect(s.year).toBeCloseTo(65.34, 1);
  });

  it("sem cotação ao vivo, usa o último fechamento (como antes)", () => {
    const s = indexStats(series);
    expect(s).toMatchObject({ date: "2026-10-30", value: 167921.8, live: false });
  });

  it("só com a cotação ao vivo (histórico indisponível), mostra valor e dia", () => {
    const s = indexStats(undefined, { price: 3549, prev: 3646.62, time: "2026-11-03T17:54:00.000Z" });
    expect(s.value).toBe(3549);
    expect(s.day).toBeCloseTo(-2.68, 2);
    expect(s.month).toBeNull();
  });

  it("ignora cotação inválida", () => {
    expect(indexStats(series, { price: 0, prev: 1, time: "x" }).live).toBe(false);
    expect(indexStats(undefined, { price: 0, prev: 0 })).toBeNull();
  });
});

describe("Análise: Fundamentus", () => {
  const cell = (v) => `<td>${v}</td>`;
  const fiiRow = (t, seg, dy, pvp) => `<tr>${[t, seg, "10,00", "0,00", dy, pvp, "1.000", "2.000.000", "5", "0", "0", "0,00%", "-"].map(cell).join("")}</tr>`;
  const html = `<table><tr><th>Papel</th></tr>${fiiRow("AAAA11", "Papel", "12,5%", "0,95")}${fiiRow("BBBB11", "Logística", "8,0%", "1,10")}${fiiRow("CCCC11", "Papel", "-", "0,80")}<tr><td>Total</td></tr></table>`;
  const rows = parseFundamentusTable(html, FUNDAMENTUS_FII_COLUMNS);

  it("brNumber lê formato pt-BR", () => {
    expect(brNumber("1.234,56")).toBe(1234.56);
    expect(brNumber("12,5%")).toBe(12.5);
    expect(brNumber("-")).toBeNull();
    expect(brNumber("")).toBeNull();
  });

  it("parseFundamentusTable ignora cabeçalho e rodapé", () => {
    expect(rows.map((r) => r.ticker)).toEqual(["AAAA11", "BBBB11", "CCCC11"]);
    expect(rows[0]).toMatchObject({ segmento: "Papel", dy: 12.5, pvp: 0.95, liquidez: 2000000 });
    expect(rows[2].dy).toBeNull();
    expect(rows[0].vacancia).toBeNull();
  });

  it("applyScreen filtra, busca e manda sem valor para o fim", () => {
    expect(applyScreen(rows, { segmento: "Papel" }).map((r) => r.ticker)).toEqual(["AAAA11", "CCCC11"]);
    expect(applyScreen(rows, { search: " bbb" }).map((r) => r.ticker)).toEqual(["BBBB11"]);
    expect(applyScreen(rows, { min: { dy: 10 } }).map((r) => r.ticker)).toEqual(["AAAA11"]); // sem DY fica de fora
    expect(applyScreen(rows, { max: { pvp: 1 }, min: { dy: null } }).map((r) => r.ticker)).toEqual(["AAAA11", "CCCC11"]);
    expect(applyScreen(rows, { sort: { key: "dy", dir: "desc" } }).map((r) => r.ticker)).toEqual(["AAAA11", "BBBB11", "CCCC11"]);
    expect(applyScreen(rows, { sort: { key: "dy", dir: "asc" } }).map((r) => r.ticker)).toEqual(["BBBB11", "AAAA11", "CCCC11"]);
  });
});

describe("Ficha do ativo", () => {
  it("dividendSummary soma só o que foi pago nos últimos 12 meses", () => {
    const divs = [
      { rate: 0.1, paymentDate: "2026-10-15" },
      { rate: 0.1, paymentDate: "2025-12-15" },
      { rate: 0.1, paymentDate: "2025-10-01" }, // fora da janela
      { rate: 0.1, paymentDate: "2026-12-15" }, // ainda não pago
    ];
    const s = dividendSummary(divs, 10, "2026-11-03");
    expect(s.total).toBeCloseTo(0.2);
    expect(s.count).toBe(2);
    expect(s.yieldPct).toBeCloseTo(2);
    expect(dividendSummary([], 0, "2026-11-03").yieldPct).toBeNull();
  });

  it("priceStats calcula variações e distância da máxima", () => {
    const s = priceStats([["2025-11-03", 10], ["2026-06-01", 20], ["2026-11-02", 16], ["2026-11-03", 18]]);
    expect(s).toMatchObject({ last: 18, high: 20, low: 10 });
    expect(s.day).toBeCloseTo(12.5);
    expect(s.year).toBeCloseTo(80);
    expect(s.fromHigh).toBeCloseTo(-10);
    expect(priceStats([["2026-11-03", 1]])).toBeNull();
  });
});

describe("Indicadores da carteira", () => {
  const inv = (ticker, category, quantity, currentPrice) => ({ ticker, category, quantity, avgPrice: currentPrice, currentPrice });
  const fundamentals = {
    fiis: [{ ticker: "AAAA11", dy: 10, pvp: 1, vacancia: null }, { ticker: "BBBB11", dy: 20, pvp: 0.5, vacancia: 5 }],
    acoes: [{ ticker: "CCCC3", dy: 6, pl: 10, pvp: 2, roe: 20 }],
  };

  it("pondera pelo valor, ignora vendidos e outras categorias e lista quem não achou", () => {
    const r = portfolioIndicators(
      [inv("AAAA11", "FIIs", 100, 10), inv("BBBB11", "FIIs", 100, 30), inv("CCCC3", "Ações", 10, 10), inv("ZZZZ11", "FIIs", 1, 10), inv("DDDD11", "FIIs", 0, 10), inv("BTC", "Criptomoedas", 1, 99)],
      fundamentals
    );
    expect(r.missing).toEqual(["ZZZZ11"]);
    expect(r.rows.map((x) => x.ticker)).toEqual(["BBBB11", "AAAA11", "CCCC3"]);
    expect(r.rows[0].weight).toBeCloseTo((3000 / 4110) * 100); // peso sobre todas as posições B3, inclusive a sem dados
    expect(r.avg.fiis.dy).toBeCloseTo((10 * 1000 + 20 * 3000) / 4000); // 17,5
    expect(r.avg.fiis.pvp).toBeCloseTo(4000 / (1000 / 1 + 3000 / 0.5)); // harmônica
    expect(r.avg.fiis.vacancia).toBe(5); // só quem tem o dado
    expect(r.avg.acoes).toMatchObject({ dy: 6, pl: 10, roe: 20 });
  });

  it("sem posições ou sem dados devolve médias nulas", () => {
    expect(portfolioIndicators([], fundamentals).avg.fiis.dy).toBeNull();
    expect(portfolioIndicators([inv("AAAA11", "FIIs", 1, 10)], null).missing).toEqual(["AAAA11"]);
  });
});

describe("ETFs", () => {
  it("etfClass separa as classes pelo nome", () => {
    const cases = {
      "ISHARES IBOVESPA CLASSE DE ÍNDICE": "Ações Brasil",
      "BB ETF ÍNDICE FUTURO DE DOLAR S&P/B3 FUNDO DE ÍNDICE": "Dólar",
      "TREND ETF LBMA OURO CLASSE DE ÍNDICE INVESTIMENTO NO EXTERIOR": "Ouro",
      "HASHDEX NASDAQ CME CRYPTO INDEX FUNDO DE ÍNDICE": "Cripto",
      "IT NOW S&P500 TRN FUNDO DE ÍNDICE": "Exterior",
      "INVESTO ETF MARKETVECTOR BRAZIL TREASURY 760 DAY TARGET DURATION": "Renda fixa",
    };
    for (const [name, expected] of Object.entries(cases)) expect(etfClass(name)).toBe(expected);
  });

  it("etfLabel tira o sufixo jurídico", () => {
    expect(etfLabel("ISHARES IBOVESPA CLASSE DE ÍNDICE - RESPONSABILIDADE LIMITADA")).toBe("ISHARES IBOVESPA");
    expect(etfLabel("IT NOW IDIV FUNDO DE ÍNDICE RESPONSABILIDADE LIMITADA")).toBe("IT NOW IDIV");
  });

  it("etfStats calcula retorno, volatilidade e maior queda", () => {
    const rising = Array.from({ length: 250 }, (_, i) => [`d${i}`, 100 + i]);
    const s = etfStats(rising);
    expect(s.r1m).toBeCloseTo((349 / 328 - 1) * 100);
    expect(s.r12m).toBeCloseTo(249);
    expect(s.drawdown).toBe(0);
    expect(s.vol).toBeGreaterThan(0);
    const dip = etfStats([["a", 100], ["b", 50], ["c", 75]]);
    expect(dip.drawdown).toBe(-50);
    expect(dip).toMatchObject({ r1m: null, r12m: null, vol: null });
    expect(etfStats([]).drawdown).toBeNull();
  });

  it("pickEtfs só pega ETFs líquidos, por giro", () => {
    const rows = [
      { stock: "BOVA11", name: "ISHARES IBOVESPA CLASSE DE ÍNDICE", close: 100, volume: 10000, subType: "etf" },
      { stock: "MXRF11", name: "MAXI RENDA FII", close: 10, volume: 999999, subType: "fii" },
      { stock: "SMAL11", name: "ISHARES SMALL", close: 100, volume: 5, subType: "etf" },
      { stock: "IVVB11", name: "ISHARES S&P 500", close: 300, volume: 20000, subType: "etf" },
    ];
    expect(pickEtfs(rows).map((r) => r.ticker)).toEqual(["IVVB11", "BOVA11"]);
  });
});

describe("Indicadores da carteira com ETFs", () => {
  it("ETF cadastrado como ação entra pela lista de ETFs", () => {
    const own = [{ ticker: "BOVA11", category: "Ações", quantity: 10, avgPrice: 100, currentPrice: 100 }];
    const etfs = [{ ticker: "BOVA11", nome: "ISHARES IBOVESPA", r12m: 10, vol: 25 }];
    const without = portfolioIndicators(own, { fiis: [], acoes: [] });
    expect(without.missing).toEqual(["BOVA11"]);
    const r = portfolioIndicators(own, { fiis: [], acoes: [] }, etfs);
    expect(r.missing).toEqual([]);
    expect(r.rows[0]).toMatchObject({ ticker: "BOVA11", kind: "etfs", weight: 100 });
    expect(r.avg.etfs).toEqual({ r12m: 10, vol: 25 });
  });
});

describe("Alertas dos favoritos", () => {
  const fundamentals = { fiis: [{ ticker: "AAAA11", preco: 10, pvp: 0.85, dy: 9 }], acoes: [{ ticker: "CCCC3", preco: 20, pl: 12 }] };
  const watch = (ticker, kind, alerts) => ({ ticker, kind, alerts });

  it("alertLabel descreve o alerta", () => {
    expect(alertLabel("fiis", { metric: "pvp", op: "lt", value: 0.9 })).toBe("P/VP abaixo de 0,9");
    expect(alertLabel("fiis", { metric: "dy", op: "gt", value: 12 })).toBe("DY acima de 12%");
    expect(alertLabel("acoes", { metric: "preco", op: "lt", value: 10 })).toContain("R$");
  });

  it("avisa uma vez quando a condição passa a valer, e rearma quando deixa de valer", () => {
    const items = [watch("AAAA11", "fiis", [{ metric: "pvp", op: "lt", value: 0.9, on: false }, { metric: "dy", op: "gt", value: 12, on: false }])];
    const first = evaluateAlerts(items, fundamentals);
    expect(first.notifications).toHaveLength(1);
    expect(first.notifications[0].body).toContain("P/VP abaixo de");
    expect(first.updates[0].alerts.map((a) => a.on)).toEqual([true, false]);

    const again = evaluateAlerts([watch("AAAA11", "fiis", first.updates[0].alerts)], fundamentals);
    expect(again.notifications).toEqual([]); // já avisou
    expect(again.updates).toEqual([]);

    const rearmed = evaluateAlerts([watch("AAAA11", "fiis", first.updates[0].alerts)], { fiis: [{ ticker: "AAAA11", pvp: 0.95 }] });
    expect(rearmed.notifications).toEqual([]);
    expect(rearmed.updates[0].alerts[0].on).toBe(false);
  });

  it("ignora ativo sem dados, sem alertas ou indicador vazio", () => {
    const r = evaluateAlerts([watch("ZZZZ11", "fiis", [{ metric: "pvp", op: "lt", value: 1 }]), watch("CCCC3", "acoes", []), watch("CCCC3", "acoes", [{ metric: "pl", op: "gt", value: 5 }, { metric: "preco", op: "lt", value: 30 }]), watch("AAAA11", "fiis", [{ metric: "vacancia", op: "lt", value: 5 }])], fundamentals);
    expect(r.notifications.map((n) => n.ticker)).toEqual(["CCCC3", "CCCC3"]);
  });
});

describe("Comparar ativos", () => {
  it("compareSeries coloca todos na base 100 e alinha as datas", () => {
    const r = compareSeries([
      { ticker: "A", closes: [["2026-01-01", 10], ["2026-01-02", 12], ["2026-01-03", 9]] },
      { ticker: "B", closes: [["2026-01-02", 50], ["2026-01-03", 100]] },
      { ticker: "C", closes: [] },
    ]);
    expect(r.labels).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(r.lines.map((l) => l.ticker)).toEqual(["A", "B"]);
    expect(r.lines[0].data).toEqual([100, 120, 90]);
    expect(r.lines[1].data).toEqual([null, 100, 200]);
  });

  it("bestIndexes marca o melhor valor só quando há com o que comparar", () => {
    expect(bestIndexes([5, 9, null], "high")).toEqual([1]);
    expect(bestIndexes([5, 9, 5], "low")).toEqual([0, 2]);
    expect(bestIndexes([5, null], "high")).toEqual([]);
    expect(bestIndexes([5, 9], null)).toEqual([]);
  });
});

describe("Alertas de ETF", () => {
  it("alertLabel e evaluateAlerts valem para ETFs", () => {
    expect(alertLabel("etfs", { metric: "r12m", op: "gt", value: 15 })).toBe("Retorno 12m acima de 15%");
    const r = evaluateAlerts([{ ticker: "BOVA11", kind: "etfs", alerts: [{ metric: "vol", op: "gt", value: 20, on: false }] }], { etfs: [{ ticker: "BOVA11", vol: 25 }] });
    expect(r.notifications).toHaveLength(1);
    expect(r.notifications[0].body).toContain("Volatilidade acima de 20%");
  });
});

describe("editar posição preserva o histórico", () => {
  const current = { quantity: 100, avgPrice: 10, purchases: [{ date: "2026-09-01", quantity: 100, price: 10 }] };

  it("aumentar a quantidade registra a diferença como nova compra, mantendo o preço médio informado", () => {
    const purchases = editedInvestmentPurchases(current, { quantity: 150, price: 10.6666667, purchaseDate: "2026-11-04" });
    expect(purchases).toHaveLength(2);
    expect(purchases[0]).toEqual(current.purchases[0]);
    expect(purchases[1]).toMatchObject({ date: "2026-11-04", quantity: 50 });
    expect(purchases[1].price).toBeCloseTo(12, 4);
    const avg = purchases.reduce((s, p) => s + p.quantity * p.price, 0) / purchases.reduce((s, p) => s + p.quantity, 0);
    expect(avg).toBeCloseTo(10.6666667, 4);
  });

  it("diminuir a quantidade ou corrigir só o preço vira compra única, somando o que já foi vendido", () => {
    const withSale = { ...current, quantity: 70, sales: [{ date: "2026-10-01", quantity: 30, price: 11, avgPrice: 10 }] };
    expect(editedInvestmentPurchases(withSale, { quantity: 60, price: 10, purchaseDate: "2026-11-04" })).toEqual([{ date: "2026-11-04", quantity: 90, price: 10 }]);
    expect(editedInvestmentPurchases(current, { quantity: 100, price: 9, purchaseDate: "2026-09-02" })).toEqual([{ date: "2026-09-02", quantity: 100, price: 9 }]);
  });

  it("preço médio que exigiria compra de preço zero ou negativo cai no caso da compra única", () => {
    expect(editedInvestmentPurchases(current, { quantity: 150, price: 6, purchaseDate: "2026-11-04" })).toEqual([{ date: "2026-11-04", quantity: 150, price: 6 }]);
    expect(editedInvestmentPurchases({}, { quantity: 5, price: 2, purchaseDate: "2026-11-04" })).toEqual([{ date: "2026-11-04", quantity: 5, price: 2 }]);
  });
});

describe("IR das vendas e CSV do histórico", () => {
  const sell = (date, category, amount, result) => ({ kind: "sell", date, category, ticker: "X", amount, result });
  it("ações até R$ 20 mil no mês são isentas; acima paga 15% do lucro", () => {
    expect(estimateSalesTax([sell("2026-10-05", "Ações", 15000, 3000)]).total).toBe(0);
    expect(estimateSalesTax([sell("2026-10-05", "Ações", 25000, 3000)]).total).toBe(450);
  });
  it("FIIs pagam 20% sem isenção e prejuízo não gera imposto", () => {
    expect(estimateSalesTax([sell("2026-10-05", "FIIs", 1000, 500), sell("2026-10-09", "FIIs", 1000, -100)]).total).toBe(80);
    expect(estimateSalesTax([sell("2026-10-05", "FIIs", 1000, -100)]).total).toBe(0);
  });
  it("CSV do histórico usa ; e vírgula decimal", () => {
    const csv = historyToCsv([{ kind: "buy", date: "2026-10-28", ticker: "MXRF11", category: "FIIs", quantity: 10, price: 9.5, amount: 95 }]);
    expect(csv).toContain("Data;Tipo;Ativo");
    expect(csv).toContain("28/10/2026;Compra;MXRF11;FIIs;10;9,50;95,00;");
  });
});

describe("importação de negociações da B3", () => {
  const csv = [
    "Data do Negócio;Tipo de Movimentação;Mercado;Prazo/Vencimento;Instituição;Código de Negociação;Quantidade;Preço;Valor",
    "28/10/2025;Compra;Mercado à Vista;-;XP;MXRF11F;10;9,50;95,00",
    "29/10/2025;Compra;Mercado à Vista;-;XP;MXRF11;10;10,50;105,00",
    "30/10/2025;Venda;Mercado à Vista;-;XP;MXRF11;5;11,00;55,00",
    "30/10/2025;Compra;Mercado à Vista;-;XP;TESOURO SELIC;1;100,00;100,00",
  ].join("\n");

  it("lê compras e vendas, tira o F do fracionário e ignora o que não é ação/FII", () => {
    const { trades, skipped } = parseB3Trades(csv);
    expect(trades.map((t) => [t.ticker, t.side, t.quantity, t.price])).toEqual([
      ["MXRF11", "buy", 10, 9.5],
      ["MXRF11", "buy", 10, 10.5],
      ["MXRF11", "sell", 5, 11],
    ]);
    expect(skipped).toBe(1);
  });
  it("monta a posição com preço médio e vendas; importar de novo não duplica", () => {
    const { changes, added } = planB3Import(parseB3Trades(csv).trades, []);
    expect(added).toBe(3);
    expect(changes[0].data).toMatchObject({ ticker: "MXRF11", category: "FIIs", quantity: 15, avgPrice: 10 });
    expect(changes[0].data.purchases).toHaveLength(2);
    const again = planB3Import(parseB3Trades(csv).trades, [{ id: "a", ticker: "MXRF11", ...changes[0].data }]);
    expect(again.added).toBe(0);
    expect(again.duplicates).toBe(3);
  });
});

describe("evolução do patrimônio", () => {
  it("soma o saldo das transações e o investido a custo até o fim de cada mês", () => {
    const tx = [
      { date: "2026-09-10", type: "income", amount: 1000 },
      { date: "2026-10-05", type: "expense", amount: 300 },
    ];
    const inv = [{ purchases: [{ date: "2026-10-28", quantity: 10, price: 10 }], sales: [{ date: "2026-11-02", quantity: 4, price: 12, avgPrice: 10 }] }];
    const s = netWorthSeries(tx, inv, 3, new Date(2026, 10, 15));
    expect(s.map((p) => [p.key, p.cash, p.invested, p.total])).toEqual([
      ["2026-09", 1000, 0, 1000],
      ["2026-10", 700, 100, 800],
      ["2026-11", 700, 60, 760],
    ]);
  });
});
