// @vitest-environment jsdom
// Registro de erros: o navegador avisa (js/errors.js) e a função limpa e registra (api/erros.js).
import { describe, it, expect, vi, beforeAll } from "vitest";
import handler, { sanitize } from "../api/erros.js";

function fakeRes() {
  const res = { statusCode: 200, body: null, ended: false };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  res.end = () => ((res.ended = true), res);
  return res;
}

describe("api/erros", () => {
  it("só aceita POST", () => {
    const res = fakeRes();
    handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("registra um aviso válido nos logs e responde 204", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    handler({ method: "POST", body: { kind: "error", message: "boom", stack: "at x", page: "/", ua: "Chrome" } }, res);
    expect(res.statusCode).toBe(204);
    expect(log).toHaveBeenCalledWith("[erro-cliente]", expect.stringContaining('"message":"boom"'));
    log.mockRestore();
  });

  it("aceita o corpo como texto JSON (sendBeacon) e recusa lixo", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = fakeRes();
    handler({ method: "POST", body: JSON.stringify({ message: "x" }) }, ok);
    expect(ok.statusCode).toBe(204);
    for (const body of ["não é json", null, {}, { message: "" }, 42]) {
      const bad = fakeRes();
      handler({ method: "POST", body }, bad);
      expect(bad.statusCode).toBe(400);
    }
    log.mockRestore();
  });

  it("limita o tamanho dos campos, tira quebras de linha e ignora campos extras", () => {
    const entry = sanitize({ kind: "hack", message: "a\nb", stack: "s".repeat(5000), page: "p".repeat(500), ua: "u".repeat(500), email: "x@y.com", token: "segredo" });
    expect(entry.message).not.toMatch(/\n/);
    expect(entry.stack).toHaveLength(1500);
    expect(entry.page).toHaveLength(100);
    expect(entry.ua).toHaveLength(160);
    expect(entry.kind).toBe("error");
    expect(Object.keys(entry).sort()).toEqual(["kind", "message", "page", "stack", "ua"]);
  });
});

describe("js/errors.js", () => {
  const beacons = [];
  beforeAll(async () => {
    navigator.sendBeacon = vi.fn((url, blob) => {
      beacons.push({ url, blob });
      return true;
    });
    await import("../js/errors.js");
  });
  const fire = (message) => window.dispatchEvent(new ErrorEvent("error", { message, error: new Error(message) }));

  it("avisa erro não tratado, sem dados pessoais", async () => {
    fire("falhou aqui");
    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe("/api/erros");
    const sent = JSON.parse(await beacons[0].blob.text());
    expect(sent).toMatchObject({ kind: "error", message: "falhou aqui" });
    expect(Object.keys(sent).sort()).toEqual(["kind", "message", "page", "stack", "ua"]);
  });

  it("não repete o mesmo erro, ignora ruído e para depois de 5", () => {
    const before = beacons.length;
    fire("falhou aqui"); // repetido
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
    expect(beacons.length).toBe(before);
    for (let i = 0; i < 10; i++) fire(`erro diferente ${i}`);
    expect(beacons.length).toBe(5);
  });
});
