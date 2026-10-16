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

const as = (uid) => env.authenticatedContext(uid).firestore();
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
