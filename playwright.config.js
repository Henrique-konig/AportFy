// Testes de ponta a ponta (npm run test:e2e): o app real num Chromium, com o Firebase trocado por
// uma versão falsa em memória (tests/e2e/fakes). Pegam o que o jsdom não vê: módulos de verdade,
// service worker, layout e o fluxo inteiro de tela -> app.js -> banco.
import { defineConfig } from "@playwright/test";

const PORT = 5611;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.js",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: "block", // o service worker tem teste próprio (sw.spec.js)
  },
  webServer: {
    command: `npx --yes serve -l ${PORT} .`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
