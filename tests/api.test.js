// Testes das funções serverless que não dependem de rede:
// a função agendada de notificações só aceita a chamada da Vercel (CRON_SECRET).
import { describe, it, expect, afterEach } from "vitest";
import handler from "../api/notificacoes.js";

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
}

describe("api/notificacoes", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("recusa chamadas sem o segredo do cron", async () => {
    process.env.CRON_SECRET = "segredo-certo";
    const semToken = fakeRes();
    await handler({ headers: {} }, semToken);
    expect(semToken.statusCode).toBe(401);

    const tokenErrado = fakeRes();
    await handler({ headers: { authorization: "Bearer outro" } }, tokenErrado);
    expect(tokenErrado.statusCode).toBe(401);
  });

  it("sem CRON_SECRET configurado, nada roda (nem com cabeçalho)", async () => {
    delete process.env.CRON_SECRET;
    const res = fakeRes();
    await handler({ headers: { authorization: "Bearer undefined" } }, res);
    expect(res.statusCode).toBe(401);
  });

  it("avisa quando falta a credencial do Firebase Admin", async () => {
    process.env.CRON_SECRET = "s";
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const res = fakeRes();
    await handler({ headers: { authorization: "Bearer s" } }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/FIREBASE_SERVICE_ACCOUNT/);
  });
});
