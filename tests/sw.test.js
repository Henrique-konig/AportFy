// Testa as estratégias de cache do service worker (sw.js) num ambiente simulado:
// cache inicial, "rede primeiro" para o app, offline, /api fora do cache e CDN.
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";

const source = readFileSync("sw.js", "utf8");
const ORIGIN = "https://aportfy.vercel.app";

function makeEnv({ online = true } = {}) {
  const stores = new Map(); // nome do cache -> Map(url -> Response)
  const handlers = {};
  const network = { online, calls: [] };

  const keyOf = (req) => (typeof req === "string" ? new URL(req, ORIGIN).href : req.url);
  const openStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (req, res) => void store.set(keyOf(req), res),
      match: async (req) => store.get(keyOf(req))?.clone(),
      addAll: async (urls) => {
        for (const u of urls) store.set(keyOf(u), new Response(`shell:${u}`, { status: 200 }));
      },
      keys: async () => [...store.keys()].map((url) => ({ url })),
    };
  };
  const caches = {
    open: async (name) => openStore(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (req) => {
      for (const name of stores.keys()) {
        const hit = await openStore(name).match(req);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const fetchMock = async (req) => {
    network.calls.push(keyOf(req));
    if (!network.online) throw new TypeError("offline");
    return new Response(`net:${keyOf(req)}`, { status: 200 });
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function("self", "caches", "fetch", "Response", source)(self, caches, fetchMock, Response);

  const dispatch = async (type, extra = {}) => {
    let waited;
    let responded;
    const event = { ...extra, waitUntil: (p) => (waited = p), respondWith: (p) => (responded = p) };
    handlers[type](event);
    if (waited) await waited;
    return responded ? await responded : undefined;
  };
  const request = (path, mode = "cors", method = "GET") => ({ url: new URL(path, ORIGIN).href, method, mode });
  return { stores, network, dispatch, request };
}

describe("service worker", () => {
  let env;
  beforeEach(async () => {
    env = makeEnv();
    await env.dispatch("install");
  });

  it("guarda o essencial do app ao instalar", () => {
    const [name] = [...env.stores.keys()];
    const urls = [...env.stores.get(name).keys()].map((u) => new URL(u).pathname);
    expect(urls).toEqual(expect.arrayContaining(["/", "/index.html", "/js/app.js", "/manifest.webmanifest"]));
  });

  it("arquivos do app: online vem da rede (e atualiza o cache); offline vem do cache", async () => {
    const res = await env.dispatch("fetch", { request: env.request("/js/ui/core.js") });
    expect(await res.text()).toBe(`net:${ORIGIN}/js/ui/core.js`);

    env.network.online = false;
    const offline = await env.dispatch("fetch", { request: env.request("/js/ui/core.js") });
    expect(await offline.text()).toBe(`net:${ORIGIN}/js/ui/core.js`); // a cópia salva quando estava online
  });

  it("offline, abrir qualquer página cai no index.html salvo", async () => {
    env.network.online = false;
    const res = await env.dispatch("fetch", { request: env.request("/qualquer-coisa", "navigate") });
    expect(await res.text()).toBe("shell:/index.html");
  });

  it("não intercepta /api nem requisições que não são GET", async () => {
    expect(await env.dispatch("fetch", { request: env.request("/api/proventos?ticker=MXRF11") })).toBeUndefined();
    expect(await env.dispatch("fetch", { request: env.request("/js/app.js", "cors", "POST") })).toBeUndefined();
    expect(await env.dispatch("fetch", { request: { url: "https://firestore.googleapis.com/x", method: "GET", mode: "cors" } })).toBeUndefined();
  });

  it("CDN: responde do cache na hora e atualiza em segundo plano", async () => {
    const cdn = { url: "https://cdn.jsdelivr.net/npm/chart.js", method: "GET", mode: "no-cors" };
    const first = await env.dispatch("fetch", { request: cdn });
    expect(await first.text()).toBe("net:https://cdn.jsdelivr.net/npm/chart.js");

    env.network.online = false;
    const second = await env.dispatch("fetch", { request: cdn });
    expect(await second.text()).toBe("net:https://cdn.jsdelivr.net/npm/chart.js");
  });

  it("ao ativar uma versão nova, apaga caches antigos", async () => {
    env.stores.set("aportfy-v0", new Map());
    await env.dispatch("activate");
    expect([...env.stores.keys()]).toEqual(["aportfy-v1"]);
  });
});
