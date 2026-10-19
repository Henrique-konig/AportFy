// =========================================================
// AportFy — format.js
// Formatação de números e datas em pt-BR com formatadores reaproveitados.
// Criar um Intl.NumberFormat / toLocaleString(opções) a cada chamada custa ~40x mais que reutilizar
// um formatador pronto — e uma tabela de 600 linhas formata milhares de valores a cada desenho.
// Sem DOM: serve também às funções serverless.
// =========================================================

const numberFormatters = new Map();
const dateFormatters = new Map();

/** Igual a `numero.toLocaleString("pt-BR", opcoes)`, com o formatador guardado para a próxima vez. */
export function fmtNum(value, options) {
  const key = options ? JSON.stringify(options) : "";
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", options);
    numberFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** Igual a `data.toLocaleDateString("pt-BR", opcoes)`, com o formatador guardado para a próxima vez. */
export function fmtDate(date, options) {
  const key = options ? JSON.stringify(options) : "";
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("pt-BR", options);
    dateFormatters.set(key, formatter);
  }
  return formatter.format(date);
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 1.234,56" */
export const formatBRL = (value) => BRL.format(value || 0);

const PER_SHARE = { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 };

/** Valor por cota/ação, com até 4 casas: "R$ 0,0830" */
export const formatPerShare = (value) => fmtNum(value, PER_SHARE);

/** Mês abreviado sem o ponto final: "out" */
export const monthShort = (date) => fmtDate(date, { month: "short" }).replace(".", "");
