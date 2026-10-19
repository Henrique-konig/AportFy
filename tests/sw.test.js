// Testa as estratégias de cache do service worker (sw.js) num ambiente simulado:
// cache inicial, "rede primeiro" para o app, offline, /api fora do cache e CDN.
import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const source = readFileSync("sw.js", "utf8");
const ORIGIN = "https://aportfy.vercel.app";

function makeEnv({ online = true } = {}) {
  const stores = new Map(); // nome do cache -> Map(url -> Response)
  const handlers = {};
  const shown = []; // notificações exibidas
  const opened = []; // janelas abertas ao tocar
  const windows = []; // janelas do app já abertas
  const network = { online, calls: [], delay: 0 };

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
    if (network.delay) await new Promise((resolve) => setTimeout(resolve, network.delay));
    return new Response(`net:${keyOf(req)}`, { status: 200 });
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url) => void opened.push(url),
    },
    registration: { showNotification: async (title, options) => void shown.push({ title, options }) },
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
  return { stores, network, dispatch, request, shown, opened, windows };
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
    expect([...env.stores.keys()]).toEqual(["aportfy-v2"]);
  });
});

describe("notificações no service worker", () => {
  const pushEvent = (payload) => ({ data: { json: () => payload, text: () => JSON.stringify(payload) } });

  it("mostra a mensagem do FCM (campo data) com título, texto e link", async () => {
    const env = makeEnv();
    await env.dispatch("push", pushEvent({ data: { title: "Luz vence hoje", body: "R$ 200,00", tag: "bill-1", url: "/?view=bills" }, from: "123" }));
    expect(env.shown).toHaveLength(1);
    expect(env.shown[0].title).toBe("Luz vence hoje");
    expect(env.shown[0].options).toMatchObject({ body: "R$ 200,00", tag: "bill-1", data: { url: "/?view=bills" } });
  });

  it("aceita também o formato de notificação comum", async () => {
    const env = makeEnv();
    await env.dispatch("push", pushEvent({ notification: { title: "Oi", body: "Teste" } }));
    expect(env.shown[0]).toMatchObject({ title: "Oi", options: { body: "Teste" } });
  });

  it("ao tocar, abre o app na aba certa (ou reaproveita a janela aberta)", async () => {
    const env = makeEnv();
    const notification = { close: () => {}, data: { url: "/?view=bills" } };
    await env.dispatch("notificationclick", { notification });
    expect(env.opened).toEqual([`${ORIGIN}/?view=bills`]);

    const navigated = [];
    env.windows.push({ url: `${ORIGIN}/`, navigate: async (u) => void navigated.push(u), focus: async () => {} });
    await env.dispatch("notificationclick", { notification });
    expect(navigated).toEqual([`${ORIGIN}/?view=bills`]);
    expect(env.opened).toHaveLength(1);
  });
});

describe("service worker com rede lenta", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("com cópia guardada, não deixa o app esperando a rede lenta (usa a cópia depois do limite)", async () => {
    const env = makeEnv();
    await env.dispatch("install");
    await env.dispatch("fetch", { request: env.request("/js/app.js") }); // 1ª visita: guarda a cópia
    env.network.delay = 60000; // agora a rede está lentíssima

    const pending = env.dispatch("fetch", { request: env.request("/js/app.js") });
    await vi.advanceTimersByTimeAsync(3600);
    const res = await pending;
    expect(await res.text()).toBe(`net:${ORIGIN}/js/app.js`); // a cópia guardada, não a resposta (que nem chegou)
  });

  it("rede rápida continua tendo prioridade (sempre a versão mais nova)", async () => {
    const env = makeEnv();
    await env.dispatch("install");
    await env.dispatch("fetch", { request: env.request("/js/app.js") });
    env.network.delay = 100;
    const pending = env.dispatch("fetch", { request: env.request("/js/app.js") });
    await vi.advanceTimersByTimeAsync(150);
    expect((await pending).status).toBe(200);
    expect(env.network.calls.filter((u) => u.endsWith("/js/app.js")).length).toBe(2);
  });

  it("sem cópia guardada, espera a rede mesmo que demore", async () => {
    const env = makeEnv();
    env.network.delay = 8000;
    const pending = env.dispatch("fetch", { request: env.request("/js/novo.js") });
    await vi.advanceTimersByTimeAsync(9000);
    expect(await (await pending).text()).toBe(`net:${ORIGIN}/js/novo.js`);
  });

  it("guarda o CSS compilado do Tailwind para abrir offline", async () => {
    const env = makeEnv();
    await env.dispatch("install");
    const [name] = [...env.stores.keys()];
    expect([...env.stores.get(name).keys()].map((u) => new URL(u).pathname)).toContain("/css/tailwind.css");
  });
});
