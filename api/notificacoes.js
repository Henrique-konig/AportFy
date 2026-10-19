// =========================================================
// AportFy — api/notificacoes.js (Vercel Cron, uma vez por dia)
// Manda, por Firebase Cloud Messaging, os lembretes do dia para
// cada aparelho que ativou as notificações:
//   - contas e faturas de cartão que vencem hoje/amanhã (ou ontem);
//   - proventos que caem amanhã.
// Lê os dados com o Firebase Admin (credencial de serviço na variável
// FIREBASE_SERVICE_ACCOUNT) e só aceita chamadas com o CRON_SECRET
// (a Vercel envia "Authorization: Bearer <CRON_SECRET>" no cron).
// =========================================================

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { buildPushReminders, buildUpcomingDividends, unpaidInvoices } from "../js/calc.js";
import { fetchTickerDividends, TICKER_PATTERN } from "./_lib/b3.js";

export const config = { maxDuration: 60 };

const DIVIDEND_CATEGORIES = ["FIIs", "Ações"];
const INVALID_TOKEN_CODES = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"];

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT não configurada.");
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

const docsOf = async (db, path) => (await db.collection(path).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Espaços que o usuário enxerga: o pessoal e o do casal (se for membro). */
async function spacesOf(db, uid) {
  const spaces = [{ path: `users/${uid}`, label: "" }];
  const profile = (await db.doc(`users/${uid}`).get()).data() || {};
  const coupleId = profile.coupleId || uid;
  const couple = (await db.doc(`couples/${coupleId}`).get()).data();
  // Só lembra do espaço de casal quando há outra pessoa nele (sozinho, é igual ao pessoal na prática).
  if (couple?.members?.includes(uid) && couple.members.length > 1) spaces.push({ path: `couples/${coupleId}`, label: "Casal · " });
  return spaces;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  let db, messaging;
  try {
    const app = adminApp();
    db = getFirestore(app);
    messaging = getMessaging(app);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const calendarCache = new Map(); // ticker -> proventos (uma busca por ticker em toda a execução)
  const calendarOf = async (inv) => {
    const ticker = String(inv.ticker || "").toUpperCase();
    if (!TICKER_PATTERN.test(ticker)) return [];
    if (!calendarCache.has(ticker)) {
      calendarCache.set(ticker, fetchTickerDividends(ticker, inv.category === "Ações").catch(() => []));
    }
    return calendarCache.get(ticker);
  };

  // Tokens agrupados por usuário (users/{uid}/pushTokens/{id})
  const tokenDocs = (await db.collectionGroup("pushTokens").get()).docs;
  const byUser = new Map();
  tokenDocs.forEach((d) => {
    const uid = d.ref.parent.parent?.id;
    const token = d.get("token");
    if (!uid || !token) return;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push({ token, ref: d.ref });
  });

  let sent = 0, removed = 0, failed = 0;
  for (const [uid, tokens] of byUser) {
    try {
      const reminders = [];
      for (const space of await spacesOf(db, uid)) {
        const [bills, cards, purchases, paidInvoices, investments] = await Promise.all(
          ["bills", "cards", "cardPurchases", "cardInvoices", "investments"].map((name) => docsOf(db, `${space.path}/${name}`))
        );
        const eligible = investments.filter((inv) => DIVIDEND_CATEGORIES.includes(inv.category) && (Number(inv.quantity) || 0) > 0);
        const calendars = {};
        await Promise.all(eligible.map(async (inv) => (calendars[inv.ticker] = await calendarOf(inv))));
        buildPushReminders({
          today,
          bills,
          invoices: unpaidInvoices(cards, purchases, paidInvoices),
          upcomingDividends: buildUpcomingDividends(eligible, calendars, today),
        }).forEach((r) => reminders.push({ ...r, title: space.label + r.title }));
      }

      for (const r of reminders) {
        const result = await messaging.sendEachForMulticast({
          tokens: tokens.map((t) => t.token),
          data: { title: r.title, body: r.body, tag: r.tag, url: `/?view=${r.view}` },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        });
        sent += result.successCount;
        result.responses.forEach((resp, i) => {
          if (!resp.success && INVALID_TOKEN_CODES.includes(resp.error?.code)) tokens[i].dead = true;
        });
      }
      for (const t of tokens.filter((t) => t.dead)) {
        await t.ref.delete().catch(() => {});
        removed++;
      }
    } catch (err) {
      failed++;
      console.error(`Lembretes do usuário ${uid} falharam:`, err.message);
    }
  }

  return res.status(200).json({ today, users: byUser.size, sent, removed, failed });
}
