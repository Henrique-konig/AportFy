import { describe, it, expect } from "vitest";
import {
  calcInvestmentMetrics,
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
