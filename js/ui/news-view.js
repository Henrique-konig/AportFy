// =========================================================
// AportFy — ui/news-view.js
// Aba Notícias.
// =========================================================

import { el, escapeHtml, getModeColor, state } from "./core.js";
import { fmtDate } from "../format.js";

/* ---------------------------------------------------------------
   Notícias (view: Notícias)
--------------------------------------------------------------- */
export function bindNewsSubtabs() {
  el.newsTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.newsTabBtns.forEach((b) => b.classList.toggle("active-news-tab", b === btn));
      const tab = btn.dataset.newsTab;
      el.newsPanelPortfolio.classList.toggle("hidden", tab !== "portfolio");
      el.newsPanelMarket.classList.toggle("hidden", tab !== "market");
    });
  });
}

export function newsSkeletonCardHtml() {
  return `
    <div class="glass-card rounded-2xl overflow-hidden">
      <div class="skeleton w-full h-40" style="border-radius:0;"></div>
      <div class="p-4 space-y-2.5">
        <div class="skeleton h-4 w-3/4"></div>
        <div class="skeleton h-4 w-1/2"></div>
        <div class="skeleton h-3 w-full mt-2"></div>
      </div>
    </div>`;
}

export function newsCardHtml(item) {
  const modeColor = getModeColor();
  const dateLabel = item.publishedAt
    ? fmtDate(new Date(item.publishedAt), { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const badges = (item.tickers || [])
    .slice(0, 3)
    .map(
      (t) =>
        `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${modeColor}22; color:${modeColor};">${escapeHtml(t)}</span>`
    )
    .join("");
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="" class="w-full h-40 object-cover" loading="lazy" onerror="this.remove()" />`
    : `<div class="w-full h-40 bg-slate-800/60 flex items-center justify-center"><i class="ph-thin ph-newspaper text-4xl text-slate-700"></i></div>`;

  return `
    <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"
      class="news-card glass-card rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all">
      ${image}
      <div class="p-4 flex flex-col flex-1">
        ${badges ? `<div class="flex flex-wrap gap-1.5 mb-2">${badges}</div>` : ""}
        <h4 class="font-bold text-white text-sm leading-snug line-clamp-3 mb-2">${escapeHtml(item.title)}</h4>
        <div class="mt-auto flex items-center justify-between text-xs text-slate-400 pt-2 gap-2">
          <span class="truncate">${escapeHtml(item.source)}</span>
          <span class="shrink-0">${dateLabel}</span>
        </div>
        <span class="text-xs font-semibold mt-2 flex items-center gap-1" style="color:${modeColor};">
          Ler mais <i class="ph-bold ph-arrow-up-right"></i>
        </span>
      </div>
    </a>`;
}

export function newsRefs(target) {
  return target === "portfolio"
    ? { grid: el.newsPortfolioGrid, empty: el.newsPortfolioEmpty, emptyTitle: el.newsPortfolioEmptyTitle, emptyDesc: el.newsPortfolioEmptyDesc }
    : { grid: el.newsMarketGrid, empty: el.newsMarketEmpty, emptyTitle: el.newsMarketEmptyTitle, emptyDesc: el.newsMarketEmptyDesc };
}

/** Mostra skeletons piscando enquanto a busca de notícias está em andamento. */
export function renderNewsSkeletons(target, count = 6) {
  const { grid, empty } = newsRefs(target);
  empty.classList.add("hidden");
  empty.classList.remove("flex");
  grid.innerHTML = Array.from({ length: count }, newsSkeletonCardHtml).join("");
}

/**
 * Renderiza os cards de notícia (ou o estado vazio) no grid indicado.
 * @param {"portfolio"|"market"} target
 * @param {object[]} items
 * @param {{title:string, desc:string}|null} emptyMessage - sobrescreve o texto do estado vazio (ex: aviso de API sem chave configurada)
 */
export function renderNewsCards(target, items, emptyMessage = null) {
  const { grid, empty, emptyTitle, emptyDesc } = newsRefs(target);

  if (target === "portfolio") state.lastNewsPortfolio = items || [];
  else state.lastNewsMarket = items || [];

  if (!items || items.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    empty.classList.add("flex");
    if (emptyMessage) {
      emptyTitle.textContent = emptyMessage.title;
      emptyDesc.textContent = emptyMessage.desc;
    }
    return;
  }

  empty.classList.add("hidden");
  empty.classList.remove("flex");
  grid.innerHTML = items.map(newsCardHtml).join("");
}

