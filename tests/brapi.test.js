// Proxy da Brapi (api/brapi.js) e o cliente (js/api.js) que o usa, com a rede simulada.
import { describe, it, expect, afterEach, vi } from "vitest";
import handler, { buildBrapiUrl } from "../api/brapi.js";
import { fetchQuotes } from "../js/api.js";

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => ((res.headers[k.toLowerCase()] = v), res);
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  res.send = (b) => ((res.body = b), res);
  return res;
}

describe("api/brapi — montagem do pedido", () => {
  it("cotação, cotação com proventos e busca na lista", () => {
    expect(buildBrapiUrl({ kind: "quote", symbol: "petr4" }, "").url).toBe("https://brapi.dev/api/quote/PETR4");
    expect(buildBrapiUrl({ kind: "quote", symbol: "TAEE11", dividends: "true" }, "").url).toBe("https://brapi.dev/api/quote/TAEE11?dividends=true");
    expect(buildBrapiUrl({ kind: "list", search: "MXRF11" }, "").url).toBe("https://brapi.dev/api/quote/list?search=MXRF11");
  });

  it("a chave entra só do lado do servidor", () => {
    const { url } = buildBrapiUrl({ kind: "quote", symbol: "PETR4" }, "SEGREDO");
    expect(url).toBe("https://brapi.dev/api/quote/PETR4?token=SEGREDO");
    expect(buildBrapiUrl({ kind: "quote", symbol: "PETR4", token: "intruso" }, "").url).not.toContain("intruso");
  });

  it("recusa tickers estranhos e tipos que não existem (nada de caminhos livres)", () => {
    for (const q of [
      { kind: "quote", symbol: "../../admin" },
      { kind: "quote", symbol: "PETR4/../x" },
      { kind: "quote", symbol: "" },
      { kind: "quote", symbol: "A".repeat(20) },
      { kind: "list", search: "a b" },
      { kind: "account" },
      {},
    ]) {
      expect(buildBrapiUrl(q, "").error).toBeTruthy();
    }
  });

  it("cache maior para proventos, que mudam pouco", () => {
    expect(buildBrapiUrl({ kind: "quote", symbol: "PETR4" }, "").cacheSeconds).toBe(60);
    expect(buildBrapiUrl({ kind: "quote", symbol: "PETR4", dividends: "true" }, "").cacheSeconds).toBe(3600);
  });
});

describe("api/brapi — função", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
    delete process.env.BRAPI_TOKEN;
  });

  it("repassa o JSON, marca a resposta e guarda em cache só quando deu certo", async () => {
    process.env.BRAPI_TOKEN = "tk";
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ results: [{ regularMarketPrice: 36.5 }] }), { status: 200 }));
    const res = fakeRes();
    await handler({ query: { kind: "quote", symbol: "PETR4" } }, res);
    expect(global.fetch.mock.calls[0][0]).toBe("https://brapi.dev/api/quote/PETR4?token=tk");
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).results[0].regularMarketPrice).toBe(36.5);
    expect(res.headers["x-aportfy-proxy"]).toBe("brapi");
    expect(res.headers["cache-control"]).toContain("s-maxage=60");
  });

  it("erro da Brapi passa adiante sem ficar em cache", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "MISSING_TOKEN" }), { status: 401 }));
    const res = fakeRes();
    await handler({ query: { kind: "quote", symbol: "MXRF11" } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.headers["cache-control"]).toBeUndefined();
  });

  it("pedido inválido e rede fora do ar", async () => {
    const bad = fakeRes();
    await handler({ query: { kind: "quote", symbol: "x/y" } }, bad);
    expect(bad.statusCode).toBe(400);

    global.fetch = vi.fn(async () => {
      throw new Error("sem rede");
    });
    const down = fakeRes();
    await handler({ query: { kind: "list", search: "MXRF11" } }, down);
    expect(down.statusCode).toBe(502);
  });
});

describe("js/api.js — cotações pela função ou direto", () => {
  const original = global.fetch;
  afterEach(() => (global.fetch = original));

  const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

  it("usa a função quando ela existe (e nunca manda chave)", async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return json({ results: [{ regularMarketPrice: 10.5 }] }, 200, { "x-aportfy-proxy": "brapi" });
    });
    const { prices } = await fetchQuotes(["PETR4"]);
    expect(prices).toEqual({ PETR4: 10.5 });
    expect(calls).toEqual(["/api/brapi?kind=quote&symbol=PETR4"]);
    expect(calls.join()).not.toContain("token");
  });

  it("sem a função (servidor estático), cai na Brapi direta", async () => {
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (url.startsWith("/api/")) return new Response("não existe", { status: 404 }); // sem o cabeçalho do proxy
      return json({ results: [{ regularMarketPrice: 22 }] });
    });
    const { prices, networkError } = await fetchQuotes(["VALE3"]);
    expect(prices).toEqual({ VALE3: 22 });
    expect(networkError).toBe(false);
    expect(calls).toEqual(["/api/brapi?kind=quote&symbol=VALE3", "https://brapi.dev/api/quote/VALE3"]);
  });

  it("FII: /quote recusa (401 da Brapi, via função) e o app usa a lista", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url.includes("kind=quote")) return json({ error: "MISSING_TOKEN" }, 401, { "x-aportfy-proxy": "brapi" });
      return json({ stocks: [{ stock: "MXRF11", close: 9.55 }] }, 200, { "x-aportfy-proxy": "brapi" });
    });
    const { prices, failedTickers } = await fetchQuotes(["MXRF11"]);
    expect(prices).toEqual({ MXRF11: 9.55 });
    expect(failedTickers).toEqual([]);
  });

  it("rede fora do ar: devolve resultado parcial e avisa", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const { prices, failedTickers, networkError } = await fetchQuotes(["PETR4"]);
    expect(prices).toEqual({});
    expect(failedTickers).toEqual(["PETR4"]);
    expect(networkError).toBe(true);
  });
});
