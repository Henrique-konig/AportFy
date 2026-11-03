// =========================================================
// AportFy — ui/watchlist.js
// Favoritos: ativos acompanhados (com alertas). O estado fica aqui; as telas (Análise e ficha) só leem e pedem mudanças.
// =========================================================

let items = []; // [{ ticker, kind, alerts: [{ metric, op, value, on }] }]
let handlers = {};
const listeners = new Set();

export const watchlistItems = () => items;
export const watchItem = (ticker) => items.find((i) => i.ticker === ticker);
export const isWatched = (ticker) => Boolean(watchItem(ticker));

/** Chamado quando a lista de favoritos muda (as telas se redesenham). */
export function onWatchlistChange(fn) {
  listeners.add(fn);
}

export function setWatchlist(next) {
  items = [...next].sort((a, b) => a.ticker.localeCompare(b.ticker));
  listeners.forEach((fn) => fn());
}

/** `onToggle(ticker, kind, watched)` e `onSaveAlerts(ticker, kind, alerts)` gravam no Firestore. */
export function bindWatchlist(next) {
  handlers = next;
}

export const toggleWatch = (ticker, kind) => handlers.onToggle?.(ticker, kind, isWatched(ticker));
export const saveWatchAlerts = (ticker, kind, alerts) => handlers.onSaveAlerts?.(ticker, kind, alerts);
