import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, arrayUnion } from "firebase/firestore";
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";

const OWNER = "ownerOwnerOwnerOwnerOwner12";
const PARTNER = "partnerPartnerPartnerPartn12";
const STRANGER = "strangerStrangerStrangerSt12";
const OTHER = "otherOtherOtherOtherOtherO12";

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "aportfy-rules-test", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 } });
});
afterAll(async () => env.cleanup());

// Por padrão o usuário tem o e-mail verificado (como quem já confirmou o cadastro).
const as = (uid, verified = true) => env.authenticatedContext(uid, { email_verified: verified }).firestore();
const requestOf = (uid, extra = {}) => ({ uid, email: "x@x.com", displayName: "X", status: "pending", createdAt: new Date(), ...extra });

beforeEach(async () => {
  await env.clearFirestore();
  // espaço do dono com ele e o parceiro já aprovado, mais um dado financeiro
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "couples", OWNER), { members: [OWNER, PARTNER] });
    await setDoc(doc(db, "couples", OWNER, "transactions", "t1"), { description: "x", amount: 1 });
    await setDoc(doc(db, "users", OWNER), { email: "o@x.com" });
  });
});

describe("espaço do casal", () => {
  it("dono e membros leem o doc raiz e os dados; estranho não", async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), "couples", OWNER)));
    await assertSucceeds(getDoc(doc(as(PARTNER), "couples", OWNER)));
    await assertSucceeds(getDoc(doc(as(PARTNER), "couples", OWNER, "transactions", "t1")));
    await assertFails(getDoc(doc(as(STRANGER), "couples", OWNER)));
    await assertFails(getDoc(doc(as(STRANGER), "couples", OWNER, "transactions", "t1")));
    await assertFails(getDocs(collection(as(STRANGER), "couples", OWNER, "transactions")));
  });

  it("dono pode ler o próprio espaço mesmo antes de ele existir e criá-lo só com ele mesmo", async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), "couples", STRANGER)));
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", STRANGER), { members: [STRANGER] }));
    await assertFails(setDoc(doc(as(OTHER), "couples", OTHER), { members: [OTHER, STRANGER] }));
    await assertFails(setDoc(doc(as(STRANGER), "couples", OTHER), { members: [STRANGER] }));
  });

  it("quem tem o código NÃO consegue se adicionar aos membros", async () => {
    await assertFails(updateDoc(doc(as(STRANGER), "couples", OWNER), { members: arrayUnion(STRANGER) }));
  });

  it("nem um membro que não é o dono adiciona alguém", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER));
    });
    await assertFails(updateDoc(doc(as(PARTNER), "couples", OWNER), { members: arrayUnion(STRANGER) }));
  });
});

describe("pedido de entrada", () => {
  it("estranho cria só o próprio pedido, pendente, para um espaço que existe", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertFails(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", OTHER), requestOf(OTHER)));
    await assertFails(setDoc(doc(as(OTHER), "couples", OWNER, "joinRequests", OTHER), requestOf(OTHER, { status: "approved" })));
    await assertFails(setDoc(doc(as(OTHER), "couples", OWNER, "joinRequests", OTHER), requestOf(OTHER, { extra: 1 })));
    await assertFails(setDoc(doc(as(OTHER), "couples", "inexistenteInexistenteInex12", "joinRequests", OTHER), requestOf(OTHER)));
  });

  it("sem e-mail verificado não dá para pedir entrada", async () => {
    await assertFails(setDoc(doc(as(STRANGER, false), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertSucceeds(setDoc(doc(as(STRANGER, true), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
  });

  it("quem já é membro não precisa pedir", async () => {
    await assertFails(setDoc(doc(as(PARTNER), "couples", OWNER, "joinRequests", PARTNER), requestOf(PARTNER)));
  });

  it("o solicitante não se aprova, e só ele e o dono veem o pedido", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertFails(updateDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), { status: "approved" }));
    await assertSucceeds(getDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER)));
    await assertSucceeds(getDocs(collection(as(OWNER), "couples", OWNER, "joinRequests")));
    await assertFails(getDoc(doc(as(OTHER), "couples", OWNER, "joinRequests", STRANGER)));
    await assertFails(getDocs(collection(as(PARTNER), "couples", OWNER, "joinRequests")));
  });

  it("dono aprova: vira membro, passa a ler os dados, e o solicitante limpa o pedido", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertFails(getDoc(doc(as(STRANGER), "couples", OWNER, "transactions", "t1")));

    await assertSucceeds(updateDoc(doc(as(OWNER), "couples", OWNER), { members: arrayUnion(STRANGER) }));
    await assertSucceeds(updateDoc(doc(as(OWNER), "couples", OWNER, "joinRequests", STRANGER), { status: "approved" }));

    await assertSucceeds(getDoc(doc(as(STRANGER), "couples", OWNER, "transactions", "t1")));
    await assertSucceeds(deleteDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER)));
  });

  it("dono não adiciona quem não pediu, nem remove membros, nem mexe em outros campos", async () => {
    await assertFails(updateDoc(doc(as(OWNER), "couples", OWNER), { members: arrayUnion(OTHER) }));
    await assertFails(updateDoc(doc(as(OWNER), "couples", OWNER), { members: [OWNER] }));
    await assertFails(updateDoc(doc(as(OWNER), "couples", OWNER), { name: "x" }));
  });

  it("dono recusa; recusado continua sem acesso e pode limpar o pedido", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertSucceeds(updateDoc(doc(as(OWNER), "couples", OWNER, "joinRequests", STRANGER), { status: "rejected" }));
    await assertFails(getDoc(doc(as(STRANGER), "couples", OWNER, "transactions", "t1")));
    await assertSucceeds(deleteDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER)));
  });

  it("dono só altera o status do pedido, e só para approved/rejected", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "couples", OWNER, "joinRequests", STRANGER), requestOf(STRANGER)));
    await assertFails(updateDoc(doc(as(OWNER), "couples", OWNER, "joinRequests", STRANGER), { status: "qualquer" }));
    await assertFails(updateDoc(doc(as(OWNER), "couples", OWNER, "joinRequests", STRANGER), { email: "outro@x.com" }));
  });

  it("pedidos não são tratados como dados financeiros (membro não escreve neles)", async () => {
    await assertFails(setDoc(doc(as(PARTNER), "couples", OWNER, "joinRequests", OTHER), requestOf(OTHER)));
  });
});

describe("dados pessoais continuam só do dono", () => {
  it("cada um acessa apenas os próprios dados", async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), "users", OWNER)));
    await assertFails(getDoc(doc(as(STRANGER), "users", OWNER)));
    await assertSucceeds(setDoc(doc(as(STRANGER), "users", STRANGER, "settings", "portfolio"), { maxAssetPct: 15 }));
    await assertFails(setDoc(doc(as(OWNER), "users", STRANGER, "settings", "portfolio"), { maxAssetPct: 15 }));
  });
});

describe("validação dos dados salvos", () => {
  const goodTx = { description: "Mercado", amount: 120.5, type: "expense", category: "Alimentação", date: "2026-10-08" };
  const txRef = (uid, id = "n1") => doc(as(uid), "users", uid, "transactions", id);

  it("aceita uma transação válida e rejeita formatos errados", async () => {
    await assertSucceeds(setDoc(txRef(STRANGER), goodTx));
    await assertFails(setDoc(txRef(STRANGER, "n2"), { ...goodTx, amount: -5 }));
    await assertFails(setDoc(txRef(STRANGER, "n3"), { ...goodTx, amount: "120" }));
    await assertFails(setDoc(txRef(STRANGER, "n4"), { ...goodTx, amount: 1e15 }));
    await assertFails(setDoc(txRef(STRANGER, "n5"), { ...goodTx, type: "transfer" }));
    await assertFails(setDoc(txRef(STRANGER, "n6"), { ...goodTx, description: "x".repeat(201) }));
    await assertFails(setDoc(txRef(STRANGER, "n7"), { ...goodTx, description: "" }));
    await assertFails(setDoc(txRef(STRANGER, "n8"), { ...goodTx, date: "08/10/2026 12:00" }));
    await assertFails(setDoc(txRef(STRANGER, "n9"), { description: "só isso" }));
  });

  it("edição também é validada (o documento final precisa continuar válido)", async () => {
    await assertSucceeds(setDoc(txRef(STRANGER), goodTx));
    await assertSucceeds(updateDoc(txRef(STRANGER), { amount: 99 }));
    await assertFails(updateDoc(txRef(STRANGER), { amount: -1 }));
    await assertFails(updateDoc(txRef(STRANGER), { type: "x" }));
  });

  it("metas, investimentos, proventos, orçamentos e recorrências", async () => {
    const ctx = as(STRANGER);
    const col = (name, id) => doc(ctx, "users", STRANGER, name, id);
    await assertSucceeds(setDoc(col("goals", "g1"), { name: "Viagem", targetAmount: 5000, currentAmount: 0, deadline: "2027-01-01" }));
    await assertSucceeds(setDoc(col("goals", "g2"), { name: "Sem prazo", targetAmount: 100, currentAmount: 10 }));
    await assertFails(setDoc(col("goals", "g3"), { name: "Ruim", targetAmount: "5000", currentAmount: 0 }));

    const inv = { ticker: "PETR4", category: "Ações", quantity: 20, avgPrice: 30, currentPrice: 36, purchaseDate: "2026-05-02", purchases: [] };
    await assertSucceeds(setDoc(col("investments", "i1"), inv));
    await assertSucceeds(setDoc(col("investments", "i2"), { ...inv, quantity: 0.00012 })); // cripto fracionada
    await assertSucceeds(setDoc(col("investments", "i3"), { ...inv, quantity: 0 })); // vendida por completo
    await assertFails(setDoc(col("investments", "i4"), { ...inv, quantity: -1 }));
    await assertFails(setDoc(col("investments", "i5"), { ...inv, ticker: "" }));

    await assertSucceeds(setDoc(col("dividends", "d1"), { ticker: "MXRF11", type: "Rendimento", amount: 12.3, date: "2026-10-15" }));
    await assertFails(setDoc(col("dividends", "d2"), { ticker: "MXRF11", type: "Rendimento", amount: "12", date: "2026-10-15" }));

    await assertSucceeds(setDoc(col("budgets", "Alimentação"), { monthlyLimit: 800 }));
    await assertFails(setDoc(col("budgets", "Lazer"), { monthlyLimit: -1 }));

    const rec = { description: "Aluguel", amount: 1900, type: "expense", category: "Moradia", dayOfMonth: 5, lastGeneratedMonth: null };
    await assertSucceeds(setDoc(col("recurrences", "r1"), rec));
    await assertFails(setDoc(col("recurrences", "r2"), { ...rec, dayOfMonth: 40 }));
    await assertFails(setDoc(col("recurrences", "r3"), { ...rec, dayOfMonth: 5.5 }));
  });

  it("coleções desconhecidas não aceitam gravação", async () => {
    await assertFails(setDoc(doc(as(STRANGER), "users", STRANGER, "qualquer", "x"), { a: 1 }));
    await assertFails(setDoc(doc(as(OWNER), "couples", OWNER, "qualquer", "x"), { a: 1 }));
  });

  it("o espaço do casal usa as mesmas validações", async () => {
    const good = { description: "Mercado", amount: 50, type: "expense", category: "Alimentação", date: "2026-10-08" };
    await assertSucceeds(setDoc(doc(as(PARTNER), "couples", OWNER, "transactions", "n1"), good));
    await assertFails(setDoc(doc(as(PARTNER), "couples", OWNER, "transactions", "n2"), { ...good, amount: -1 }));
  });

  it("o perfil não aceita textos gigantes", async () => {
    await assertSucceeds(setDoc(doc(as(STRANGER), "users", STRANGER), { email: "a@b.com", displayName: "Ana" }, { merge: true }));
    await assertFails(setDoc(doc(as(STRANGER), "users", STRANGER), { displayName: "x".repeat(500) }, { merge: true }));
  });
});

describe("exclusão da conta", () => {
  it("o usuário apaga os próprios dados, mas não os de outros", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users", STRANGER, "goals", "g1"), { name: "x", targetAmount: 1, currentAmount: 0 });
    });
    await assertFails(deleteDoc(doc(as(OTHER), "users", STRANGER, "goals", "g1")));
    await assertSucceeds(deleteDoc(doc(as(STRANGER), "users", STRANGER, "goals", "g1")));
    await assertSucceeds(deleteDoc(doc(as(STRANGER), "users", STRANGER)));
  });

  it("o dono só apaga o espaço do casal quando é o único membro", async () => {
    // OWNER tem o parceiro como membro: não pode apagar.
    await assertFails(deleteDoc(doc(as(OWNER), "couples", OWNER)));
    // Espaço só dele: pode.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "couples", STRANGER), { members: [STRANGER] });
    });
    await assertFails(deleteDoc(doc(as(OTHER), "couples", STRANGER)));
    await assertSucceeds(deleteDoc(doc(as(STRANGER), "couples", STRANGER)));
  });
});

describe("contas, cartões e notificações", () => {
  const col = (uid, name, id) => doc(as(uid), "users", uid, name, id);

  it("contas a pagar", async () => {
    const bill = { description: "Luz", amount: 180.5, dueDate: "2026-10-28", category: "Moradia", paid: false, paidAt: null, recurring: true };
    await assertSucceeds(setDoc(col(STRANGER, "bills", "b1"), bill));
    await assertSucceeds(updateDoc(col(STRANGER, "bills", "b1"), { paid: true, paidAt: "2026-10-27", transactionId: "t1" }));
    await assertFails(setDoc(col(STRANGER, "bills", "b2"), { ...bill, amount: 0 }));
    await assertFails(setDoc(col(STRANGER, "bills", "b3"), { ...bill, paid: "não" }));
    await assertFails(setDoc(col(STRANGER, "bills", "b4"), { ...bill, dueDate: "28/10" }));
  });

  it("cartões, compras e faturas", async () => {
    await assertSucceeds(setDoc(col(STRANGER, "cards", "c1"), { name: "Nubank", limit: 5000, closingDay: 10, dueDay: 17 }));
    await assertFails(setDoc(col(STRANGER, "cards", "c2"), { name: "X", limit: 5000, closingDay: 0, dueDay: 17 }));
    await assertFails(setDoc(col(STRANGER, "cards", "c3"), { name: "X", limit: 5000, closingDay: 10, dueDay: 32 }));

    const purchase = { cardId: "c1", description: "TV", amount: 1200, installments: 10, purchaseDate: "2026-10-12", category: "Outros" };
    await assertSucceeds(setDoc(col(STRANGER, "cardPurchases", "p1"), purchase));
    await assertFails(setDoc(col(STRANGER, "cardPurchases", "p2"), { ...purchase, installments: 0 }));
    await assertFails(setDoc(col(STRANGER, "cardPurchases", "p3"), { ...purchase, installments: 100 }));
    await assertFails(setDoc(col(STRANGER, "cardPurchases", "p4"), { ...purchase, amount: -1 }));

    await assertSucceeds(setDoc(col(STRANGER, "cardInvoices", "c1_2026-11"), { cardId: "c1", month: "2026-11", paid: true, paidAt: "2026-11-17", total: 120, transactionIds: ["a", "b"] }));
    await assertFails(setDoc(col(STRANGER, "cardInvoices", "c1_2026-12"), { cardId: "c1", month: "2026-1", paid: true, total: 120 }));
  });

  it("tokens de notificação só no espaço pessoal do dono", async () => {
    await assertSucceeds(setDoc(col(STRANGER, "pushTokens", "tk1"), { token: "abc", userAgent: "Chrome" }));
    await assertFails(setDoc(doc(as(OTHER), "users", STRANGER, "pushTokens", "tk2"), { token: "abc" }));
    await assertFails(setDoc(col(STRANGER, "pushTokens", "tk3"), { token: "" }));
    await assertFails(setDoc(doc(as(OWNER), "couples", OWNER, "pushTokens", "tk4"), { token: "abc" }));
  });

  it("o casal usa as mesmas validações nas contas", async () => {
    const bill = { description: "Aluguel", amount: 1900, dueDate: "2026-11-05", category: "Moradia", paid: false };
    await assertSucceeds(setDoc(doc(as(PARTNER), "couples", OWNER, "bills", "b1"), bill));
    await assertFails(setDoc(doc(as(PARTNER), "couples", OWNER, "bills", "b2"), { ...bill, amount: -5 }));
  });
});
