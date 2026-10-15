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
} from "../js/calc.js";

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
    const items = buildUpcomingDividends(investments, calendars, "2026-10-15");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ ticker: "MXRF11", shares: 100, total: 10, paymentDate: "2026-10-15" });
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
