// =========================================================
// AportFy — app/dividend-sync.js
// Proventos da B3: importação dos pagos e calendário dos a receber.
// =========================================================

import * as ui from "../ui.js";
import { fetchDividendCalendar } from "../api.js";
import { buildUpcomingDividends, dividendDedupeKey, dividendNetAmount, sharesOnDate } from "../calc.js";
import { addDividend } from "../db.js";
import { session } from "./session.js";

/* ---------------------------------------------------------------
   Proventos da B3: importação dos já pagos e calendário dos a receber
--------------------------------------------------------------- */

// Ações (Brapi) e FIIs (função serverless /api/proventos, que consulta a B3).
export const DIVIDEND_IMPORT_CATEGORIES = ["Ações", "FIIs"];
export const CALENDAR_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

// Data local (YYYY-MM-DD) — toISOString() viraria o dia seguinte à noite no Brasil.
export const localISODate = () => new Date().toLocaleDateString("sv-SE");

/** Calendário de proventos de um ativo, com cache local de 3h pra não repetir consultas. */
export async function getDividendCalendar(inv, { force = false } = {}) {
  const cacheKey = `aportfy_div_calendar_${inv.category}_${inv.ticker}`;
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CALENDAR_CACHE_TTL_MS) return { dividends: cached.dividends, ok: true };
    } catch {
      /* cache indisponível: segue sem ele */
    }
  }

  const result = await fetchDividendCalendar(inv.ticker, inv.category);
  if (result.ok) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), dividends: result.dividends }));
    } catch {
      /* cota do storage cheia: ignora */
    }
  }
  return result;
}

// Calendários já carregados nesta sessão (por ticker); null = consulta falhou.
export const dividendCalendars = {};

/** Atualiza o painel "Proventos a Receber" (busca só o que ainda não foi carregado, ou tudo com force). */
export async function refreshUpcomingDividends({ force = false } = {}) {
  const eligible = session.latestInvestments.filter((inv) => DIVIDEND_IMPORT_CATEGORIES.includes(inv.category));
  const pending = eligible.filter((inv) => force || !(inv.ticker in dividendCalendars));

  if (pending.length > 0) {
    ui.setUpcomingDividendsLoading(true);
    await Promise.all(
      pending.map(async (inv) => {
        const { dividends, ok } = await getDividendCalendar(inv, { force });
        dividendCalendars[inv.ticker] = ok ? dividends : null;
      })
    );
  }

  const failed = eligible.filter((inv) => dividendCalendars[inv.ticker] === null).map((inv) => inv.ticker);
  const calendars = Object.fromEntries(Object.entries(dividendCalendars).filter(([, v]) => v));
  ui.renderUpcomingDividends(buildUpcomingDividends(eligible, calendars, localISODate()), { failed, hasEligible: eligible.length > 0 });
  autoSyncPaidDividends(eligible);
}

// Proventos que o usuário excluiu de propósito: a importação automática não os recria.
export const IGNORED_DIVIDENDS_KEY = "aportfy_ignored_dividends";
export const readIgnoredDividends = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGNORED_DIVIDENDS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
export function ignoreDividend(key) {
  try {
    const ignored = readIgnoredDividends();
    ignored.add(key);
    localStorage.setItem(IGNORED_DIVIDENDS_KEY, JSON.stringify([...ignored]));
  } catch {
    /* storage indisponível: o provento pode voltar na próxima importação automática */
  }
}

let syncingPaidDividends = false;

/**
 * Registra os proventos já pagos que ainda não estão lançados, calculados pelas
 * cotas que o usuário tinha na data-com. `calendarFor` devolve o calendário de
 * cada ativo (ou null se a consulta falhou). Retorna quantos lançou e o total.
 */
export async function registerPaidDividends(eligible, calendarFor, { skipIgnored }) {
  const id = session.activeMode === "couple" ? session.activeCoupleId : session.activeUser.uid;
  const today = localISODate();
  const ignored = skipIgnored ? readIgnoredDividends() : new Set();
  // Evita lançar o mesmo provento duas vezes (inclusive entre rodadas seguidas).
  const existingKeys = new Set([...session.latestDividends.map((d) => dividendDedupeKey(d.ticker, d.date, d.type)), ...session.registeredKeys]);

  let imported = 0;
  let importedTotal = 0;
  let anyFailed = false;

  for (const inv of eligible) {
    const dividends = calendarFor(inv);
    if (!dividends) {
      anyFailed = true;
      continue;
    }

    for (const d of dividends) {
      // Só os já pagos — os anunciados aparecem como "a receber".
      if (d.paymentDate > today) continue;

      // Cotas que o usuário tinha na data-com (direito ao provento).
      const shares = sharesOnDate(inv, d.exDate || d.paymentDate);
      if (shares <= 0) continue;

      const key = dividendDedupeKey(inv.ticker, d.paymentDate, d.type);
      if (existingKeys.has(key) || ignored.has(key)) continue;
      existingKeys.add(key);
      session.registeredKeys.add(key);

      const amount = Math.round(dividendNetAmount(d.type, d.rate, shares) * 100) / 100;
      await addDividend(session.activeMode, id, {
        ticker: inv.ticker,
        type: d.type,
        amount,
        date: d.paymentDate,
        rate: d.rate,
        shares,
        exDate: d.exDate || null,
      });
      imported++;
      importedTotal += amount;
    }
  }

  return { imported, importedTotal, anyFailed };
}

/** Importação automática: roda quando o calendário carrega e lança os proventos pagos que faltam. */
export async function autoSyncPaidDividends(eligible) {
  if (syncingPaidDividends || !session.dividendsLoaded || !session.activeUser || eligible.length === 0) return;
  syncingPaidDividends = true;
  try {
    await registerPaidDividends(eligible, (inv) => dividendCalendars[inv.ticker] || null, { skipIgnored: true });
  } catch (err) {
    console.error("Falha na importação automática de proventos:", err);
  } finally {
    syncingPaidDividends = false;
  }
}

export async function importDividendsFromB3() {
  const eligible = session.latestInvestments.filter((inv) => DIVIDEND_IMPORT_CATEGORIES.includes(inv.category));
  if (eligible.length === 0) {
    ui.showToast("Nenhuma ação ou FII cadastrado para importar proventos.", "info");
    return;
  }

  ui.setImportDividendsLoading(true);

  try {
    const calendars = {};
    await Promise.all(
      eligible.map(async (inv) => {
        const { dividends, ok } = await getDividendCalendar(inv, { force: true });
        calendars[inv.ticker] = ok ? dividends : null;
        dividendCalendars[inv.ticker] = ok ? dividends : null;
      })
    );

    // Importação manual: traz também o que foi excluído antes (o usuário pediu de novo).
    const { imported, importedTotal, anyFailed } = await registerPaidDividends(eligible, (inv) => calendars[inv.ticker], { skipIgnored: false });

    if (imported > 0) {
      ui.showToast(
        `${imported} provento(s) importado(s) da B3 (R$ ${importedTotal.toFixed(2).replace(".", ",")} no total).`,
        "success"
      );
    } else if (anyFailed) {
      ui.showToast("Não foi possível buscar proventos na B3 agora.", "error");
    } else {
      ui.showToast("Nenhum provento novo encontrado na B3 para importar.", "info");
    }
    refreshUpcomingDividends();
  } catch (err) {
    console.error(err);
    ui.showToast("Erro ao importar proventos da B3.", "error");
  } finally {
    ui.setImportDividendsLoading(false);
  }
}
