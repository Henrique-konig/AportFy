import { describe, it, expect } from "vitest";
import {
  calcInvestmentMetrics,
  mergeInvestmentPurchase,
  pctChange,
  buildMonthlySeries,
  calcBudgetSpent,
  recurrenceDateForMonth,
  dividendDedupeKey,
} from "../js/calc.js";

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
