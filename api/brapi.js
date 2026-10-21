// =========================================================
// AportFy — api/brapi.js (Vercel Serverless Function)
// Proxy da Brapi (cotações e proventos de Ações/FIIs). Existe para:
//   - manter a chave da Brapi (variável BRAPI_TOKEN) só no servidor, nunca no código do site;
//   - guardar as respostas em cache na rede da Vercel: muitos usuários pedindo o mesmo ticker
//     viram uma só chamada à Brapi (que tem limite no plano gratuito).
//
//   GET /api/brapi?kind=quote&symbol=PETR4
//   GET /api/brapi?kind=quote&symbol=PETR4&dividends=true
//   GET /api/brapi?kind=list&search=MXRF11
//
// Só aceita essas formas (nada de repassar caminhos arbitrários) e responde com o JSON da
// Brapi sem alterações. O cabeçalho x-aportfy-proxy permite ao site saber que foi esta função
// que respondeu (e não, por exemplo, um servidor estático sem /api, onde ele cai na Brapi direta).
// =========================================================

const BRAPI_BASE = "https://brapi.dev/api";
const SYMBOL_PATTERN = /^[A-Z0-9]{4,8}$/;

/** Monta a URL da Brapi para um pedido válido, ou devolve um erro de entrada. */
export function buildBrapiUrl(query, token) {
  const kind = String(query?.kind || "");
  const params = new URLSearchParams();
  let path;

  if (kind === "quote") {
    const symbol = String(query?.symbol || "").toUpperCase().trim();
    if (!SYMBOL_PATTERN.test(symbol)) return { error: "Ticker inválido." };
    path = `/quote/${symbol}`;
    if (String(query?.dividends || "") === "true") params.set("dividends", "true");
  } else if (kind === "list") {
    const search = String(query?.search || "").toUpperCase().trim();
    if (!SYMBOL_PATTERN.test(search)) return { error: "Busca inválida." };
    path = "/quote/list";
    params.set("search", search);
  } else {
    return { error: "Tipo de pedido inválido." };
  }

  if (token) params.set("token", token);
  const qs = params.toString();
  return { url: `${BRAPI_BASE}${path}${qs ? `?${qs}` : ""}`, cacheSeconds: kind === "quote" && params.get("dividends") ? 3600 : 60 };
}

export default async function handler(req, res) {
  res.setHeader("x-aportfy-proxy", "brapi");
  const built = buildBrapiUrl(req.query, process.env.BRAPI_TOKEN);
  if (built.error) return res.status(400).json({ error: built.error });

  try {
    const upstream = await fetch(built.url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    const body = await upstream.text();
    // Só guarda em cache o que deu certo: um erro momentâneo não pode ficar preso por minutos.
    if (upstream.ok) res.setHeader("Cache-Control", `public, s-maxage=${built.cacheSeconds}, stale-while-revalidate=${built.cacheSeconds * 10}`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: "Não foi possível consultar a Brapi agora." });
  }
}
