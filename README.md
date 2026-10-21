<div align="center">

# AportFy

**Controle financeiro pessoal e de casal, com carteira de investimentos e dados em tempo real.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?logo=chartdotjs&logoColor=white)
![Vitest](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)
![Vercel](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Sumário

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar localmente](#como-rodar-localmente)
- [Configuração](#configuração)
- [Modelo de dados](#modelo-de-dados)
- [Segurança](#segurança)
- [Testes](#testes)
- [Deploy](#deploy)
- [Decisões de projeto](#decisões-de-projeto)
- [Limitações conhecidas](#limitações-conhecidas)
- [Licença](#licença)

## Sobre

O AportFy reúne em um só painel o dia a dia financeiro (receitas, despesas, metas e orçamento) e o acompanhamento de uma carteira de investimentos — compras, vendas, proventos, histórico de movimentações e um diagnóstico da saúde da carteira —, com atualização em tempo real via Firestore. Funciona em dois modos: **Pessoal** (dados só seus) e **Casal** (dados compartilhados com outra pessoa).

É uma aplicação 100% estática: HTML, CSS e JavaScript em ES Modules nativos, sem bundler e sem etapa de build.

## Funcionalidades

**Dashboard**
- KPIs de saldo, receitas, despesas e progresso de metas, com comparação em relação ao mês anterior.
- Filtro por mês/ano ou **Todos os meses** (acumulado). Ao escolher um mês, o saldo mostra o resultado daquele mês.
- Fluxo de caixa dos últimos 6 meses e despesas por categoria do período selecionado.
- **Saldo projetado do mês:** quanto deve sobrar no fim do mês, somando o que já entrou e saiu com o que ainda vai entrar e sair (transações com data futura, recorrências, contas e faturas a vencer), com a lista dos próximos lançamentos.
- **Reserva de emergência:** quantos meses de despesas a sua reserva cobre (média dos últimos 3 meses) e quanto falta para a meta (3, 6, 9 ou 12 meses). Você escolhe onde está a reserva: metas, investimentos e/ou um valor digitado.
- **Primeiros passos:** para quem está começando, um roteiro curto (primeira transação, primeiro investimento, metas de alocação, instalar o app) que some quando tudo é feito ou ao dispensar.
- **Central de alertas** (sino no cabeçalho): proventos a receber e recebidos, orçamentos estourando, metas perto do prazo, cotações desatualizadas, problemas de saúde da carteira e pedidos de entrada no Modo Casal.

**Transações**
- Cadastro, edição e exclusão de receitas e despesas.
- Filtros por tipo, categoria e mês, busca por texto e paginação ("Carregar mais").
- Total gasto do período filtrado.
- **Transações recorrentes** lançadas automaticamente todo mês, na data configurada.

**Contas e Cartões**
- **Contas a pagar** com vencimento, categoria e situação (vencida, vence em breve, a pagar, paga). Podem ser únicas, **mensais** (ao pagar, a do mês seguinte já é criada) ou **parceladas** (uma conta por mês).
- Ao marcar como paga, a despesa entra sozinha nas transações; dá para desfazer.
- **Cartões de crédito** com dia de fechamento, vencimento e limite. Compras **parceladas** em até 72x: cada parcela cai na fatura certa (compras a partir do fechamento vão para a fatura seguinte).
- **Faturas** mês a mês (aberta, fechada, vencida, paga), limite usado e disponível. Pagar a fatura lança **uma despesa por categoria** (a lista não enche de parcelas), então orçamentos e relatórios continuam certos.
- Contas e faturas vencendo ou vencidas aparecem no sino e nas notificações.

**Metas e Orçamento**
- Metas com valor-alvo, progresso e prazo.
- Limite de gasto por categoria, com acompanhamento do consumo no mês.

**Investimentos**
- Carteira por ativo, com preço médio recalculado a cada nova compra do mesmo ativo.
- **Vendas:** registro de venda parcial ou total com o lucro/prejuízo realizado (o preço médio não muda na venda). Posições vendidas por completo saem da carteira, mas continuam no Histórico.
- Cotações automáticas de **Ações e FIIs da B3** (Brapi) e de **Criptomoedas** em reais (Binance, com a CoinGecko como reserva), com fallback para o último preço salvo.
- **Carteira × Mercado:** quanto o seu dinheiro teria rendido se cada aporte (e cada venda) tivesse ido para o **CDI**, o **Ibovespa** ou o **IFIX** nas mesmas datas, comparado ao resultado real da carteira.
- **Aportes mensais:** quanto foi investido em cada um dos últimos 12 meses, com média e filtro por ativo.
- Evolução do capital por categoria, alocação da carteira e detalhe do ativo com histórico de preço.
- Busca, filtros por categoria e ativo e ordenação, aplicados a tabela, indicadores e gráficos.

**Proventos** (dividendos, JCP e rendimentos)
- **Recebidos e a receber:** painel com os proventos já pagos e os já anunciados de Ações e FIIs (dados da B3), com abas, filtro por mês e total de cada lado. O valor é o provento por cota × as cotas que você tinha na data-com; o JCP é calculado líquido de 15% de IR.
- **Importação automática:** os pagos são lançados sozinhos. O que você excluir não volta; o botão "Importar da B3" força uma nova busca.
- **Calendário de proventos:** visão mensal com os dias de pagamento, total recebido e a receber do mês e o detalhe de cada dia.
- Gráfico mensal com o recebido e o que ainda vai cair, histórico com filtro por mês, registro manual e yield on cost.

**Histórico**
- Linha do tempo de compras, vendas e proventos, agrupada por mês, no estilo de extrato.
- Filtros por tipo (compras, vendas, proventos), ativo, mês e busca, com totais comprados, vendidos, proventos recebidos e resultado das vendas.

**Notícias**
- *Minha Carteira*: notícias filtradas pelos ativos cadastrados (Alpha Vantage).
- *Mercado Diário*: manchetes do mercado em pt-BR (Google News RSS).

**Relatórios**
- Receitas, despesas e economia líquida por mês/ano ou acumulado, maiores categorias e maiores despesas, e fluxo de caixa de 12 meses.
- **Exportar:** CSV das transações do período (abre direto no Excel, com vírgula decimal) e PDF do relatório (pela impressão do navegador, só com a aba Relatórios, em fundo branco).

**Saúde da Carteira**
- Nota de 0 a 100 com quatro componentes: alinhamento às metas por categoria, concentração por ativo, diversificação (número efetivo de ativos) e dependência de poucos pagadores de proventos.
- Diagnóstico com alertas, distribuição atual × meta por categoria e peso de cada ativo frente ao seu limite.
- **Onde aportar:** como dividir o próximo aporte entre categorias para se aproximar das metas, sem vender nada.
- **Projeção** em 1 a 30 anos com aporte mensal, valorização e dividend yield (pré-preenchidos com os dados reais da carteira), em cenários pessimista, base e otimista.
- **Independência financeira:** informe a renda mensal desejada e veja o patrimônio necessário para viver dos proventos (pelo dividend yield da projeção), quanto falta e em quanto tempo você chega lá com os aportes e a valorização da projeção.
- Metas de alocação configuráveis (perfis Conservador, Moderado e Arrojado como ponto de partida, ou personalizadas). A análise é educativa e não indica ativos específicos.

**Conta e dados**
- Login com e-mail e senha ou **com Google** (o e-mail já vem verificado, sem depender do e-mail de confirmação), perfil e redefinição de senha por e-mail (em Configurações). Contas novas exigem senha de 8+ caracteres com letras e números e **confirmação do e-mail** (um aviso no topo permite reenviar o link).
- **Excluir conta** (em Configurações): apaga todos os seus dados e a conta, pedindo a senha para confirmar.
- **Espaço do Casal**: o parceiro(a) usa o seu código para **pedir** entrada e você aprova ou recusa em Configurações; só quem você aprovar vê os mesmos dados no Modo Casal. Para pedir entrada é preciso ter o e-mail confirmado.
- **Backup e restauração** de transações, metas, investimentos, proventos, **contas, cartões, compras e faturas** em arquivo `.json`. Ao restaurar, cartões ganham ids novos e as compras e faturas são religadas a eles.

**App e acessibilidade**
- **Instalável (PWA):** pode ser instalado no celular ou no computador e abre como aplicativo; a interface carrega mesmo sem internet e os dados já vistos ficam disponíveis offline (cache do Firestore).
- **Tema claro, escuro ou do sistema**, pelo botão no cabeçalho ou em Configurações.
- **Modo privacidade** (ícone de olho no cabeçalho): esconde todos os valores em reais e borra os gráficos, para usar o app em público. A escolha fica salva no aparelho.
- **Notificações** com o app fechado (Configurações → Notificações): uma vez por dia, de manhã, lembra das contas e faturas que vencem hoje ou amanhã (ou venceram ontem) e dos proventos que caem no dia seguinte. Tocar na notificação abre a aba certa.
- Navegação por teclado (selects customizados, modais com Esc e foco preso), link "Pular para o conteúdo", rótulos para leitores de tela e respeito a "reduzir movimento".

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, [Tailwind CSS](https://tailwindcss.com) (compilado antes do deploy, sem rodar no navegador), [Phosphor Icons](https://phosphoricons.com) |
| Lógica | JavaScript puro (ES Modules), sem framework e sem bundler |
| Gráficos | [Chart.js](https://www.chartjs.org) |
| Autenticação e banco | Firebase Authentication e Cloud Firestore (tempo real via `onSnapshot`) |
| Cotações | [Brapi](https://brapi.dev) (B3), [Binance](https://www.binance.com) e [CoinGecko](https://www.coingecko.com) (cripto) |
| Índices | CDI do [Banco Central](https://www.bcb.gov.br) (SGS) e Ibovespa/IFIX da B3 |
| Proventos | API pública da [B3](https://www.b3.com.br) (Ações e FIIs), com a Brapi como reserva para Ações |
| Notícias | [Alpha Vantage](https://www.alphavantage.co) e Google News RSS |
| Notificações | [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) + Cron da Vercel |
| Testes | [Vitest](https://vitest.dev) e GitHub Actions |
| Hospedagem | [Vercel](https://vercel.com) |

## Estrutura do projeto

```
.
├── index.html            # Página única: login, sidebar e todas as views
├── css/
│   ├── custom.css        # Animações, scrollbars, glassmorphism e temas
│   └── tailwind.css      # GERADO por `npm run build:css` (não edite à mão)
├── js/
│   ├── app.js            # Ponto de entrada: reage ao login/logout e liga o resto
│   ├── app/              # O "cérebro" do app, dividido por assunto:
│   │   ├── session.js        #   estado compartilhado (usuário, modo, últimos dados) e o filtro de avisos
│   │   ├── subscriptions.js  #   assinaturas do Firestore, redesenho, recorrências, troca de modo
│   │   ├── bindings.js       #   liga a interface (+ bind-finance, bind-investments, bind-settings)
│   │   ├── bills-actions.js  #   contas, cartões e faturas
│   │   ├── quotes.js         #   cotações e índices (CDI/IBOV/IFIX)
│   │   ├── dividend-sync.js  #   proventos da B3
│   │   ├── couple.js         #   espaço de casal e convites
│   │   ├── backup.js, news-feed.js, push-actions.js, account-actions.js
│   ├── errors.js         # Registro de erros em produção (avisa /api/erros)
│   ├── ui.js             # Fachada que reexporta os módulos de js/ui/
│   ├── ui/               # Interface dividida por área: core (estado e helpers), dashboard, transações,
│   │                     # investimentos, proventos, saúde, histórico, alertas, tema, acessibilidade...
│   ├── auth.js           # Login, registro, sessão e recuperação de senha
│   ├── db.js             # CRUD e listeners em tempo real no Firestore
│   ├── calc.js           # Cálculos puros (sem DOM/Firebase), cobertos por testes
│   ├── api.js            # Cotações (Brapi e cripto), proventos (/api/proventos) e índices (/api/indices)
│   ├── gate.js           # Filtro dos avisos do Firestore: ignora dados repetidos e junta rajadas num redesenho
│   ├── format.js         # Formatação de números e datas com formatadores reaproveitados
│   ├── news.js           # Notícias da carteira e do mercado
│   ├── push.js           # Notificações: permissão e token do aparelho (Firebase Cloud Messaging)
│   ├── datepicker.js     # Seletor de data customizado
│   ├── dropdown.js       # Dropdown customizado para os selects
│   └── firebase-config.js# Inicialização do Firebase SDK
├── api/
│   ├── proventos.js      # Função serverless (Vercel): proventos de Ações e FIIs na API da B3
│   ├── noticias.js       # Função serverless (Vercel): notícias por ticker (chave da Alpha Vantage no servidor)
│   ├── brapi.js          # Função serverless (Vercel): proxy da Brapi (chave só no servidor + cache)
│   ├── erros.js          # Função serverless (Vercel): recebe erros do navegador e os põe nos Logs
│   ├── indices.js        # Função serverless (Vercel): CDI (Banco Central), Ibovespa e IFIX (B3)
│   ├── notificacoes.js   # Cron diário (Vercel): lembretes de contas, faturas e proventos por push
│   └── _lib/b3.js        # Busca de proventos na B3, usada por proventos.js e notificacoes.js
├── tests/
│   ├── calc.test.js      # Testes unitários de calc.js
│   ├── ui.test.js        # Testes de tela (jsdom): filtros, modais, abas e totais
│   ├── sw.test.js        # Testes do service worker (cache offline e notificações)
│   ├── api.test.js       # Testes das funções serverless (proteção do cron)
│   ├── gate.test.js      # Testes do filtro dos avisos do Firestore
│   ├── perf.test.js      # Trava as otimizações de carregamento (CSS compilado em dia, módulos pré-carregados...)
│   └── rules/            # Testes das regras do Firestore (emulador)
├── assets/images/        # Favicon e ícones do app
├── tailwind.config.js    # Configuração do Tailwind (tema, cores, animações)
├── tools/tailwind.css    # Entrada do Tailwind (as 3 diretivas); a saída é o css/tailwind.css
├── manifest.webmanifest  # Manifesto do PWA (nome, ícones, cores)
├── sw.js                 # Service worker: interface offline
├── .github/workflows/    # GitHub Actions: roda os testes a cada push
├── firestore.rules       # Regras de segurança do Firestore
├── firebase.json         # Configuração do emulador (testes das regras) e do deploy das regras
├── vercel.json           # URLs limpas, cache de assets e região da função
├── LICENSE               # Licença ISC
└── package.json
```

## Como rodar localmente

Como o projeto usa ES Modules nativos, ele precisa ser servido por HTTP (não abra o `index.html` direto com `file://`). Qualquer servidor estático funciona:

```bash
git clone https://github.com/Henrique-konig/AportFy.git
cd AportFy
npx serve .
```

O Node.js é necessário apenas para o servidor estático de desenvolvimento e para os testes; o app em si não tem build.

> **Mexeu em classes do Tailwind (no `index.html` ou em `js/`)?** Rode `npm run build:css` para regenerar o `css/tailwind.css` e **commite o arquivo junto** (o deploy serve o arquivo pronto). Se esquecer, o teste `tests/perf.test.js` falha e avisa. Para regenerar sozinho enquanto edita: `npx tailwindcss -c tailwind.config.js -i tools/tailwind.css -o css/tailwind.css --watch`.

> Os proventos vêm da função serverless `api/proventos.js`, que só existe na Vercel. Com `npx serve` o restante do app funciona normalmente; os proventos de FIIs ficam indisponíveis (e os de Ações usam a Brapi como reserva). Para testar a função localmente use `npx vercel dev`.

## Configuração

### 1. Firebase (obrigatório)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Em **Authentication**, habilite os métodos **E-mail/senha** e **Google** (Sign-in method → Google → Ativar, escolhendo o e-mail de suporte).
3. Em **Firestore Database**, crie o banco.
4. Em **Configurações do projeto**, copie as credenciais do app web para [`js/firebase-config.js`](js/firebase-config.js):

   ```js
   const firebaseConfig = {
     apiKey: "SUA_API_KEY",
     authDomain: "SEU_PROJETO.firebaseapp.com",
     projectId: "SEU_PROJECT_ID",
     storageBucket: "SEU_PROJETO.firebasestorage.app",
     messagingSenderId: "SEU_MESSAGING_SENDER_ID",
     appId: "SUA_APP_ID",
   };
   ```

5. Publique as regras de [`firestore.rules`](firestore.rules) em **Firestore Database → Regras**, ou via CLI:

   ```bash
   firebase deploy --only firestore:rules
   ```

### 2. Chaves de API (opcionais)

As chaves ficam **fora do código**: variáveis de ambiente da Vercel (Settings → Environment Variables), lidas só pelas funções em `api/`.

| Serviço | Onde configurar | Efeito sem a chave |
| --- | --- | --- |
| Brapi | Variável de ambiente `BRAPI_TOKEN` na Vercel (usada só por [`api/brapi.js`](api/brapi.js)) | Cotações de Ações e FIIs funcionam no plano gratuito, sem token. Com a chave, o limite é maior. A chave nunca vai para o código do site, e as respostas ficam em cache na rede da Vercel (vários usuários pedindo o mesmo ticker viram uma chamada). Os proventos vêm da B3; a Brapi só serve de reserva |
| Alpha Vantage | Variável de ambiente `ALPHA_VANTAGE_KEY` na Vercel (usada só por [`api/noticias.js`](api/noticias.js)) | A aba "Minha Carteira" de Notícias fica vazia e exibe um aviso |

> A Alpha Vantage tem limite de 25 requisições por dia no plano gratuito, por isso as respostas ficam em cache local por 3 horas.

### 3. Notificações (opcional)

O botão de ativar já funciona; para os lembretes diários serem **enviados**, a função agendada [`api/notificacoes.js`](api/notificacoes.js) precisa de duas variáveis de ambiente na Vercel:

| Variável | Como obter |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Configurações do projeto → **Contas de serviço** → *Gerar nova chave privada*. Cole o **conteúdo inteiro** do JSON baixado como valor da variável. Esse arquivo dá acesso total ao projeto: não o coloque no repositório. |
| `CRON_SECRET` | Qualquer texto longo e aleatório (ex: gere com `openssl rand -hex 32`). A Vercel o envia no cron; chamadas sem ele são recusadas. |

O agendamento está no [`vercel.json`](vercel.json) (`0 11 * * *` = 8h de Brasília, uma vez por dia — o máximo do plano gratuito). Depois de configurar, faça um novo deploy. Para testar na hora, chame a função com o segredo:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://aportfy.vercel.app/api/notificacoes
```

A resposta mostra quantos usuários e envios houve. No iPhone, as notificações só funcionam com o app **instalado na tela de início** (iOS 16.4 ou mais novo).

## Modelo de dados

Cada coleção existe nos dois modos: `users/{userId}/…` (Pessoal) e `couples/{coupleId}/…` (Casal).

| Coleção | Conteúdo |
| --- | --- |
| `transactions` | Receitas e despesas (`description`, `amount`, `type`, `category`, `date`) |
| `recurrences` | Modelos de transações lançadas automaticamente todo mês |
| `goals` | Metas financeiras |
| `budgets` | Limite de gasto por categoria |
| `investments` | Posições da carteira, com `purchases` (compras), `sales` (vendas, com o preço médio da época) e `priceHistory` |
| `dividends` | Proventos recebidos (`ticker`, `type`, `amount`, `date`; os importados também guardam `rate`, `shares` e `exDate`) |
| `settings/portfolio` | Metas de alocação da Saúde da Carteira (`targets` por categoria, `maxAssetPct`, `minAssets`) |
| `settings/reserve` | Reserva de emergência (`sources`: metas/investimentos escolhidos, `extra`, `targetMonths`) |
| `bills` | Contas a pagar (`description`, `amount`, `dueDate`, `category`, `paid`, `paidAt`, `recurring`, `transactionId` da despesa gerada) |
| `cards` | Cartões (`name`, `limit`, `closingDay`, `dueDay`) |
| `cardPurchases` | Compras no cartão (`cardId`, `description`, `amount` total, `installments`, `purchaseDate`, `category`). As faturas são calculadas a partir delas |
| `cardInvoices` | Faturas pagas (id `cardId_YYYY-MM`, `paidAt`, `total`, `transactionIds` das despesas lançadas) |
| `pushTokens` | Só em `users/{uid}`: aparelhos com notificações ativadas |

Datas são strings `YYYY-MM-DD`, o que simplifica filtros e agrupamentos por mês.

## Segurança

**O que o projeto já faz**

- As regras em [`firestore.rules`](firestore.rules) restringem as coleções pessoais ao próprio dono (`auth.uid == userId`) e as do casal aos membros do espaço. Tudo que não está nas regras é negado.
- **Validação dos dados:** além de *quem* grava, as regras conferem *o quê*: tipos, valores entre 0 e 1 trilhão, textos com limite de tamanho, tipo da transação (`income`/`expense`), dia da recorrência (1–31) etc. Um cliente alterado não grava lixo nem valores absurdos. Coleções desconhecidas não aceitam gravação.
- **Modo Casal com convite:** quem tem o código só cria um *pedido de entrada*; apenas o dono do espaço aprova (o doc do espaço só aceita membros novos vindos do dono e com pedido aberto). O pedido também exige **e-mail verificado** (`email_verified` do token).
- **Cadastro:** senha de 8 a 128 caracteres com letras e números, e e-mail de confirmação enviado na criação da conta. O login não aplica essa regra, para não trancar contas antigas.
- **Exclusão de conta:** pede a senha de novo (reautenticação), apaga todos os dados do Firestore (e o espaço de casal, se a pessoa for a única integrante), exclui o usuário e limpa o cache local do navegador.
- **Cabeçalhos HTTP** (`vercel.json`): `X-Content-Type-Options`, `X-Frame-Options: DENY` (sem embutir o site em outras páginas), `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` e `Cross-Origin-Opener-Policy`.
- As credenciais do Firebase em `firebase-config.js` identificam o projeto e não são secretas; quem protege os dados são as regras do Firestore. A chave da Alpha Vantage fica só no servidor.
- **Mudou as regras? Publique-as.** O deploy do app não publica o `firestore.rules`: cole o arquivo em **Firestore Database → Regras → Publicar** (ou `firebase deploy --only firestore:rules`).
- Faça backups periódicos em **Configurações → Backup e Restauração**. A restauração **adiciona** os dados do arquivo e nunca apaga o que já existe (e passa pela mesma validação das regras).

**Ajustes no Firebase / Google Cloud (feitos pelo console, não pelo código)**

1. **Política de senha:** Firebase Console → Authentication → Settings → *Password policy*: exija mínimo de 8 caracteres (e, se quiser, maiúscula, número e símbolo). Vale para todas as contas novas, inclusive de quem chamar a API direto.
2. **Restringir a chave de API:** Google Cloud Console → APIs e serviços → Credenciais → a chave "Browser key" do projeto → *Restrições de aplicativo* → *Referenciadores HTTP*: `aportfy.vercel.app/*`, `ecofy-c332d.firebaseapp.com/*` e, para desenvolver, `localhost/*`. Em *Restrições de API*, deixe só Identity Toolkit, Token Service, Cloud Firestore e Firebase Installations/Analytics.
3. **Domínios autorizados:** Authentication → Settings → *Authorized domains*: deixe só `aportfy.vercel.app`, `ecofy-c332d.firebaseapp.com` e `localhost`.
4. **App Check** (opcional, recomendado): Firebase Console → App Check → registre o app web com **reCAPTCHA v3**, copie a *site key* para `APP_CHECK_SITE_KEY` em [`js/firebase-config.js`](js/firebase-config.js), publique o site e, só depois de ver o tráfego "verificado" no console, ative a **imposição** para Firestore e Authentication.
5. **Modelo de e-mail:** Authentication → Templates: ajuste o texto/idioma do e-mail de verificação e de redefinição de senha para português.

## Testes

```bash
npm install
npm test
```

`npm test` roda seis camadas, sem Firebase nem rede:

- **Cálculos** ([`tests/calc.test.js`](tests/calc.test.js)): os cálculos financeiros ficam isolados em [`js/calc.js`](js/calc.js), sem DOM ou Firebase — métricas e preço médio, vendas e histórico, saúde da carteira, aportes, proventos e calendário, comparação com CDI/Ibovespa/IFIX, independência financeira, alertas, orçamento, recorrências, faturas e parcelas de cartão, contas a pagar, saldo projetado, reserva de emergência, CSV e lembretes.
- **Telas** ([`tests/ui.test.js`](tests/ui.test.js)): carrega o `index.html` real num DOM simulado (jsdom) e exercita filtros, modais, abas e totais, além de conferir que todo id usado pelo `ui.js` existe no HTML. Pensado para pegar regressões como filtros que não reagem ou proventos duplicados. Também cobre tema, primeiros passos, acessibilidade (modais, teclado nos selects), contas e cartões, modo privacidade e exportação.
- **Service worker** ([`tests/sw.test.js`](tests/sw.test.js)): o que vai para o cache offline, o que sempre vem da rede (Firebase, APIs) e as notificações (exibir e abrir a aba certa).
- **Funções serverless** ([`tests/api.test.js`](tests/api.test.js), [`tests/brapi.test.js`](tests/brapi.test.js), [`tests/errors.test.js`](tests/errors.test.js)): o cron recusa chamadas sem o segredo; o proxy da Brapi só aceita pedidos conhecidos e nunca expõe a chave; o registro de erros limpa e limita o que recebe.
- **Desempenho** ([`tests/gate.test.js`](tests/gate.test.js), [`tests/perf.test.js`](tests/perf.test.js)): o filtro dos avisos do Firestore e as otimizações de carregamento (CSS do Tailwind em dia, módulos pré-carregados, só os pesos de ícone usados, sem desfoque nos cartões).

**GitHub Actions** ([`.github/workflows/testes.yml`](.github/workflows/testes.yml)) roda `npm test` e os testes das regras (com o emulador) a cada push e pull request. Um X vermelho no commit indica que algo quebrou; em *Settings → Branches* dá para exigir os testes verdes antes de aceitar um pull request.

**Ponta a ponta** (Chromium de verdade, `npm run test:e2e`): o app inteiro abre num navegador, com o Firebase trocado por uma versão falsa em memória ([`tests/e2e/fakes`](tests/e2e/fakes)). Cobrem login, dados na tela, adicionar/excluir transação, pagar conta e fatura, cotações, Modo Casal, restauração de backup, exclusão de conta, importação de proventos, privacidade, tema, registro de erros e o **service worker de verdade** (instala, guarda o app e abre offline). Na primeira vez: `npm install` e `npx playwright install chromium`. Pegam o que o jsdom não vê, e foram a rede de segurança para dividir o `app.js` em módulos.

**Regras do Firestore** (precisam do emulador e de um JDK 21+ instalado):

```bash
npm run test:rules
```

Cobrem quem lê o quê, o fluxo de convite do Modo Casal (pedido, aprovação, recusa, e-mail verificado), a validação do formato dos dados de cada coleção e a exclusão da conta.

## Deploy

O projeto é estático e não precisa de "Build Command" nem de "Output Directory". Pela CLI:

```bash
npm i -g vercel
vercel
```

Ou conecte o repositório pelo [dashboard da Vercel](https://vercel.com/new): o [`vercel.json`](vercel.json) já define URLs limpas e o cache de assets (`/js` e `/css` sempre revalidados, imagens com cache longo).

Depois do primeiro deploy, adicione o domínio gerado em **Firebase Console → Authentication → Settings → Authorized domains**, caso contrário o login não funciona em produção.

## Decisões de projeto

- **Quase sem build.** O JavaScript são ES Modules nativos, sem bundler. A única etapa de build é o CSS do Tailwind (`npm run build:css`): compilar antes, em vez de pelo CDN no navegador, tirou ~370 KB de script e a compilação a cada abertura. O resultado fica versionado, então o deploy continua sendo só arquivos estáticos.
- **Desempenho cuidado.** Os avisos do Firestore passam por um filtro (`js/gate.js`) que ignora dados repetidos e junta rajadas; formatadores de número/data são reaproveitados; as listas usam um único ouvinte de clique; os módulos são pré-carregados em paralelo; e o service worker usa a cópia guardada se a rede demorar mais de 3,5 s.
- **Lógica pura separada.** Tudo que é cálculo vive em `calc.js` e é testável em Node, sem simular um navegador.
- **Tempo real por padrão.** Listeners `onSnapshot` mantêm todas as telas sincronizadas, inclusive entre duas pessoas no Modo Casal.
- **Falha de rede nunca quebra o app.** Cotações, proventos e notícias sempre devolvem um resultado parcial utilizável.
- **Funções serverless só onde precisa.** A B3 e o Banco Central não liberam chamadas diretas do navegador (e a chave da Alpha Vantage não pode ficar no front), então `api/` faz essas pontes; todo o resto continua estático.

## Limitações conhecidas

- **Restaurar backup de contas e cartões** perde o vínculo entre contas/faturas pagas e as despesas que elas geraram (os ids mudam): as despesas ficam nas transações, mas "desfazer pagamento" deixa de apagá-las.
- **Fatura só pode ser paga depois de fechar.** Uma compra registrada depois do pagamento num mês já pago não altera a fatura paga — desfaça e pague de novo.
- **Notificações** saem uma vez por dia (limite do cron no plano gratuito da Vercel) e dependem das variáveis de ambiente acima. O navegador embutido de alguns apps (Instagram, WhatsApp) não recebe notificações.
- **Excluir conta no Modo Casal:** se o espaço tem mais de uma pessoa, ele continua com a outra (os dados compartilhados não são apagados); só os seus dados pessoais e a sua conta saem.
- **Modo Casal:** só o dono aprova novos membros, e membros não podem ser removidos pela interface (a lista só cresce). O código sozinho não dá acesso, mas ainda vale compartilhá-lo só com quem você confia.
- **Nome do projeto Firebase:** o ID do projeto (`ecofy-c332d`) é de antes do rebrand e não pode ser renomeado; só o nome de exibição muda (Console do Firebase → Configurações do projeto). Usuários e dados ficam nele.
- **Histórico de aportes:** posições criadas antes do campo `purchases` aparecem como uma única compra, na data da última compra. Editar quantidade, preço ou data de um ativo também resume o histórico em uma compra única.
- **Cotações e notícias** dependem de APIs gratuitas de terceiros, sujeitas a limites de uso e indisponibilidade.
- **Proventos** vêm da API pública (não documentada) da B3 por meio de uma função serverless; o formato pode mudar sem aviso. O cálculo usa o histórico de aportes (`purchases`) para saber as cotas na data-com — para posições antigas sem histórico, vale a data da última compra.
- **Excluir um ativo** apaga também as compras e vendas dele do histórico (os proventos lançados continuam). Para encerrar uma posição mantendo o histórico, registre a venda.
- **Carteira × Mercado** é uma simulação: usa o preço atual da carteira, não considera proventos nos índices (o Ibovespa e o IFIX já reinvestem) e ignora impostos e taxas.
- **Valores estimados:** o JCP é calculado com 15% de IR (alguns investidores são isentos) e a corretora pode creditar o provento em data ligeiramente diferente da divulgada.

## Licença

Distribuído sob a licença ISC. Veja [`LICENSE`](LICENSE).
