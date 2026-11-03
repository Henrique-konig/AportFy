// =========================================================
// AportFy — app/watchlist.js
// Favoritos e alertas: ficam sempre no espaço pessoal (o aviso chega para quem criou).
// =========================================================

import * as ui from "../ui.js";
import { deleteFromCollection, listenToCollection, setInCollection } from "../db.js";
import { gate, session } from "./session.js";

const COLLECTION = "watchlist";
const uid = () => session.activeUser?.uid;

export function subscribeWatchlist() {
  ui.setWatchlist([]);
  return listenToCollection("personal", uid(), COLLECTION, gate((docs, error) => {
    if (error) return ui.showToast("Erro ao carregar os favoritos.", "error");
    ui.setWatchlist(docs);
  }));
}

async function run(fn, errorMessage) {
  try {
    await fn();
  } catch (err) {
    console.error(err);
    ui.showToast(errorMessage, "error");
  }
}

export function bindWatchlist() {
  ui.bindWatchlist({
    onToggle: (ticker, kind, watched) =>
      run(() => (watched ? deleteFromCollection("personal", uid(), COLLECTION, ticker) : setInCollection("personal", uid(), COLLECTION, ticker, { ticker, kind, alerts: [] })), "Não foi possível atualizar os favoritos."),
    onSaveAlerts: (ticker, kind, alerts) => run(() => setInCollection("personal", uid(), COLLECTION, ticker, { ticker, kind, alerts }), "Não foi possível salvar o alerta."),
  });
}
