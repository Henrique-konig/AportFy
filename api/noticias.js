// =========================================================
// AportFy — api/noticias.js (Vercel Serverless Function)
// Busca notícias por ticker na Alpha Vantage usando a chave guardada
// na variável de ambiente ALPHA_VANTAGE_KEY (Vercel > Settings >
// Environment Variables), para que ela nunca fique no código do
// navegador nem no repositório.
//
//   GET /api/noticias?tickers=PETR4,MXRF11
// =========================================================

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const TICKER_PATTERN = /^[A-Z0-9.\-]{1,12}$/;
const MAX_TICKERS = 20;

export default async function handler(req, res) {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) return res.status(503).json({ error: "no_key" });

  const tickers = [...new Set(String(req.query?.tickers || "").toUpperCase().split(",").map((t) => t.trim()).filter(Boolean))];
  if (tickers.length === 0 || tickers.length > MAX_TICKERS || !tickers.every((t) => TICKER_PATTERN.test(t))) {
    return res.status(400).json({ error: "Informe de 1 a 20 tickers válidos, separados por vírgula." });
  }

  try {
    const url = `${ALPHA_VANTAGE_URL}?function=NEWS_SENTIMENT&apikey=${encodeURIComponent(key)}&tickers=${encodeURIComponent(tickers.join(","))}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) return res.status(502).json({ error: "network_error" });

    const data = await upstream.json();
    // Limite diário ou chave inválida: a API responde 200 com "Note"/"Information" em vez de `feed`.
    if (data.Note || data.Information || !Array.isArray(data.feed)) return res.status(429).json({ error: "rate_limited" });

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=21600");
    return res.status(200).json({ feed: data.feed });
  } catch {
    return res.status(502).json({ error: "network_error" });
  }
}
