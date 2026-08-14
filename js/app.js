// =========================================================
// EcoFy — app.js
// Ponto de entrada da aplicação: conecta auth.js, db.js e
// ui.js, registrando os event listeners da página.
// =========================================================

import {
  onAuthChange,
  login,
  register,
  logout,
  translateAuthError,
  updateDisplayName,
  requestPasswordReset,
} from "./auth.js";
import {
  listenToTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  listenToGoals,
  addGoal,
  updateGoal,
  deleteGoal,
  listenToInvestments,
  addInvestment,
  updateInvestment,
  deleteInvestment,
  listenToDividends,
  addDividend,
  deleteDividend,
  getUserProfile,
  upsertUserProfile,
  joinCouple,
} from "./db.js";
import { fetchQuotes, fetchDividendHistory, B3_CATEGORIES } from "./api.js";
import { fetchPortfolioNews, fetchMarketNews } from "./news.js";
import * as ui from "./ui.js";

/* ---------------------------------------------------------------
   Estado da aplicação
--------------------------------------------------------------- */
let unsubscribeTransactions = null;
let unsubscribeGoals = null;
let unsubscribeInvestments = null;
let unsubscribeDividends = null;
let activeUser = null;
let activeMode = "personal";
let activeCoupleId = null;
let latestTransactions = [];
let latestGoals = [];
let latestInvestments = [];
let latestDividends = [];
let quotesInFlight = false;

/** Últimos N pontos de preço mantidos por ativo (evita crescimento infinito do documento). */
const PRICE_HISTORY_LIMIT = 24;

/**
 * Anexa (ou atualiza, se já houver um ponto hoje) uma nova leitura de
 * preço ao histórico do ativo — é isso que alimenta o mini-gráfico de
 * "evolução do ativo" no card de detalhe.
 */
function buildPriceHistory(investment, price) {
  const today = new Date().toISOString().slice(0, 10);
  const history = Array.isArray(investment.priceHistory) ? [...investment.priceHistory] : [];
  if (history.length && history[history.length - 1].date === today) {
    history[history.length - 1] = { date: today, price };
  } else {
    history.push({ date: today, price });
  }
  return history.slice(-PRICE_HISTORY_LIMIT);
}

/* ---------------------------------------------------------------
   Inicialização de bindings de UI (executados uma única vez)
--------------------------------------------------------------- */
function initUIBindings() {
  ui.bindSidebarToggle();
  ui.bindTransactionModal();
  ui.bindGoalModal();
  ui.bindInvestmentModal();
  ui.bindPriceEditModal();
  ui.bindDividendModal();
  ui.bindImportDividends();
  ui.bindDeleteModal();
  ui.bindDatePickers();
  ui.bindCustomDropdowns();
  ui.bindSearch();
  ui.bindMobileSearch();
  ui.bindTransactionFilters();
  ui.bindInvestmentFilters();
  ui.bindSettingsForms();
  ui.bindNewsSubtabs();

  ui.onNavChange((view) => {
    ui.setActiveView(view);
    if (view === "investments") refreshQuotes({ silent: true });
    if (view === "news") loadNewsView();
  });
  ui.onModeToggle((mode) => switchMode(mode));

  ui.onLogoutClick(async () => {
    try {
      await logout();
      ui.showToast("Sessão encerrada com sucesso.", "info");
    } catch (err) {
      ui.showToast("Erro ao sair da conta.", "error");
    }
  });

  /* -------------------- Transações -------------------- */
  ui.onTransactionFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateTransaction(activeMode, id, editingId, data);
        ui.showToast("Transação atualizada com sucesso!", "success");
      } else {
        await addTransaction(activeMode, id, data);
        ui.showToast("Transação adicionada com sucesso!", "success");
      }
      ui.closeTransactionModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar transação.", "error");
    }
  });

  ui.onEditTransaction((transaction) => ui.openTransactionModal(transaction));

  /* -------------------- Metas -------------------- */
  ui.onGoalFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (editingId) {
        await updateGoal(activeMode, id, editingId, data);
        ui.showToast("Meta atualizada com sucesso!", "success");
      } else {
        await addGoal(activeMode, id, data);
        ui.showToast("Meta criada com sucesso!", "success");
      }
      ui.closeGoalModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar meta.", "error");
    }
  });

  ui.onEditGoal((goal) => ui.openGoalModal(goal));

  /* -------------------- Investimentos -------------------- */
  ui.onInvestmentFormSubmit(async (data, editingId) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;

      if (editingId) {
        // Edição direta: substitui os dados da posição (ticker, categoria,
        // quantidade, preço médio, data) pelos valores informados — sem
        // mesclar com nenhuma outra compra.
        await updateInvestment(activeMode, id, editingId, {
          ticker: data.ticker,
          category: data.category,
          quantity: data.quantity,
          avgPrice: data.price,
          purchaseDate: data.purchaseDate,
        });
        ui.showToast("Ativo atualizado com sucesso!", "success");
      } else {
        // Mesmo ativo já existe na carteira? Mescla a compra em vez de
        // criar uma posição duplicada, recalculando o preço médio:
        //   novoPM = (qtdAntiga*pmAntigo + qtdNova*precoNovo) / (qtdAntiga+qtdNova)
        const existing = latestInvestments.find(
          (inv) => inv.ticker.toUpperCase() === data.ticker.toUpperCase()
        );

        if (existing) {
          const oldQty = Number(existing.quantity) || 0;
          const oldAvg = Number(existing.avgPrice) || 0;
          const newQty = oldQty + data.quantity;
          const newAvg = (oldQty * oldAvg + data.quantity * data.price) / newQty;

          await updateInvestment(activeMode, id, existing.id, {
            quantity: newQty,
            avgPrice: newAvg,
            category: data.category,
            purchaseDate: data.purchaseDate > existing.purchaseDate ? data.purchaseDate : existing.purchaseDate,
          });
          ui.showToast(`Compra somada à posição de ${existing.ticker}. Preço médio recalculado.`, "success");
        } else {
          await addInvestment(activeMode, id, {
            ticker: data.ticker,
            category: data.category,
            quantity: data.quantity,
            avgPrice: data.price,
            currentPrice: data.price,
            purchaseDate: data.purchaseDate,
            lastQuoteAt: null,
            lastQuoteError: false,
          });
          ui.showToast("Investimento adicionado com sucesso!", "success");
        }
      }
      ui.closeInvestmentModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao salvar investimento.", "error");
    }
  });

  ui.onEditInvestment((investment) => ui.openInvestmentModal(investment));

  ui.onPriceEditSubmit(async (investmentId, price) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      const investment = latestInvestments.find((inv) => inv.id === investmentId);
      await updateInvestment(activeMode, id, investmentId, {
        currentPrice: price,
        lastQuoteError: false,
        priceHistory: investment ? buildPriceHistory(investment, price) : [{ date: new Date().toISOString().slice(0, 10), price }],
      });
      ui.showToast("Preço atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar preço.", "error");
    }
  });

  /* -------------------- Proventos -------------------- */
  ui.onDividendFormSubmit(async (data) => {
    try {
      const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      await addDividend(activeMode, id, data);
      ui.showToast("Provento registrado com sucesso!", "success");
      ui.closeDividendModal();
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao registrar provento.", "error");
    }
  });

  ui.onImportDividends(() => importDividendsFromB3());

  ui.elements.refreshQuotesBtn?.addEventListener("click", () => refreshQuotes({ silent: false }));

  ui.onFetchB3Price(async (ticker, category) => {
    ui.setB3PriceFetchLoading(true);
    try {
      const { prices, networkError } = await fetchQuotes([ticker]);
      const price = prices[ticker.toUpperCase()];
      if (typeof price === "number") {
        ui.fillInvestmentPrice(price);
      } else if (networkError) {
        ui.showInvestmentPriceHint("Sem conexão com a B3 agora. Informe o preço manualmente.", true);
      } else {
        ui.showInvestmentPriceHint(
          `Não foi possível buscar "${ticker}" na B3${category === "FIIs" ? " (FIIs exigem token da Brapi)" : ""}. Informe o preço manualmente.`,
          true
        );
      }
    } finally {
      ui.setB3PriceFetchLoading(false);
    }
  });

  /* -------------------- Exclusão genérica -------------------- */
  ui.onDeleteConfirm(async (id, type) => {
    try {
      const collectionId = activeMode === "couple" ? activeCoupleId : activeUser.uid;
      if (type === "goal") {
        await deleteGoal(activeMode, collectionId, id);
        ui.showToast("Meta excluída.", "success");
      } else if (type === "investment") {
        await deleteInvestment(activeMode, collectionId, id);
        ui.showToast("Ativo excluído.", "success");
      } else if (type === "dividend") {
        await deleteDividend(activeMode, collectionId, id);
        ui.showToast("Provento excluído.", "success");
      } else {
        await deleteTransaction(activeMode, collectionId, id);
        ui.showToast("Transação excluída.", "success");
      }
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao excluir item.", "error");
    }
  });

  /* -------------------- Configurações -------------------- */
  ui.onProfileUpdate(async (displayName) => {
    try {
      await updateDisplayName(displayName);
      await upsertUserProfile(activeUser.uid, { displayName });
      ui.showAppShell({ ...activeUser, displayName });
      ui.showToast("Perfil atualizado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao atualizar perfil.", "error");
    }
  });

  ui.onJoinCouple(async (coupleId) => {
    try {
      await joinCouple(activeUser.uid, coupleId);
      activeCoupleId = coupleId;
      ui.renderCoupleSettings(activeCoupleId);
      if (activeMode === "couple") subscribeToActiveCollection();
      ui.showToast("Você entrou no espaço de casal com sucesso!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao entrar no espaço de casal.", "error");
    }
  });

  ui.onPasswordReset(async () => {
    try {
      await requestPasswordReset(activeUser.email);
      ui.showToast("E-mail de redefinição enviado!", "success");
    } catch (err) {
      console.error(err);
      ui.showToast("Erro ao enviar e-mail de redefinição.", "error");
    }
  });

  ui.onExportBackup(() => exportBackup());
  ui.onImportBackup((file) => importBackup(file));

  /* -------------------- Auth screen -------------------- */
  ui.elements.toggleAuthModeBtn.addEventListener("click", () => ui.toggleAuthMode());

  ui.elements.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    ui.clearAuthError();
    ui.setAuthLoading(true);

    const email = ui.elements.loginEmail.value.trim();
    const password = ui.elements.loginPassword.value;

    try {
      if (ui.getIsRegisterMode()) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      ui.showAuthError(translateAuthError(err));
    } finally {
      ui.setAuthLoading(false);
    }
  });

  ui.initCharts();
  ui.initReportsCharts();
  ui.initInvestmentCharts();
  ui.initAssetDetailChart();
  ui.initDividendsChart();
}

/* ---------------------------------------------------------------
   Cotações automáticas da B3 (Brapi)
--------------------------------------------------------------- */
async function refreshQuotes({ silent }) {
  if (quotesInFlight) return;

  const eligible = latestInvestments.filter((inv) => B3_CATEGORIES.includes(inv.category));
  if (eligible.length === 0) {
    if (!silent) ui.showToast("Nenhum ativo da B3 (Ações/FIIs) para atualizar.", "info");
    return;
  }

  quotesInFlight = true;
  ui.setQuotesLoading(true);

  try {
    const tickers = eligible.map((inv) => inv.ticker);
    const { prices, failedTickers, networkError } = await fetchQuotes(tickers);
    const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;

    let updated = 0;
    await Promise.all(
      eligible.map(async (inv) => {
        const price = prices[inv.ticker.toUpperCase()];
        if (typeof price === "number") {
          await updateInvestment(activeMode, id, inv.id, {
            currentPrice: price,
            lastQuoteAt: new Date().toISOString(),
            lastQuoteError: false,
            priceHistory: buildPriceHistory(inv, price),
          });
          updated++;
        } else {
          // Falha nesse ticker específico: mantém o último currentPrice
          // salvo e só sinaliza o alerta visual na linha do ativo.
          await updateInvestment(activeMode, id, inv.id, { lastQuoteError: true });
        }
      })
    );

    if (networkError) {
      ui.showToast("Não foi possível conectar à B3 agora. Mantendo os últimos preços salvos.", "error");
    } else if (updated > 0) {
      const failMsg = failedTickers.length ? ` (${failedTickers.length} ticker(s) não encontrado(s))` : "";
      ui.showToast(`${updated} cotação(ões) atualizada(s)${failMsg}.`, "success");
    } else {
      ui.showToast("Não foi possível atualizar nenhuma cotação. Mantendo os últimos preços salvos.", "error");
    }
  } catch (err) {
    console.error(err);
    ui.showToast("Erro ao buscar cotações da B3.", "error");
  } finally {
    quotesInFlight = false;
    ui.setQuotesLoading(false);
  }
}

/* ---------------------------------------------------------------
   Backup e Restauração
--------------------------------------------------------------- */
function serializeForBackup(items) {
  return items.map((item) => {
    const clean = { ...item };
    // createdAt vem como Timestamp do Firestore — vira ISO pra ficar
    // legível/portável no JSON exportado.
    if (clean.createdAt && typeof clean.createdAt.toDate === "function") {
      clean.createdAt = clean.createdAt.toDate().toISOString();
    }
    return clean;
  });
}

function exportBackup() {
  const payload = {
    app: "EcoFy",
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    mode: activeMode,
    transactions: serializeForBackup(latestTransactions),
    goals: serializeForBackup(latestGoals),
    investments: serializeForBackup(latestInvestments),
    dividends: serializeForBackup(latestDividends),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ecofy-backup-${activeMode}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  ui.showToast("Backup baixado com sucesso!", "success");
}

// Mapeia cada categoria do backup pra função de escrita já existente —
// reimportar cria documentos novos (id e createdAt são regenerados).
const BACKUP_IMPORTERS = {
  transactions: addTransaction,
  goals: addGoal,
  investments: addInvestment,
  dividends: addDividend,
};

async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    ui.showToast("Arquivo inválido — não é um JSON de backup do EcoFy.", "error");
    return;
  }

  const counts = Object.fromEntries(
    Object.keys(BACKUP_IMPORTERS).map((key) => [key, Array.isArray(data[key]) ? data[key].length : 0])
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    ui.showToast("Nenhum registro encontrado nesse arquivo.", "error");
    return;
  }

  const modeLabel = activeMode === "couple" ? "Casal" : "Pessoal";
  const confirmed = window.confirm(
    `Restaurar vai ADICIONAR ${counts.transactions} transação(ões), ${counts.goals} meta(s), ${counts.investments} ativo(s) e ${counts.dividends} provento(s) aos dados atuais do modo ${modeLabel}. Isso não apaga nada existente. Continuar?`
  );
  if (!confirmed) return;

  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  let imported = 0;
  let failed = 0;

  for (const [key, addFn] of Object.entries(BACKUP_IMPORTERS)) {
    for (const item of data[key] || []) {
      try {
        const { id: _discardId, createdAt: _discardCreatedAt, ...rest } = item;
        await addFn(activeMode, id, rest);
        imported++;
      } catch (err) {
        console.error(err);
        failed++;
      }
    }
  }

  if (failed === 0) {
    ui.showToast(`Backup restaurado: ${imported} registro(s) adicionado(s).`, "success");
  } else {
    ui.showToast(`Restaurado ${imported} registro(s), ${failed} falharam.`, "error");
  }
}

/* ---------------------------------------------------------------
   Notícias (Alpha Vantage) — mercado geral + ativos da carteira
--------------------------------------------------------------- */
function newsErrorMessage(reason, target) {
  if (reason === "no_key") {
    return {
      title: "Busca de notícias ainda não configurada.",
      desc: "Cadastre uma chave gratuita em alphavantage.co e cole em ALPHA_VANTAGE_KEY (js/news.js) para ativar este feed.",
    };
  }
  if (reason === "rate_limited") {
    return {
      title: "Limite diário de requisições da API atingido.",
      desc: "O plano gratuito da Alpha Vantage libera 25 buscas por dia. Tente novamente amanhã.",
    };
  }
  return target === "portfolio"
    ? {
        title: "Nenhuma notícia encontrada para os ativos da sua carteira.",
        desc: "Cobertura de tickers da B3 é limitada nessa API — tente novamente mais tarde.",
      }
    : { title: "Não foi possível carregar as notícias agora.", desc: "Verifique sua conexão e tente novamente." };
}

async function loadNewsView() {
  // Mercado Diário independe da carteira — dispara em paralelo com a busca por ativo.
  ui.renderNewsSkeletons("market", 6);
  fetchMarketNews().then((res) => {
    ui.renderNewsCards("market", res.items, res.ok ? null : newsErrorMessage(res.reason, "market"));
  });

  const tickers = latestInvestments.map((inv) => inv.ticker);
  if (tickers.length === 0) {
    ui.renderNewsCards("portfolio", [], {
      title: "Nenhum ativo cadastrado ainda.",
      desc: "Adicione ativos em Investimentos para ver notícias específicas da sua carteira aqui.",
    });
    return;
  }

  ui.renderNewsSkeletons("portfolio", 6);
  const res = await fetchPortfolioNews(tickers);
  ui.renderNewsCards("portfolio", res.items, res.ok ? null : newsErrorMessage(res.reason, "portfolio"));
}

/* ---------------------------------------------------------------
   Importação automática de proventos da B3 (Brapi)
--------------------------------------------------------------- */

// FIIs exigem token pago na Brapi para o histórico de rendimentos —
// só Ações têm esse endpoint liberado no plano gratuito.
const DIVIDEND_IMPORT_CATEGORIES = ["Ações"];

async function importDividendsFromB3() {
  const eligible = latestInvestments.filter((inv) => DIVIDEND_IMPORT_CATEGORIES.includes(inv.category));
  if (eligible.length === 0) {
    ui.showToast("Nenhuma ação cadastrada para importar proventos (FIIs exigem token pago na Brapi).", "info");
    return;
  }

  ui.setImportDividendsLoading(true);

  try {
    const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
    // Evita reimportar o mesmo provento a cada clique.
    const existingKeys = new Set(latestDividends.map((d) => `${d.ticker}|${d.date}|${d.type}`));

    let imported = 0;
    let importedTotal = 0;
    let anyFetchFailed = false;

    for (const inv of eligible) {
      const { dividends, ok } = await fetchDividendHistory(inv.ticker);
      if (!ok) {
        anyFetchFailed = true;
        continue;
      }

      for (const d of dividends) {
        // Só proventos pagos depois da compra: antes disso o usuário ainda
        // não era dono do ativo na data-base do provento.
        if (d.date < inv.purchaseDate) continue;

        const key = `${inv.ticker}|${d.date}|${d.type}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        // Aproximação: usa a quantidade de cotas atual do usuário, já que
        // não guardamos quantas cotas ele tinha exatamente em cada data-base.
        const amount = d.amount * (Number(inv.quantity) || 0);
        await addDividend(activeMode, id, { ticker: inv.ticker, type: d.type, amount, date: d.date });
        imported++;
        importedTotal += amount;
      }
    }

    if (imported > 0) {
      ui.showToast(
        `${imported} provento(s) importado(s) da B3 (R$ ${importedTotal.toFixed(2).replace(".", ",")} no total).`,
        "success"
      );
    } else if (anyFetchFailed) {
      ui.showToast("Não foi possível buscar proventos na B3 agora.", "error");
    } else {
      ui.showToast("Nenhum provento novo encontrado na B3 para importar.", "info");
    }
  } catch (err) {
    console.error(err);
    ui.showToast("Erro ao importar proventos da B3.", "error");
  } finally {
    ui.setImportDividendsLoading(false);
  }
}

/* ---------------------------------------------------------------
   Assinatura de dados (Firestore) de acordo com o modo ativo
--------------------------------------------------------------- */
function refreshDashboard() {
  ui.updateKPIs(latestTransactions, latestGoals);
  ui.renderTransactionsTable(latestTransactions);
  ui.renderFullTransactionsTable(latestTransactions);
  ui.updateCharts(latestTransactions);
  ui.renderReports(latestTransactions);
}

function subscribeToActiveCollection() {
  if (unsubscribeTransactions) {
    unsubscribeTransactions();
    unsubscribeTransactions = null;
  }
  if (unsubscribeGoals) {
    unsubscribeGoals();
    unsubscribeGoals = null;
  }
  if (unsubscribeInvestments) {
    unsubscribeInvestments();
    unsubscribeInvestments = null;
  }
  if (unsubscribeDividends) {
    unsubscribeDividends();
    unsubscribeDividends = null;
  }

  const id = activeMode === "couple" ? activeCoupleId : activeUser.uid;
  if (!id) return;

  unsubscribeTransactions = listenToTransactions(activeMode, id, (transactions, error) => {
    if (error) {
      ui.showToast("Erro ao carregar transações em tempo real.", "error");
      return;
    }
    latestTransactions = transactions;
    refreshDashboard();
  });

  unsubscribeGoals = listenToGoals(activeMode, id, (goals, error) => {
    if (error) {
      ui.showToast("Erro ao carregar metas em tempo real.", "error");
      return;
    }
    latestGoals = goals;
    ui.renderGoals(goals);
    ui.updateKPIs(latestTransactions, latestGoals);
  });

  unsubscribeInvestments = listenToInvestments(activeMode, id, (investments, error) => {
    if (error) {
      ui.showToast("Erro ao carregar investimentos em tempo real.", "error");
      return;
    }
    latestInvestments = investments;
    ui.renderInvestments(investments);
  });

  unsubscribeDividends = listenToDividends(activeMode, id, (dividends, error) => {
    if (error) {
      ui.showToast("Erro ao carregar proventos em tempo real.", "error");
      return;
    }
    latestDividends = dividends;
    ui.renderDividendsData(dividends);
  });
}

/**
 * Garante que o usuário possua um coupleId associado ao seu perfil.
 * Caso não exista, cria um espaço de "casal" vinculado ao próprio
 * usuário, que pode ser compartilhado com o parceiro(a) posteriormente.
 */
async function ensureCoupleId(user) {
  const profile = await getUserProfile(user.uid);
  if (profile?.coupleId) return profile.coupleId;

  const newCoupleId = user.uid;
  await upsertUserProfile(user.uid, { coupleId: newCoupleId, email: user.email });
  return newCoupleId;
}

async function switchMode(mode) {
  if (mode === activeMode) return;
  activeMode = mode;
  ui.setActiveMode(mode);
  subscribeToActiveCollection();
}

/* ---------------------------------------------------------------
   Reação ao estado de autenticação
--------------------------------------------------------------- */
onAuthChange(async (user) => {
  if (user) {
    activeUser = user;
    activeMode = "personal";
    activeCoupleId = null;

    ui.showAppShell(user);
    ui.setActiveMode("personal");
    ui.setActiveView("dashboard");
    ui.renderProfileSettings(user);

    try {
      await upsertUserProfile(user.uid, { email: user.email, lastLoginAt: new Date().toISOString() });
      activeCoupleId = await ensureCoupleId(user);
      ui.renderCoupleSettings(activeCoupleId);
    } catch (err) {
      console.warn("Não foi possível preparar o perfil/espaço de casal do usuário:", err);
    }

    subscribeToActiveCollection();
  } else {
    activeUser = null;
    activeCoupleId = null;
    latestTransactions = [];
    latestGoals = [];
    latestInvestments = [];
    latestDividends = [];
    if (unsubscribeTransactions) {
      unsubscribeTransactions();
      unsubscribeTransactions = null;
    }
    if (unsubscribeGoals) {
      unsubscribeGoals();
      unsubscribeGoals = null;
    }
    if (unsubscribeInvestments) {
      unsubscribeInvestments();
      unsubscribeInvestments = null;
    }
    if (unsubscribeDividends) {
      unsubscribeDividends();
      unsubscribeDividends = null;
    }
    ui.showLoginScreen();
  }
});

/* ---------------------------------------------------------------
   Bootstrap
--------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initUIBindings();
});
