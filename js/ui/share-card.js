// =========================================================
// AportFy — ui/share-card.js
// "Minha carteira" em imagem para compartilhar: só percentuais por categoria, nunca valores em reais.
// =========================================================

import { analyzePortfolioHealth } from "../calc.js";
import { INVESTMENT_CATEGORY_COLORS, showToast, state } from "./core.js";

/** Desenha o card (1080x1080) num canvas. */
function drawCard(categories) {
  const canvas = Object.assign(document.createElement("canvas"), { width: 1080, height: 1080 });
  const g = canvas.getContext("2d");
  g.fillStyle = "#020617";
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = "#f8fafc";
  g.font = "bold 64px sans-serif";
  g.fillText("Minha carteira", 80, 150);
  g.fillStyle = "#64748b";
  g.font = "32px sans-serif";
  g.fillText("Distribuição por categoria", 80, 205);
  categories.slice(0, 6).forEach((c, i) => {
    const y = 300 + i * 120;
    const color = INVESTMENT_CATEGORY_COLORS[c.category] || INVESTMENT_CATEGORY_COLORS["Outros"];
    g.fillStyle = "#e2e8f0";
    g.font = "bold 36px sans-serif";
    g.fillText(c.category, 80, y);
    g.textAlign = "right";
    g.fillText(`${c.pct.toFixed(1).replace(".", ",")}%`, 1000, y);
    g.textAlign = "left";
    g.fillStyle = "#1e293b";
    g.fillRect(80, y + 20, 920, 24);
    g.fillStyle = color;
    g.fillRect(80, y + 20, Math.max(8, (920 * c.pct) / 100), 24);
  });
  g.fillStyle = "#475569";
  g.font = "28px sans-serif";
  g.fillText("AportFy", 80, 1020);
  return canvas;
}

export function bindShareCard() {
  document.getElementById("share-card-btn")?.addEventListener("click", () => {
    const health = analyzePortfolioHealth(state.lastInvestments || [], [], undefined, new Date().toLocaleDateString("sv-SE"));
    if (health.empty) return showToast("Cadastre investimentos para gerar o card.", "info");
    drawCard(health.byCategory).toBlob(async (blob) => {
      const file = new File([blob], "minha-carteira.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file], title: "Minha carteira" }).catch(() => {});
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: file.name });
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Imagem salva.", "success");
    });
  });
}
