// =========================================================
// AportFy — app/b3-import.js
// Importa negociações (CSV da Área do Investidor da B3) para a carteira.
// =========================================================

import * as ui from "../ui.js";
import { parseB3Trades, planB3Import } from "../calc.js";
import { addInvestment, updateInvestment } from "../db.js";
import { session } from "./session.js";

export function bindB3Import() {
  const input = document.getElementById("import-b3-file");
  document.getElementById("import-b3-btn")?.addEventListener("click", () => input.click());
  input?.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    try {
      const { trades, skipped } = parseB3Trades(await file.text());
      if (!trades.length) return ui.showToast("Não encontrei negociações de ações/FIIs nesse arquivo.", "error");
      const plan = planB3Import(trades, session.latestInvestments);
      if (!plan.added) return ui.showToast("Nada novo: essas negociações já estão na carteira.", "info");
      const extra = [plan.duplicates && `${plan.duplicates} já existentes`, plan.rejected && `${plan.rejected} vendas ignoradas (sem saldo)`, skipped && `${skipped} linhas fora do formato`].filter(Boolean).join(", ");
      if (!window.confirm(`Importar ${plan.added} negociações em ${plan.changes.length} ativos?${extra ? ` (${extra})` : ""}`)) return;
      const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
      await Promise.all(plan.changes.map((c) => (c.id ? updateInvestment(session.activeMode, id, c.id, c.data) : addInvestment(session.activeMode, id, c.data))));
      ui.showToast(`${plan.added} negociações importadas.`, "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao importar o arquivo.", "error");
    }
  });
}
