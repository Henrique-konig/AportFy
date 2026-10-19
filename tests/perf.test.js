// Trava as otimizações de carregamento: se alguém desfizer uma delas sem querer, estes testes avisam.
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const html = readFileSync("index.html", "utf8");

const localModules = () =>
  [
    ...readdirSync("js").filter((n) => n.endsWith(".js")).map((n) => `js/${n}`),
    ...readdirSync("js/ui").filter((n) => n.endsWith(".js")).map((n) => `js/ui/${n}`),
  ].sort();

describe("carregamento", () => {
  it("o Tailwind não roda mais no navegador (CSS pré-compilado)", () => {
    expect(html).not.toContain("cdn.tailwindcss.com");
    expect(html).not.toMatch(/tailwind\.config\s*=/);
    expect(html).toContain('href="css/tailwind.css"');
  });

  it("o tailwind.css vem depois do custom.css (mesma ordem de cascata de antes)", () => {
    expect(html.indexOf("css/custom.css")).toBeGreaterThan(-1);
    expect(html.indexOf("css/tailwind.css")).toBeGreaterThan(html.indexOf("css/custom.css"));
  });

  it("o css/tailwind.css está em dia com as classes usadas (rode npm run build:css se falhar)", () => {
    const dir = mkdtempSync(join(tmpdir(), "aportfy-tw-"));
    const out = join(dir, "tailwind.css");
    try {
      execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-c", "tailwind.config.js", "-i", "tools/tailwind.css", "-o", out, "--minify"], { stdio: "pipe" });
      expect(readFileSync(out, "utf8")).toBe(readFileSync("css/tailwind.css", "utf8"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it("só os pesos de ícone usados são carregados (bold, fill e thin)", () => {
    const used = new Set([...(html + localModules().map((f) => readFileSync(f, "utf8")).join("\n")).matchAll(/\bph-(thin|light|bold|fill|duotone)\b/g)].map((m) => m[1]));
    const loaded = new Set([...html.matchAll(/phosphor-icons\/web@[\d.]+\/src\/(\w+)\/style\.css/g)].map((m) => m[1]));
    expect(loaded).toEqual(used);
    expect(html).not.toMatch(/<script[^>]+@phosphor-icons\/web@[\d.]+"/);
  });

  it("todos os módulos do app são pré-carregados em paralelo (e nenhum sobrando)", () => {
    const preloaded = [...html.matchAll(/<link rel="modulepreload" href="(js\/[^"]+)"/g)].map((m) => m[1]).sort();
    expect(preloaded).toEqual(localModules());
  });

  it("o Chart.js não trava o carregamento e o Analytics só carrega depois de aberto", () => {
    expect(html).toMatch(/<script defer src="[^"]*chart\.js/);
    const config = readFileSync("js/firebase-config.js", "utf8");
    expect(config).not.toMatch(/^import[^\n]*firebase-analytics/m);
    expect(config).toMatch(/import\("https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-analytics\.js"\)/);
  });

  it("os cartões de vidro não usam desfoque de fundo (uma camada de GPU por cartão)", () => {
    const css = readFileSync("css/custom.css", "utf8");
    const glass = css.match(/\n\.glass-card \{[^}]*\}/)?.[0] ?? "";
    expect(glass).toContain("background");
    expect(glass).not.toContain("backdrop-filter");
    expect(css).not.toMatch(/\.glow-orb \{[^}]*filter:\s*blur/);
  });
});
