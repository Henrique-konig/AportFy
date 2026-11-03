// =========================================================
// AportFy — app/asset.js
// Ficha do ativo: abre na hora com os indicadores e completa com preço e proventos.
// =========================================================

import * as ui from "../ui.js";
import { fetchAssetHistory, fetchDividendCalendar } from "../api.js";

export async function openAsset(ticker, kind, row, owned) {
  ui.openAssetSheet({ ticker, kind, row, owned });
  const category = kind === "fiis" ? "FIIs" : "Ações"; // ETF paga pela B3 como ação
  const [history, dividends] = await Promise.all([
    fetchAssetHistory(ticker).then((res) => (ui.setAssetHistory(ticker, res), res)),
    fetchDividendCalendar(ticker, category),
  ]);
  ui.setAssetDividends(ticker, dividends, history.ok ? history.data.price : row.preco);
}
