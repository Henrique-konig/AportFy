// =========================================================
// AportFy — api/erros.js (Vercel Serverless Function)
// Recebe os avisos de erro do navegador (js/errors.js) e os escreve nos Logs da Vercel
// (Projeto > Logs, filtrar por "erro-cliente"). Aceita só POST pequeno e limpa os campos.
// =========================================================

const clip = (value, max) => String(value ?? "").replace(/[\r\n]+/g, " ⏎ ").slice(0, max);

/** Mantém só os campos esperados, com tamanho limitado. Devolve null se não houver mensagem. */
export function sanitize(body) {
  if (!body || typeof body !== "object") return null;
  const message = clip(body.message, 300);
  if (!message) return null;
  return {
    kind: body.kind === "promise" ? "promise" : "error",
    message,
    stack: clip(body.stack, 1500),
    page: clip(body.page, 100),
    ua: clip(body.ua, 160),
  };
}

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const entry = sanitize(body);
  if (!entry) return res.status(400).json({ error: "Aviso inválido." });
  console.error("[erro-cliente]", JSON.stringify(entry));
  return res.status(204).end();
}
