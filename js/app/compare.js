// =========================================================
// AportFy — app/compare.js
// Comparar ativos: abre a tabela na hora e completa com o gráfico de preços.
// =========================================================

import * as ui from "../ui.js";
import { fetchAssetHistory } from "../api.js";

export async function openCompare(items) {
  ui.openCompareSheet(items);
  const tickers = items.map((i) => i.ticker);
  const results = await Promise.all(items.map((i) => fetchAssetHistory(i.ticker).then((res) => ({ ...res, ticker: i.ticker }))));
  ui.setCompareHistory(tickers, results);
}
