// =========================================================
// AportFy — app/backup.js
// Backup e restauração em arquivo .json.
// =========================================================

import * as ui from "../ui.js";
import { addDividend, addGoal, addInvestment, addToCollection, addTransaction, setInCollection } from "../db.js";
import { session } from "./session.js";

/* ---------------------------------------------------------------
   Backup e Restauração
--------------------------------------------------------------- */
export function serializeForBackup(items) {
  return items.map((item) => {
    const clean = { ...item };
    // createdAt vem como Timestamp do Firestore — vira ISO pra ficar
    // legível/portável no JSON exportado.
    if (clean.createdAt && typeof clean.createdAt.toDate === "function") {
      clean.createdAt = clean.createdAt.toDate().toISOString();
    }
    return clean;
  });
}

export function exportBackup() {
  const payload = {
    app: "AportFy",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    mode: session.activeMode,
    transactions: serializeForBackup(session.latestTransactions),
    goals: serializeForBackup(session.latestGoals),
    investments: serializeForBackup(session.latestInvestments),
    dividends: serializeForBackup(session.latestDividends),
    bills: serializeForBackup(session.latestBills),
    cards: serializeForBackup(session.latestCards),
    cardPurchases: serializeForBackup(session.latestPurchases),
    cardInvoices: serializeForBackup(session.latestCardInvoices),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aportfy-backup-${session.activeMode}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  ui.showToast("Backup baixado com sucesso!", "success");
}

// Mapeia cada categoria do backup pra função de escrita já existente —
// reimportar cria documentos novos (id e createdAt são regenerados).
export const BACKUP_IMPORTERS = {
  transactions: addTransaction,
  goals: addGoal,
  investments: addInvestment,
  dividends: addDividend,
};

export async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    ui.showToast("Arquivo inválido — não é um JSON de backup do AportFy.", "error");
    return;
  }

  const counts = Object.fromEntries(
    Object.keys(BACKUP_IMPORTERS).map((key) => [key, Array.isArray(data[key]) ? data[key].length : 0])
  );
  const cardKeys = ["bills", "cards", "cardPurchases", "cardInvoices"];
  const cardCount = cardKeys.reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) + cardCount;
  if (total === 0) {
    ui.showToast("Nenhum registro encontrado nesse arquivo.", "error");
    return;
  }

  const modeLabel = session.activeMode === "couple" ? "Casal" : "Pessoal";
  const confirmed = window.confirm(
    `Restaurar vai ADICIONAR ${counts.transactions} transação(ões), ${counts.goals} meta(s), ${counts.investments} ativo(s) e ${counts.dividends} provento(s)${cardCount ? ` (e ${cardCount} item(ns) de contas e cartões)` : ""} aos dados atuais do modo ${modeLabel}. Isso não apaga nada existente. Continuar?`
  );
  if (!confirmed) return;

  const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
  let imported = 0;
  let failed = 0;

  for (const [key, addFn] of Object.entries(BACKUP_IMPORTERS)) {
    for (const item of data[key] || []) {
      try {
        const { id: _discardId, createdAt: _discardCreatedAt, ...rest } = item;
        await addFn(session.activeMode, id, rest);
        imported++;
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  }

  // Contas e cartões: compras e faturas apontam para o id do cartão, que muda ao recriar.
  // O vínculo com as despesas já lançadas (transactionId) se perde, e desfazer pagamento deixa de apagá-las.
  const cardIds = {};
  const run = async (items, fn) => {
    for (const item of items || []) {
      try {
        const { id: oldId, createdAt: _c, ...rest } = item;
        await fn(oldId, rest);
        imported++;
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  };
  await run(data.cards, async (oldId, rest) => (cardIds[oldId] = (await addToCollection(session.activeMode, id, "cards", rest)).id));
  await run(data.bills, (_o, { transactionId: _t, ...rest }) => addToCollection(session.activeMode, id, "bills", rest));
  await run(data.cardPurchases, (_o, rest) => {
    if (!cardIds[rest.cardId]) throw new Error("compra sem cartão no backup");
    return addToCollection(session.activeMode, id, "cardPurchases", { ...rest, cardId: cardIds[rest.cardId] });
  });
  await run(data.cardInvoices, (_o, rest) => {
    if (!cardIds[rest.cardId]) throw new Error("fatura sem cartão no backup");
    return setInCollection(session.activeMode, id, "cardInvoices", `${cardIds[rest.cardId]}_${rest.month}`, { ...rest, cardId: cardIds[rest.cardId], transactionIds: [] });
  });

  if (failed === 0) {
    ui.showToast(`Backup restaurado: ${imported} registro(s) adicionado(s).`, "success");
  } else {
    ui.showToast(`Restaurado ${imported} registro(s), ${failed} falharam.`, "error");
  }
}
