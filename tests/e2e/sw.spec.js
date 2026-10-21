// Service worker de verdade: registra, guarda o essencial e deixa o app abrir sem internet.
// Usa a rede real (sem Firebase falso): precisa de internet para as bibliotecas de CDN.
import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("registra o service worker, guarda o app e abre offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // O SW assume a página depois de ativar; recarrega para as próximas buscas passarem por ele.
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) urls.push(...(await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname));
    return { names, urls };
  });
  expect(cached.names).toContain("aportfy-v2");
  expect(cached.urls).toEqual(expect.arrayContaining(["/index.html", "/css/tailwind.css", "/js/app.js"]));

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#login-screen")).toBeVisible();
  await expect(page.locator("#login-screen h1")).toContainText("AportFy");
});
