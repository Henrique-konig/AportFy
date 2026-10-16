// @vitest-environment jsdom
//
// Testes de tela: carregam o index.html real em um DOM simulado (jsdom) e exercitam o
// ui.js como o app faz — filtros, modais, abas e totais. Pegam regressões como filtros
// "mortos", proventos duplicados ou ids que sumiram do HTML.
import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// O Node 26 tem um localStorage global experimental (indefinido sem --localstorage-file)
// que esconde o do jsdom; usa um armazenamento em memória nos testes.
if (!globalThis.localStorage) {
  const store = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const html = readFileSync("index.html", "utf8");
// Código de toda a interface (fachada + módulos em js/ui/).
const uiSource = ["js/ui.js", ...readdirSync("js/ui").map((f) => `js/ui/${f}`)].map((f) => readFileSync(f, "utf8")).join("\n");

let ui;
const accountHandlers = { onResend: vi.fn(async () => {}), onCheck: vi.fn(async () => {}), onDelete: vi.fn() };
const $ = (id) => document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\s+/g, " ").trim();
const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
const setValue = (id, value, type = "input") => {
  $(id).value = value;
  fire($(id), type);
};
const goTo = (view) => document.querySelector(`.nav-item[data-view="${view}"]`).click();

// Gráficos falsos: guardam os dados para conferir sem precisar de canvas de verdade.
class FakeChart {
  constructor() {
    this.data = { labels: [], datasets: [] };
  }
  update() {}
}

const inv = (id, ticker, category, quantity, avgPrice, currentPrice, purchaseDate, extra = {}) => ({
  id,
  ticker,
  category,
  quantity,
  avgPrice,
  currentPrice,
  purchaseDate,
  purchases: [{ date: purchaseDate, quantity, price: avgPrice }],
  ...extra,
});

const portfolio = () => [
  inv("1", "TVRI11", "FIIs", 85, 95, 98, "2026-03-10"),
  inv("2", "PETR4", "Ações", 20, 30, 36, "2026-05-02"),
  inv("3", "MXRF11", "FIIs", 22, 9.4, 9.5, "2026-10-02"),
  inv("4", "BTC", "Criptomoedas", 1, 300, 500, "2026-07-01"),
];

beforeAll(async () => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop() {} }) });
  globalThis.Chart = FakeChart;
  globalThis.Chart.getChart = () => null;

  ui = await import("../js/ui.js");
  ui.initCharts?.();
  ui.initReportsCharts?.();
  ui.initInvestmentCharts();
  ui.initDividendsChart();
  ui.initHealthCharts();

  ui.bindDatePickers();
  ui.bindCustomDropdowns();
  ui.bindTransactionFilters();
  ui.bindDashboardFilters();
  ui.bindReportsFilters();
  ui.bindInvestmentFilters();
  ui.bindSellModal();
  ui.bindDividendCalendar();
  ui.bindFinancialIndependence();
  ui.bindAlerts();
  ui.bindTheme();
  ui.bindAccessibility();
  ui.bindOnboarding();
  ui.bindAccountSecurity({ onResend: accountHandlers.onResend, onCheck: accountHandlers.onCheck, onDelete: accountHandlers.onDelete });
  ui.bindHistory();
  ui.bindPortfolioHealth();
  ui.bindSettingsForms();
  ui.onNavChange((view) => ui.setActiveView(view)); // o app.js faz esta ligação no app real
});

beforeEach(() => {
  ui.renderInvestments(portfolio());
  ui.renderDividendsData([]);
  ui.renderUpcomingDividends([], { failed: [], hasEligible: true });
  for (const id of ["inv-search-input", "hist-search-input"]) $(id).value = "";
  for (const id of ["inv-category-filter", "inv-asset-filter", "hist-asset-filter", "hist-month-filter", "div-panel-month-filter"]) {
    $(id).value = "all";
    fire($(id), "change");
  }
});

/* ---------------------------------------------------------------
   Estrutura
--------------------------------------------------------------- */
describe("estrutura da página", () => {
  it("todos os ids que o ui.js busca existem no index.html", () => {
    const ids = [...uiSource.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(200); // garante que o teste está lendo os módulos de verdade
    const missing = [...new Set(ids)].filter((id) => !$(id));
    expect(missing).toEqual([]);
  });

  it("cada item do menu tem a sua tela e o seu título", () => {
    const views = [...document.querySelectorAll(".nav-item[data-view]")].map((b) => b.dataset.view);
    expect(views).toEqual(expect.arrayContaining(["dashboard", "transactions", "investments", "history", "reports", "health", "settings"]));
    for (const view of views) {
      goTo(view);
      expect($(`view-${view}`), `view-${view}`).not.toBeNull();
      expect($(`view-${view}`).classList.contains("hidden")).toBe(false);
      expect(document.querySelectorAll(".view-section:not(.hidden)")).toHaveLength(1);
      expect(text("page-title").length).toBeGreaterThan(0);
    }
  });

  it("selects ocultos pelo dropdown customizado nunca recuperam largura (evita rolagem lateral)", () => {
    const css = readFileSync("css/custom.css", "utf8");
    expect(css).toMatch(/\.sr-only-select\s*{[^}]*width:\s*1px\s*!important/);
  });
});

/* ---------------------------------------------------------------
   Investimentos: filtros valem para tabela, KPIs e aportes
--------------------------------------------------------------- */
describe("filtros de Investimentos", () => {
  const rows = () => [...document.querySelectorAll("#investments-tbody tr")].map((r) => r.querySelector("td p").textContent.trim());

  it("categoria, busca e ordenação mudam a tabela", () => {
    expect(rows().sort()).toEqual(["BTC", "MXRF11", "PETR4", "TVRI11"]);

    setValue("inv-category-filter", "FIIs", "change");
    expect(rows().sort()).toEqual(["MXRF11", "TVRI11"]);

    setValue("inv-search-input", "mxrf");
    expect(rows()).toEqual(["MXRF11"]);

    setValue("inv-search-input", "");
    setValue("inv-category-filter", "all", "change");
    setValue("inv-sort-select", "balance", "change");
    expect(rows()[0]).toBe("TVRI11"); // maior saldo (85 × 98)
  });

  it("o filtro também recalcula KPIs, alocação e aportes (não só a tabela)", () => {
    const totalAll = text("inv-kpi-total");
    const contribAll = text("inv-contrib-total");

    setValue("inv-category-filter", "Ações", "change");
    expect(text("inv-kpi-total")).not.toBe(totalAll);
    expect(text("inv-kpi-total")).toBe("R$ 720,00"); // 20 × 36
    expect(text("inv-contrib-total")).not.toBe(contribAll);
    expect(text("inv-contrib-total")).toBe("R$ 600,00"); // 20 × 30
    expect(text("inv-allocation-legend")).toContain("Ações 100%");
  });

  it("filtro sem resultado zera tudo sem quebrar", () => {
    setValue("inv-category-filter", "Imóveis", "change");
    expect(rows()).toEqual([]);
    expect(text("inv-kpi-total")).toBe("R$ 0,00");
    expect($("investments-empty").classList.contains("hidden")).toBe(false);
  });
});

/* ---------------------------------------------------------------
   Vendas
--------------------------------------------------------------- */
describe("registrar venda", () => {
  const openSell = (id) => document.querySelector(`.sell-investment-btn[data-id="${id}"]`).click();

  it("mostra a posição, calcula lucro/prejuízo e envia os dados", () => {
    const handler = vi.fn();
    ui.onSellSubmit(handler);

    openSell("1");
    expect($("sell-modal").classList.contains("hidden")).toBe(false);
    expect(text("sell-ticker")).toBe("TVRI11");
    expect(text("sell-position")).toContain("85");

    setValue("sell-quantity", "30");
    setValue("sell-price", "100");
    expect(text("sell-total")).toBe("R$ 3.000,00");
    expect(text("sell-result-label")).toBe("Lucro estimado");
    expect(text("sell-result")).toBe("R$ 150,00");

    setValue("sell-price", "90");
    expect(text("sell-result-label")).toBe("Prejuízo estimado");

    $("sell-date").value = "2026-10-10";
    fire($("sell-form"), "submit");
    expect(handler).toHaveBeenCalledWith({ id: "1", quantity: 30, price: 90, date: "2026-10-10" });
  });

  it("não deixa vender mais do que tem e oferece 'vender tudo'", () => {
    const handler = vi.fn();
    ui.onSellSubmit(handler);

    openSell("2");
    setValue("sell-quantity", "999");
    setValue("sell-price", "36");
    $("sell-date").value = "2026-10-10";
    fire($("sell-form"), "submit");
    expect(handler).not.toHaveBeenCalled();

    $("sell-all-btn").click();
    expect($("sell-quantity").value).toBe("20");
    fire($("sell-form"), "submit");
    expect(handler).toHaveBeenCalledWith({ id: "2", quantity: 20, price: 36, date: "2026-10-10" });
    ui.closeSellModal();
  });

  it("posição vendida por completo sai da carteira, mas segue no histórico e nos aportes", () => {
    const contribBefore = text("inv-contrib-total");
    const sold = { quantity: 0, sales: [{ date: "2026-10-12", quantity: 20, price: 36, avgPrice: 30 }] };
    ui.renderInvestments(portfolio().map((i) => (i.id === "2" ? { ...i, ...sold } : i)));

    const rows = [...document.querySelectorAll("#investments-tbody tr")].map((r) => r.querySelector("td p").textContent.trim());
    expect(rows).not.toContain("PETR4");
    expect(text("inv-contrib-total")).toBe(contribBefore); // a compra de PETR4 continua contando como aporte
    goTo("history");
    expect(text("hist-list")).toContain("Venda · PETR4");
    expect(text("hist-total-result")).toBe("R$ 120,00");
  });
});

/* ---------------------------------------------------------------
   Proventos: recebidos x a receber
--------------------------------------------------------------- */
describe("painel de proventos", () => {
  const received = [
    { id: "d1", ticker: "MXRF11", type: "Rendimento", amount: 2.2, date: "2026-10-15", rate: 0.1, shares: 22, exDate: "2026-09-30" },
    { id: "d2", ticker: "TVRI11", type: "Rendimento", amount: 89.25, date: "2026-09-15" },
  ];
  const upcoming = [
    { ticker: "VGIR11", type: "Rendimento", rate: 0.13, exDate: "2026-10-13", paymentDate: "2026-10-20", shares: 50, total: 6.5 },
    // já lançado como recebido: nunca pode aparecer também como "a receber"
    { ticker: "MXRF11", type: "Rendimento", rate: 0.1, exDate: "2026-09-30", paymentDate: "2026-10-15", shares: 22, total: 2.2 },
  ];
  const panelRows = () => [...document.querySelectorAll("#div-upcoming-tbody tr")].map((r) => `${r.children[0].textContent.trim()}|${r.children[7].textContent.trim()}`);

  beforeEach(() => {
    ui.renderDividendsData(received);
    ui.renderUpcomingDividends(upcoming, { failed: [], hasEligible: true });
  });

  it("não duplica um provento que já foi lançado como recebido", () => {
    expect(panelRows().sort()).toEqual(["MXRF11|Recebido", "TVRI11|Recebido", "VGIR11|A receber"]);
    expect(text("div-upcoming-total")).toBe("R$ 6,50");
    expect(text("div-panel-received-total")).toBe("R$ 91,45");
  });

  it("abas e filtro de mês", () => {
    document.querySelector('[data-div-tab="upcoming"]').click();
    expect(panelRows()).toEqual(["VGIR11|A receber"]);
    document.querySelector('[data-div-tab="received"]').click();
    expect(panelRows()).toHaveLength(2);

    document.querySelector('[data-div-tab="all"]').click();
    setValue("div-panel-month-filter", "2026-09", "change");
    expect(panelRows()).toEqual(["TVRI11|Recebido"]);
    expect(text("div-panel-received-total")).toBe("R$ 89,25");
  });

  it("filtro de ativo da aba vale para o painel", () => {
    setValue("inv-asset-filter", "MXRF11", "change");
    expect(panelRows()).toEqual(["MXRF11|Recebido"]);
  });

  it("mostra aviso quando algum ativo não respondeu", () => {
    ui.renderUpcomingDividends([], { failed: ["ISAE4"], hasEligible: true });
    expect(text("div-upcoming-status")).toContain("ISAE4");
  });
});

/* ---------------------------------------------------------------
   Histórico
--------------------------------------------------------------- */
describe("aba Histórico", () => {
  beforeEach(() => {
    const withSale = portfolio().map((i) => (i.id === "1" ? { ...i, quantity: 55, sales: [{ date: "2026-10-10", quantity: 30, price: 100, avgPrice: 95 }] } : i));
    ui.renderInvestments(withSale);
    ui.renderDividendsData([
      { id: "d1", ticker: "TVRI11", type: "Rendimento", amount: 89.25, date: "2026-10-15", rate: 1.05, shares: 85 },
      { id: "d2", ticker: "PETR4", type: "JCP", amount: 12.5, date: "2026-08-20" },
    ]);
  });

  const items = () => [...document.querySelectorAll("#hist-list .animate-fade-in")].map((r) => r.textContent.replace(/\s+/g, " ").trim());

  it("junta compras, vendas e proventos do mais recente para o mais antigo, agrupados por mês", () => {
    const list = items();
    expect(list[0]).toContain("Provento · TVRI11");
    expect(list[1]).toContain("Venda · TVRI11");
    expect(list[1]).toContain("Lucro de R$ 150,00");
    expect(list.some((l) => l.includes("Compra · MXRF11"))).toBe(true);
    const months = [...document.querySelectorAll("#hist-list p.uppercase")].map((p) => p.textContent).filter((t) => t.includes("de 20"));
    expect(months[0]).toBe("outubro de 2026");
  });

  it("totais e filtros por tipo, ativo e busca", () => {
    expect(text("hist-total-sell")).toBe("R$ 3.000,00");
    expect(text("hist-total-result")).toBe("R$ 150,00");
    expect(text("hist-total-dividend")).toBe("R$ 101,75");

    document.querySelector('[data-hist-kind="sell"]').click();
    expect(items()).toHaveLength(1);

    document.querySelector('[data-hist-kind="all"]').click();
    setValue("hist-asset-filter", "PETR4", "change");
    expect(items().every((l) => l.includes("PETR4"))).toBe(true);

    setValue("hist-asset-filter", "all", "change");
    setValue("hist-search-input", "btc");
    expect(items()).toHaveLength(1);
  });

  it("mostra estado vazio quando o filtro não encontra nada", () => {
    setValue("hist-search-input", "ZZZZ");
    expect($("hist-empty").classList.contains("hidden")).toBe(false);
  });
});

/* ---------------------------------------------------------------
   Dashboard, Transações e Relatórios
--------------------------------------------------------------- */
describe("filtros de período", () => {
  const transactions = [
    { id: "1", date: "2026-09-05", type: "income", amount: 1000, category: "Salário", description: "a" },
    { id: "2", date: "2026-09-10", type: "expense", amount: 300, category: "Alimentação", description: "b" },
    { id: "3", date: "2026-08-05", type: "income", amount: 800, category: "Salário", description: "c" },
    { id: "4", date: "2026-08-10", type: "expense", amount: 200, category: "Transporte", description: "d" },
  ];

  it("Dashboard: o mês escolhido define receitas, despesas e saldo; 'Todos os meses' acumula", () => {
    ui.updateKPIs(transactions, []);
    setValue("dashboard-period-filter", "2026-09", "change");
    expect(text("kpi-income")).toBe("R$ 1.000,00");
    expect(text("kpi-expense")).toBe("R$ 300,00");
    expect(text("kpi-balance")).toBe("R$ 700,00");
    expect(text("kpi-balance-label")).toBe("Saldo do Mês");

    setValue("dashboard-period-filter", "2026-08", "change");
    expect(text("kpi-balance")).toBe("R$ 600,00");

    setValue("dashboard-period-filter", "all", "change");
    expect(text("kpi-income")).toBe("R$ 1.800,00");
    expect(text("kpi-expense")).toBe("R$ 500,00");
    expect(text("kpi-balance-label")).toBe("Saldo Atual");
    expect($("kpi-income-change-row").classList.contains("hidden")).toBe(true);
  });

  it("Transações: o filtro de mês limita a lista e mostra o total gasto", () => {
    ui.renderFullTransactionsTable(transactions);
    expect(text("txn-full-count")).toBe("4 registros");
    setValue("txn-month-filter", "2026-09", "change");
    expect(text("txn-full-count")).toBe("2 registros");
    expect(text("txn-full-total")).toBe("Gasto: R$ 300,00");
  });

  it("Relatórios: totais seguem o período escolhido", () => {
    ui.renderReports(transactions);
    setValue("reports-period-filter", "2026-08", "change");
    expect(text("report-total-income")).toBe("R$ 800,00");
    expect(text("report-total-expense")).toBe("R$ 200,00");
    expect(text("report-net")).toBe("R$ 600,00");
    setValue("reports-period-filter", "all", "change");
    expect(text("report-total-income")).toBe("R$ 1.800,00");
  });
});

/* ---------------------------------------------------------------
   Saúde da Carteira
--------------------------------------------------------------- */
describe("aba Saúde da Carteira", () => {
  it("calcula a nota e mostra os alertas da carteira", () => {
    goTo("health");
    expect($("health-content").classList.contains("hidden")).toBe(false);
    expect(Number(text("health-score"))).toBeGreaterThan(0);
    expect(text("health-alerts")).toMatch(/Excesso em FIIs|representa/);
    expect(text("health-components")).toContain("Concentração por ativo");
  });

  it("sem investimentos, mostra o estado vazio", () => {
    ui.renderInvestments([]);
    expect($("health-empty").classList.contains("hidden")).toBe(false);
    expect($("health-content").classList.contains("hidden")).toBe(true);
  });

  it("modal de metas: exige soma 100% e vira 'Personalizado' ao editar", () => {
    const handler = vi.fn();
    ui.onPortfolioSettingsSubmit(handler);
    ui.renderInvestments(portfolio());

    ui.openPortfolioSettingsModal();
    setValue("health-preset", "arrojado", "change");
    expect(text("health-target-sum")).toBe("Total: 100%");

    const first = document.querySelector("#health-targets-grid input");
    first.value = Number(first.value) + 7;
    fire(first, "input");
    expect($("health-preset").value).toBe("personalizado");
    expect(text("health-target-sum")).toContain("precisa somar 100%");

    fire($("health-settings-form"), "submit");
    expect(handler).not.toHaveBeenCalled();

    first.value = Number(first.value) - 7;
    fire(first, "input");
    fire($("health-settings-form"), "submit");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(Object.values(handler.mock.calls[0][0].targets).reduce((a, b) => a + b, 0)).toBe(100);
    ui.closePortfolioSettingsModal();
  });

  it("projeção e sugestão de aporte reagem aos campos", () => {
    ui.renderInvestments(portfolio());
    setValue("health-contribution-input", "1000");
    const cards = document.querySelectorAll("#health-suggestion > div");
    expect(cards.length).toBeGreaterThan(0);

    setValue("proj-contribution", "0");
    setValue("proj-appreciation", "0");
    setValue("proj-yield", "0");
    setValue("proj-years", "5", "change");
    expect(text("proj-final")).toBe(text("proj-contributed")); // sem aporte nem rendimento, nada muda
  });
});

/* ---------------------------------------------------------------
   Convite ao espaço de casal
--------------------------------------------------------------- */
describe("convite ao espaço de casal", () => {
  it("o dono vê os pedidos e decide; quem pediu vê o status pendente", () => {
    const decide = vi.fn();
    const cancel = vi.fn();
    ui.onJoinRequestDecision(decide);
    ui.onCancelJoinRequest(cancel);

    expect($("settings-join-requests").classList.contains("hidden")).toBe(true);
    ui.renderJoinRequests([{ id: "uid1", displayName: "Maria", email: "maria@x.com" }]);
    expect($("settings-join-requests").classList.contains("hidden")).toBe(false);
    expect(text("settings-join-requests-list")).toContain("maria@x.com");

    document.querySelector('[data-join-decision="approve"]').click();
    expect(decide).toHaveBeenCalledWith("uid1", "approve");
    document.querySelector('[data-join-decision="reject"]').click();
    expect(decide).toHaveBeenCalledWith("uid1", "reject");

    ui.renderJoinRequests([]);
    expect($("settings-join-requests").classList.contains("hidden")).toBe(true);

    ui.renderJoinStatus({ coupleId: "abcdefghijklmnopqrstuvwxyz12" });
    expect($("settings-join-status").classList.contains("hidden")).toBe(false);
    document.querySelector("[data-join-cancel]").click();
    expect(cancel).toHaveBeenCalled();
    ui.renderJoinStatus(null);
    expect($("settings-join-status").classList.contains("hidden")).toBe(true);
  });

  it("o formulário de entrada envia só o código preenchido", () => {
    const join = vi.fn();
    ui.onJoinCouple(join);
    setValue("settings-join-input", "   ");
    fire($("settings-join-form"), "submit");
    expect(join).not.toHaveBeenCalled();
    setValue("settings-join-input", " abcdefghijklmnopqrstuvwxyz12 ");
    fire($("settings-join-form"), "submit");
    expect(join).toHaveBeenCalledWith("abcdefghijklmnopqrstuvwxyz12");
  });
});

/* ---------------------------------------------------------------
   Calendário de proventos e independência financeira
--------------------------------------------------------------- */
describe("calendário de proventos", () => {
  const thisMonth = new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const day = (d) => `${thisMonth}-${String(d).padStart(2, "0")}`;

  beforeEach(() => {
    ui.renderDividendsData([{ id: "d1", ticker: "MXRF11", type: "Rendimento", amount: 22, date: day(15) }]);
    ui.renderUpcomingDividends([{ ticker: "VGIR11", type: "Rendimento", rate: 0.13, exDate: day(13), paymentDate: day(28), shares: 100, total: 13 }], { failed: [], hasEligible: true });
    $("div-cal-today").click(); // volta ao mês atual
  });

  it("mostra os totais do mês e marca os dias com proventos", () => {
    expect(text("div-cal-received")).toBe("R$ 22,00");
    expect(text("div-cal-upcoming")).toBe("R$ 13,00");
    expect(document.querySelector(`[data-cal-date="${day(15)}"]`).getAttribute("aria-label")).toContain("1 provento");
    expect(document.querySelector(`[data-cal-date="${day(28)}"]`).getAttribute("aria-label")).toContain("a receber");
  });

  it("clicar no dia lista os proventos dele", () => {
    document.querySelector(`[data-cal-date="${day(15)}"]`).click();
    expect(text("div-cal-detail")).toContain("MXRF11");
    expect(text("div-cal-detail")).toContain("recebido");
  });

  it("navega para o mês seguinte e volta", () => {
    const current = text("div-cal-month");
    $("div-cal-next").click();
    expect(text("div-cal-month")).not.toBe(current);
    expect(text("div-cal-received")).toBe("R$ 0,00");
    $("div-cal-prev").click();
    expect(text("div-cal-month")).toBe(current);
  });
});

describe("independência financeira", () => {
  beforeEach(() => {
    ui.renderInvestments(portfolio());
    goTo("health");
    setValue("proj-contribution", "1000");
    setValue("proj-appreciation", "0");
    setValue("proj-yield", "12");
  });

  it("calcula patrimônio necessário e previsão a partir da meta", () => {
    setValue("fi-target-input", "2000");
    expect(text("fi-required")).toBe("R$ 200.000,00"); // 2.000 × 12 / 12%
    expect(text("fi-eta")).not.toBe("—");
    expect(text("fi-eta-note")).toMatch(/^Em /);
    expect($("fi-progress").getAttribute("aria-valuenow")).toMatch(/^\d+$/);
  });

  it("salva a meta ao terminar de editar e trata meta vazia", () => {
    const save = vi.fn();
    ui.onFinancialIndependenceTargetChange(save);
    setValue("fi-target-input", "3500", "change");
    expect(save).toHaveBeenCalledWith(3500);

    setValue("fi-target-input", "");
    expect(text("fi-required")).toBe("—");
  });
});

/* ---------------------------------------------------------------
   Central de alertas
--------------------------------------------------------------- */
describe("central de alertas", () => {
  const today = new Date().toLocaleDateString("sv-SE");
  const flush = () => new Promise((r) => setTimeout(r, 5));

  beforeEach(() => {
    localStorage.clear();
  });

  it("conta os não lidos, abre o painel e leva para a tela do alerta", async () => {
    ui.renderBudgets([{ category: "Lazer", monthlyLimit: 100 }], [{ id: "t", type: "expense", category: "Lazer", amount: 150, date: today, description: "x" }]);
    ui.renderDividendsData([{ id: "d1", ticker: "MXRF11", type: "Rendimento", amount: 22, date: today }]);
    await flush();

    expect($("notif-dot").classList.contains("hidden")).toBe(false);
    expect(Number(text("notif-count"))).toBeGreaterThanOrEqual(2);
    expect($("notif-btn").getAttribute("aria-label")).toMatch(/não lido/);

    $("notif-btn").click();
    expect($("notif-panel").classList.contains("hidden")).toBe(false);
    expect(text("notif-list")).toContain("Orçamento de Lazer estourado");
    expect(text("notif-list")).toContain("em proventos hoje");

    document.querySelector('#notif-list [data-alert-view="budget"]').click();
    expect($("notif-panel").classList.contains("hidden")).toBe(true);
    expect($("view-budget").classList.contains("hidden")).toBe(false);
  });

  it("marcar como lidos zera o contador, mas mantém os alertas na lista", async () => {
    ui.renderDividendsData([{ id: "d1", ticker: "MXRF11", type: "Rendimento", amount: 22, date: today }]);
    await flush();
    $("notif-btn").click();
    $("notif-mark-read").click();
    expect($("notif-dot").classList.contains("hidden")).toBe(true);
    expect(text("notif-list")).toContain("em proventos hoje");
    fire(document, "keydown");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect($("notif-panel").classList.contains("hidden")).toBe(true);
  });

  it("sem alertas, mostra a mensagem vazia e esconde o contador", async () => {
    ui.renderBudgets([], []);
    ui.renderDividendsData([]);
    ui.renderInvestments([]);
    ui.renderJoinRequests([]);
    await flush();
    expect($("notif-dot").classList.contains("hidden")).toBe(true);
    expect(text("notif-list")).toContain("Nenhum alerta");
  });
});

/* ---------------------------------------------------------------
   Tema, primeiros passos e acessibilidade
--------------------------------------------------------------- */
describe("tema claro/escuro", () => {
  it("o botão do cabeçalho alterna e lembra a escolha", () => {
    ui.setThemePreference("dark");
    expect(document.documentElement.classList.contains("theme-light")).toBe(false);
    $("theme-toggle").click();
    expect(document.documentElement.classList.contains("theme-light")).toBe(true);
    expect(localStorage.getItem("aportfy_theme")).toBe("light");
    expect($("theme-toggle").getAttribute("aria-label")).toBe("Ativar tema escuro");
    $("theme-toggle").click();
    expect(document.documentElement.classList.contains("theme-light")).toBe(false);
  });

  it("as opções de Configurações marcam a escolhida", () => {
    document.querySelector('[data-theme-option="system"]').click();
    expect(localStorage.getItem("aportfy_theme")).toBe("system");
    const pressed = [...document.querySelectorAll("[data-theme-option]")].filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.map((b) => b.dataset.themeOption)).toEqual(["system"]);
    ui.setThemePreference("dark");
  });
});

describe("primeiros passos", () => {
  it("aparece só depois que os dados chegam e conta o que já foi feito", () => {
    ui.renderBudgets([], []);
    ui.updateOnboarding({ uid: "u1", ready: false });
    expect($("onboarding-card").classList.contains("hidden")).toBe(true);
    ui.updateOnboarding({ uid: "u1", ready: true });
    expect($("onboarding-card").classList.contains("hidden")).toBe(false);
    // a carteira de teste já tem investimentos
    expect(text("onboarding-progress")).toBe("1 de 4 concluídos");
    expect(document.querySelector('[data-onboarding-step="investment"]').disabled).toBe(true);
  });

  it("dispensar esconde e é lembrado por usuário", () => {
    ui.updateOnboarding({ uid: "u1", ready: true });
    $("onboarding-dismiss").click();
    expect($("onboarding-card").classList.contains("hidden")).toBe(true);
    ui.updateOnboarding({ uid: "u1", ready: true });
    expect($("onboarding-card").classList.contains("hidden")).toBe(true);
    ui.updateOnboarding({ uid: "u2", ready: true });
    expect($("onboarding-card").classList.contains("hidden")).toBe(false);
    ui.updateOnboarding({ uid: null, ready: false });
  });
});

describe("acessibilidade", () => {
  it("modais viram diálogos com título", () => {
    const modal = $("transaction-modal");
    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(modal.getAttribute("aria-labelledby"))).not.toBeNull();
  });

  it("Esc fecha o modal aberto pelo botão de fechar", () => {
    const modal = $("transaction-modal");
    const close = vi.fn(() => modal.classList.add("hidden"));
    $("modal-close-btn").addEventListener("click", close, { once: true });
    modal.classList.remove("hidden");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(close).toHaveBeenCalledOnce();
    expect(modal.classList.contains("hidden")).toBe(true);
  });

  it("navegação marca a página atual e ícones são decorativos", () => {
    goTo("investments");
    expect(document.querySelector('.nav-item[data-view="investments"]').getAttribute("aria-current")).toBe("page");
    expect(document.querySelector('.nav-item[data-view="dashboard"]').hasAttribute("aria-current")).toBe(false);
    const icons = [...document.querySelectorAll('i[class*="ph-"]')];
    expect(icons.every((i) => i.getAttribute("aria-hidden") === "true")).toBe(true);
    goTo("dashboard");
  });

  it("selects customizados funcionam pelo teclado", () => {
    const select = $("inv-category-filter");
    const trigger = select.nextElementSibling;
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    trigger.click();
    const popup = document.getElementById("dropdown-popup");
    expect(popup.classList.contains("hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("End");
    const options = [...popup.querySelectorAll('[role="option"]')];
    expect(document.activeElement).toBe(options[options.length - 1]);
    key("Escape");
    expect(popup.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});

/* ---------------------------------------------------------------
   Segurança da conta
--------------------------------------------------------------- */
describe("segurança da conta", () => {
  it("avisa quando o e-mail não foi confirmado e some quando é confirmado", () => {
    ui.renderAccountSecurity({ email: "ana@exemplo.com", emailVerified: false });
    expect($("verify-banner").classList.contains("hidden")).toBe(false);
    expect(text("verify-email")).toBe("ana@exemplo.com");
    expect(text("settings-email-status")).toContain("ainda não confirmado");

    ui.renderAccountSecurity({ email: "ana@exemplo.com", emailVerified: true });
    expect($("verify-banner").classList.contains("hidden")).toBe(true);
    expect(text("settings-email-status")).toContain("E-mail confirmado");

    ui.renderAccountSecurity(null);
    expect($("verify-banner").classList.contains("hidden")).toBe(true);
  });

  it("os botões do aviso chamam reenviar e conferir", async () => {
    $("verify-check-btn").click();
    expect(accountHandlers.onCheck).toHaveBeenCalledOnce();
    $("verify-resend-btn").click();
    expect(accountHandlers.onResend).toHaveBeenCalledOnce();
    expect($("verify-resend-btn").disabled).toBe(true); // evita vários envios seguidos
  });

  it("excluir conta exige a senha antes de chamar a exclusão", () => {
    ui.openDeleteAccountModal();
    expect($("delete-account-modal").classList.contains("hidden")).toBe(false);

    $("delete-account-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(accountHandlers.onDelete).not.toHaveBeenCalled();
    expect($("delete-account-error").classList.contains("hidden")).toBe(false);

    $("delete-account-password").value = "minhaSenha123";
    $("delete-account-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(accountHandlers.onDelete).toHaveBeenCalledWith("minhaSenha123");
  });

  it("cancelar fecha o modal e limpa a senha digitada", () => {
    ui.openDeleteAccountModal();
    $("delete-account-password").value = "segredo123";
    $("delete-account-cancel-btn").click();
    expect($("delete-account-modal").classList.contains("hidden")).toBe(true);
    expect($("delete-account-password").value).toBe("");
  });

  it("o modo cadastro mostra a regra da senha; o login não", () => {
    expect($("password-hint").classList.contains("hidden")).toBe(true);
    ui.toggleAuthMode();
    expect($("password-hint").classList.contains("hidden")).toBe(false);
    expect($("login-password").getAttribute("autocomplete")).toBe("new-password");
    ui.toggleAuthMode();
    expect($("password-hint").classList.contains("hidden")).toBe(true);
    expect($("login-password").getAttribute("autocomplete")).toBe("current-password");
  });
});
