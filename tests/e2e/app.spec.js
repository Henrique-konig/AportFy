// Fluxos principais no app real (Chromium), com o Firebase falso. Cada teste roda do zero.
import { test, expect } from "@playwright/test";
import { openApp, readCollection, iso, UID } from "./helpers.js";

const money = (text) => text.replace(/\s/g, " ").trim(); // o app usa espaço sem quebra entre "R$" e o valor

test.describe("login", () => {
  test("tela de login com e-mail, senha e Google; cadastro mostra a regra da senha", async ({ page }) => {
    await openApp(page, { user: null });
    await expect(page.locator("#login-screen")).toBeVisible();
    await expect(page.locator("#google-login-btn")).toContainText("Continuar com Google");
    await expect(page.locator("#password-hint")).toBeHidden();
    await page.locator("#toggle-auth-mode").click();
    await expect(page.locator("#password-hint")).toBeVisible();
    await expect(page.locator("#login-submit-btn")).toContainText("Criar conta");
  });

  test("entra com e-mail e senha; senha errada mostra o aviso", async ({ page }) => {
    await openApp(page, { user: null });
    await page.fill("#login-email", "ana@exemplo.com");
    await page.fill("#login-password", "senha-errada");
    await page.locator("#login-submit-btn").click();
    await expect(page.locator("#auth-error")).toContainText("E-mail ou senha incorretos");
    await expect(page.locator("#app-shell")).toBeHidden();

    await page.fill("#login-password", "senha-certa-123");
    await page.locator("#login-submit-btn").click();
    await expect(page.locator("#app-shell")).toBeVisible();
    await expect(page.locator("#login-screen")).toBeHidden();
  });

  test("cadastro com senha fraca é recusado antes de ir ao servidor", async ({ page }) => {
    await openApp(page, { user: null });
    await page.locator("#toggle-auth-mode").click();
    await page.fill("#login-email", "novo@exemplo.com");
    await page.fill("#login-password", "abc123");
    await page.locator("#login-submit-btn").click();
    await expect(page.locator("#auth-error")).toContainText("pelo menos 8");
  });

  test("sair da conta volta para o login", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("#app-shell")).toBeVisible();
    await page.locator("#logout-btn").click();
    await expect(page.locator("#login-screen")).toBeVisible();
  });
});

test.describe("dashboard e transações", () => {
  const seed = {
    [`users/${UID}/transactions/t1`]: { description: "Salário", amount: 5000, type: "income", category: "Salário", date: iso(0) },
    [`users/${UID}/transactions/t2`]: { description: "Aluguel", amount: 1200, type: "expense", category: "Moradia", date: iso(0) },
  };

  test("mostra o saldo calculado dos dados salvos", async ({ page }) => {
    await openApp(page, { seed });
    await expect(page.locator("#kpi-income")).toHaveText(/5\.000,00/);
    await expect(page.locator("#kpi-expense")).toHaveText(/1\.200,00/);
    await expect.poll(async () => money(await page.locator("#kpi-balance").innerText())).toBe("R$ 3.800,00");
    await expect(page.locator("#transactions-tbody")).toContainText("Salário");
  });

  test("adicionar despesa pela tela grava no banco e aparece na lista", async ({ page }) => {
    await openApp(page, { seed });
    await page.locator("#new-transaction-btn").click();
    await expect(page.locator("#transaction-modal")).toBeVisible();
    await page.locator('#transaction-modal [data-type="expense"]').click();
    await page.fill("#transaction-desc", "Pizza de teste");
    await page.fill("#transaction-amount", "45.5");
    await page.locator("#transaction-submit-btn").click();

    await expect(page.locator("#transactions-tbody")).toContainText("Pizza de teste");
    const saved = (await readCollection(page, `users/${UID}/transactions`)).find((t) => t.description === "Pizza de teste");
    expect(saved).toMatchObject({ amount: 45.5, type: "expense", date: iso(0) });
    await expect.poll(async () => money(await page.locator("#kpi-expense").innerText())).toBe("R$ 1.245,50");
  });

  test("excluir uma transação pede confirmação e remove do banco", async ({ page }) => {
    await openApp(page, { seed });
    await page.locator('#transactions-tbody tr[data-id="t2"] .delete-row-btn').click();
    await page.locator("#delete-confirm-btn").click();
    await expect(page.locator('#transactions-tbody tr[data-id="t2"]')).toHaveCount(0);
    expect((await readCollection(page, `users/${UID}/transactions`)).map((t) => t.id)).toEqual(["t1"]);
  });
});

test.describe("contas e cartões", () => {
  test("pagar uma conta marca como paga e lança a despesa", async ({ page }) => {
    await openApp(page, {
      seed: { [`users/${UID}/bills/b1`]: { description: "Conta de luz", amount: 210.5, dueDate: iso(1), category: "Moradia", paid: false } },
    });
    await page.locator('.nav-item[data-view="bills"]').click();
    await expect(page.locator("#bills-list")).toContainText("Conta de luz");
    await page.locator('[data-bill-pay="b1"]').click();

    await expect.poll(async () => (await readCollection(page, `users/${UID}/bills`))[0].paid).toBe(true);
    const tx = (await readCollection(page, `users/${UID}/transactions`))[0];
    expect(tx).toMatchObject({ description: "Conta de luz", amount: 210.5, type: "expense", category: "Moradia" });
  });

  test("pagar fatura lança uma despesa por categoria", async ({ page }) => {
    const purchase = (id, description, category, amount) => [
      `users/${UID}/cardPurchases/${id}`,
      { cardId: "c1", description, category, amount, installments: 1, purchaseDate: iso(-40) },
    ];
    await openApp(page, {
      seed: {
        [`users/${UID}/cards/c1`]: { name: "Nubank", limit: 5000, closingDay: 1, dueDay: 28 },
        ...Object.fromEntries([purchase("p1", "Pizza", "Alimentação", 40), purchase("p2", "Mercado", "Alimentação", 60), purchase("p3", "Cinema", "Lazer", 30)]),
      },
    });
    await page.locator('.nav-item[data-view="bills"]').click();
    await page.locator('[data-card-open="c1"]').first().click();
    // a fatura aberta pode ser a do mês seguinte: vai para a que tem as compras
    for (let i = 0; i < 3 && !(await page.locator("#invoice-items").innerText()).includes("Pizza"); i++) await page.locator("#invoice-prev").click();
    await expect(page.locator("#invoice-items")).toContainText("Pizza");
    await page.locator("#invoice-pay-btn").click();

    await expect.poll(async () => (await readCollection(page, `users/${UID}/transactions`)).length).toBe(2);
    const byCategory = Object.fromEntries((await readCollection(page, `users/${UID}/transactions`)).map((t) => [t.category, t.amount]));
    expect(byCategory).toEqual({ Alimentação: 100, Lazer: 30 });
    expect((await readCollection(page, `users/${UID}/cardInvoices`))[0]).toMatchObject({ paid: true, total: 130 });
  });
});

test.describe("preferências", () => {
  test("modo privacidade esconde os valores e continua ao recarregar", async ({ page }) => {
    const seed = { [`users/${UID}/transactions/t1`]: { description: "Salário", amount: 5000, type: "income", category: "Salário", date: iso(0) } };
    await openApp(page, { seed });
    await expect(page.locator("#kpi-income")).toHaveText(/5\.000,00/);
    await page.locator("#privacy-toggle").click();
    await expect(page.locator("#kpi-income")).toHaveText("R$ •••••");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/privacy-on/);
    await expect(page.locator("#kpi-income")).toHaveText("R$ •••••");
    await page.locator("#privacy-toggle").click();
    await expect(page.locator("#kpi-income")).toHaveText(/5\.000,00/);
  });

  test("tema claro e escuro, lembrado ao recarregar", async ({ page }) => {
    await openApp(page);
    await expect(page.locator("html")).not.toHaveClass(/theme-light/);
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/theme-light/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/theme-light/);
  });

  test("exportar backup inclui contas e cartões", async ({ page }) => {
    await openApp(page, {
      seed: {
        [`users/${UID}/bills/b1`]: { description: "Luz", amount: 100, dueDate: iso(3), category: "Moradia", paid: false },
        [`users/${UID}/cards/c1`]: { name: "Nubank", limit: 1000, closingDay: 3, dueDay: 10 },
      },
    });
    await page.locator('.nav-item[data-view="settings"]').click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#settings-export-backup-btn").click()]);
    const backup = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path(), "utf8"));
    expect(backup.bills.map((b) => b.description)).toEqual(["Luz"]);
    expect(backup.cards.map((c) => c.name)).toEqual(["Nubank"]);
    expect(backup).toHaveProperty("cardPurchases");
    expect(backup).toHaveProperty("cardInvoices");
  });
});

test.describe("erros", () => {
  test("erro não tratado vira um aviso para /api/erros", async ({ page }) => {
    await openApp(page);
    const request = page.waitForRequest((r) => r.url().includes("/api/erros") && r.method() === "POST");
    await page.evaluate(() => setTimeout(() => {
      throw new Error("erro de teste e2e");
    }, 0));
    const body = JSON.parse((await request).postData());
    expect(body).toMatchObject({ kind: "error" });
    expect(body.message).toContain("erro de teste e2e");
  });
});

test.describe("cotações, casal, restauração e conta", () => {
  test("abrir Investimentos atualiza as cotações pela função /api/brapi", async ({ page }) => {
    await openApp(page, {
      seed: {
        [`users/${UID}/investments/i1`]: { ticker: "PETR4", category: "Ações", quantity: 10, avgPrice: 30, currentPrice: 30, purchaseDate: iso(-30), purchases: [{ date: iso(-30), quantity: 10, price: 30 }] },
      },
    });
    await page.route("**/api/brapi**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: { "x-aportfy-proxy": "brapi" }, body: JSON.stringify({ results: [{ regularMarketPrice: 40.25 }] }) })
    );
    await page.locator('.nav-item[data-view="investments"]').click();
    await expect.poll(async () => (await readCollection(page, `users/${UID}/investments`))[0].currentPrice).toBe(40.25);
    await expect(page.locator("#investments-tbody")).toContainText("PETR4");
  });

  test("trocar para o Modo Casal mostra os dados do casal", async ({ page }) => {
    await openApp(page, {
      seed: {
        [`users/${UID}/transactions/t1`]: { description: "Só meu", amount: 10, type: "expense", category: "Outros", date: iso(0) },
        [`couples/${UID}`]: { members: [UID] },
        [`couples/${UID}/transactions/c1`]: { description: "Do casal", amount: 77, type: "expense", category: "Moradia", date: iso(0) },
      },
    });
    await expect(page.locator("#transactions-tbody")).toContainText("Só meu");
    await page.locator('.mode-btn[data-mode="couple"]').click();
    await expect(page.locator("body")).toHaveClass(/mode-couple/);
    await expect(page.locator("#transactions-tbody")).toContainText("Do casal");
    await expect(page.locator("#transactions-tbody")).not.toContainText("Só meu");
    await expect(page.locator("#kpi-expense")).toHaveText(/77,00/);
    await page.locator('.mode-btn[data-mode="personal"]').click();
    await expect(page.locator("#transactions-tbody")).toContainText("Só meu");
  });

  test("restaurar backup recria cartões e religa compras e faturas ao novo id", async ({ page }) => {
    await openApp(page);
    await page.locator('.nav-item[data-view="settings"]').click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#settings-import-backup-input").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          app: "AportFy",
          transactions: [{ id: "x1", description: "Antiga", amount: 5, type: "expense", category: "Outros", date: "2026-01-02" }],
          bills: [{ id: "b1", description: "Luz", amount: 100, dueDate: "2026-11-05", category: "Moradia", paid: true, paidAt: "2026-11-04", transactionId: "x9" }],
          cards: [{ id: "oldCard", name: "Nubank", limit: 1000, closingDay: 3, dueDay: 10 }],
          cardPurchases: [{ id: "p1", cardId: "oldCard", description: "TV", amount: 300, installments: 3, purchaseDate: "2026-10-01", category: "Outros" }],
          cardInvoices: [{ cardId: "oldCard", month: "2026-10", paid: true, paidAt: "2026-10-10", total: 100, transactionIds: ["x1"] }],
        })
      ),
    });
    await expect.poll(async () => (await readCollection(page, `users/${UID}/cards`)).length).toBe(1);
    const [card] = await readCollection(page, `users/${UID}/cards`);
    expect(card.id).not.toBe("oldCard");
    await expect.poll(async () => (await readCollection(page, `users/${UID}/cardPurchases`))[0]?.cardId).toBe(card.id);
    const [invoice] = await readCollection(page, `users/${UID}/cardInvoices`);
    expect(invoice).toMatchObject({ id: `${card.id}_2026-10`, cardId: card.id, paid: true, transactionIds: [] });
    const [bill] = await readCollection(page, `users/${UID}/bills`);
    expect(bill).toMatchObject({ description: "Luz", paid: true });
    expect(bill.transactionId).toBeUndefined(); // vínculo com a despesa antiga some (o id não existe mais)
    expect((await readCollection(page, `users/${UID}/transactions`)).some((t) => t.description === "Antiga")).toBe(true);
  });

  test("excluir a conta apaga os dados e a conta", async ({ page }) => {
    await openApp(page, {
      seed: {
        [`users/${UID}`]: { email: "e2e@exemplo.com" },
        [`users/${UID}/transactions/t1`]: { description: "Salário", amount: 5000, type: "income", category: "Salário", date: iso(0) },
        [`users/${UID}/bills/b1`]: { description: "Luz", amount: 100, dueDate: iso(2), category: "Moradia", paid: false },
        [`couples/${UID}`]: { members: [UID] },
      },
    });
    await page.locator('.nav-item[data-view="settings"]').click();
    await page.locator("#settings-delete-account-btn").click();
    await expect(page.locator("#delete-account-modal")).toBeVisible();
    await page.fill("#delete-account-password", "minhaSenha123");
    await page.locator("#delete-account-confirm-btn").click();
    await expect.poll(() => page.evaluate(() => window.__authLog.some((e) => e[0] === "deleteUser"))).toBe(true);
    expect(await readCollection(page, `users/${UID}/transactions`)).toEqual([]);
    expect(await readCollection(page, `users/${UID}/bills`)).toEqual([]);
    expect((await readCollection(page, "users")).some((u) => u.id === UID)).toBe(false);
    expect((await readCollection(page, "couples")).some((c) => c.id === UID)).toBe(false);
  });

  test("proventos já pagos são importados da B3 sozinhos, com as cotas da data-com", async ({ page }) => {
    await openApp(page, {
      routes: (p) =>
        p.route("**/api/proventos**", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ticker: "MXRF11", dividends: [{ label: "RENDIMENTO", rate: 0.1, exDate: iso(-20), paymentDate: iso(-10) }] }),
          })
        ),
      seed: {
        [`users/${UID}/investments/i1`]: { ticker: "MXRF11", category: "FIIs", quantity: 100, avgPrice: 10, currentPrice: 10, purchaseDate: iso(-60), purchases: [{ date: iso(-60), quantity: 100, price: 10 }] },
      },
    });
    await expect.poll(async () => (await readCollection(page, `users/${UID}/dividends`)).length, { timeout: 10000 }).toBe(1);
    const [dividend] = await readCollection(page, `users/${UID}/dividends`);
    expect(dividend).toMatchObject({ ticker: "MXRF11", amount: 10, date: iso(-10), shares: 100 });
  });
});
