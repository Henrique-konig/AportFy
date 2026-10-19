// =========================================================
// AportFy — gate.js
// Filtro para os avisos em tempo real do Firestore. Cada coleção avisa duas vezes ao abrir
// (primeiro o cache do aparelho, depois o servidor) e, numa gravação em lote — ex: o refresh de
// cotações, que salva um ativo por vez —, avisa uma vez por documento. Sem filtro, cada aviso
// redesenhava a tela inteira. Aqui:
//   - dados iguais aos da última vez são ignorados;
//   - avisos em rajada viram um só redesenho, com os dados mais recentes.
// O primeiro aviso passa na hora (nada de atraso ao abrir) e erros nunca são segurados.
// =========================================================

/**
 * @param {(data:any, error?:any, meta?:any) => void} apply o que redesenhar
 * @param {() => number} getGeneration muda quando a assinatura é trocada (logout, troca de modo):
 *   avisos que estavam à espera de uma assinatura antiga são descartados
 * @param {{ wait?: number, now?: () => number, schedule?: Function, cancel?: Function }} [options]
 * @returns {((data:any, error?:any, meta?:any) => void) & { flush: () => void }}
 */
export function createGate(apply, getGeneration = () => 0, { wait = 150, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout } = {}) {
  const generation = getGeneration();
  let lastSignature = null;
  let lastRun = -Infinity;
  let timer = null;
  let pending = null;

  const run = () => {
    timer = null;
    const args = pending;
    pending = null;
    if (!args || generation !== getGeneration()) return;
    lastRun = now();
    apply(...args);
  };

  const gate = (data, error, meta) => {
    if (generation !== getGeneration()) return;
    if (error) return apply(data, error, meta);

    // "fromCache" entra na assinatura: o mesmo dado confirmado pelo servidor é uma informação nova.
    const signature = `${meta?.fromCache ? "c" : "s"}${JSON.stringify(data)}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    pending = [data, error, meta];

    if (timer) return; // já há um redesenho agendado: ele usará estes dados mais novos
    const elapsed = now() - lastRun;
    if (elapsed >= wait) run();
    else timer = schedule(run, wait - elapsed);
  };

  /** Aplica já o que estiver à espera (útil em testes e ao fechar a tela). */
  gate.flush = () => {
    if (timer) {
      cancel(timer);
      timer = null;
    }
    run();
  };
  return gate;
}
