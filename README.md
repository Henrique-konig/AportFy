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
- **Primeiros passos:** para quem está começando, um roteiro curto (primeira transação, primeiro investimento, metas de alocação, instalar o app) que some quando tudo é feito ou ao dispensar.
- **Central de alertas** (sino no cabeçalho): proventos a receber e recebidos, orçamentos estourando, metas perto do prazo, cotações desatualizadas, problemas de saúde da carteira e pedidos de entrada no Modo Casal.

**Transações**
- Cadastro, edição e exclusão de receitas e despesas.
- Filtros por tipo, categoria e mês, busca por texto e paginação ("Carregar mais").
- Total gasto do período filtrado.
- **Transações recorrentes** lançadas automaticamente todo mês, na data configurada.

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

**Saúde da Carteira**
- Nota de 0 a 100 com quatro componentes: alinhamento às metas por categoria, concentração por ativo, diversificação (número efetivo de ativos) e dependência de poucos pagadores de proventos.
- Diagnóstico com alertas, distribuição atual × meta por categoria e peso de cada ativo frente ao seu limite.
- **Onde aportar:** como dividir o próximo aporte entre categorias para se aproximar das metas, sem vender nada.
- **Projeção** em 1 a 30 anos com aporte mensal, valorização e dividend yield (pré-preenchidos com os dados reais da carteira), em cenários pessimista, base e otimista.
- **Independência financeira:** informe a renda mensal desejada e veja o patrimônio necessário para viver dos proventos (pelo dividend yield da projeção), quanto falta e em quanto tempo você chega lá com os aportes e a valorização da projeção.
- Metas de alocação configuráveis (perfis Conservador, Moderado e Arrojado como ponto de partida, ou personalizadas). A análise é educativa e não indica ativos específicos.

**Conta e dados**
- Login com e-mail e senha, perfil e redefinição de senha por e-mail (em Configurações).
- **Espaço do Casal**: o parceiro(a) usa o seu código para **pedir** entrada e você aprova ou recusa em Configurações; só quem você aprovar vê os mesmos dados no Modo Casal.
- **Backup e restauração** de transações, metas, investimentos e proventos em arquivo `.json`.

**App e acessibilidade**
- **Instalável (PWA):** pode ser instalado no celular ou no computador e abre como aplicativo; a interface carrega mesmo sem internet e os dados já vistos ficam disponíveis offline (cache do Firestore).
- **Tema claro, escuro ou do sistema**, pelo botão no cabeçalho ou em Configurações.
- Navegação por teclado (selects customizados, modais com Esc e foco preso), link "Pular para o conteúdo", rótulos para leitores de tela e respeito a "reduzir movimento".

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, [Tailwind CSS](https://tailwindcss.com) (CDN), [Phosphor Icons](https://phosphoricons.com) |
| Lógica | JavaScript puro (ES Modules), sem framework e sem bundler |
| Gráficos | [Chart.js](https://www.chartjs.org) |
| Autenticação e banco | Firebase Authentication e Cloud Firestore (tempo real via `onSnapshot`) |
| Cotações | [Brapi](https://brapi.dev) (B3), [Binance](https://www.binance.com) e [CoinGecko](https://www.coingecko.com) (cripto) |
| Índices | CDI do [Banco Central](https://www.bcb.gov.br) (SGS) e Ibovespa/IFIX da B3 |
| Proventos | API pública da [B3](https://www.b3.com.br) (Ações e FIIs), com a Brapi como reserva para Ações |
| Notícias | [Alpha Vantage](https://www.alphavantage.co) e Google News RSS |
| Testes | [Vitest](https://vitest.dev) |
| Hospedagem | [Vercel](https://vercel.com) |

## Estrutura do projeto

```
.
├── index.html            # Página única: login, sidebar e todas as views
├── css/
│   └── custom.css        # Animações, scrollbars, glassmorphism e temas
├── js/
│   ├── app.js            # Ponto de entrada: orquestra listeners e eventos
│   ├── ui.js             # Fachada que reexporta os módulos de js/ui/
│   ├── ui/               # Interface dividida por área: core (estado e helpers), dashboard, transações,
│   │                     # investimentos, proventos, saúde, histórico, alertas, tema, acessibilidade...
│   ├── auth.js           # Login, registro, sessão e recuperação de senha
│   ├── db.js             # CRUD e listeners em tempo real no Firestore
│   ├── calc.js           # Cálculos puros (sem DOM/Firebase), cobertos por testes
│   ├── api.js            # Cotações (Brapi e cripto), proventos (/api/proventos) e índices (/api/indices)
│   ├── news.js           # Notícias da carteira e do mercado
│   ├── datepicker.js     # Seletor de data customizado
│   ├── dropdown.js       # Dropdown customizado para os selects
│   └── firebase-config.js# Inicialização do Firebase SDK
├── api/
│   ├── proventos.js      # Função serverless (Vercel): proventos de Ações e FIIs na API da B3
│   ├── noticias.js       # Função serverless (Vercel): notícias por ticker (chave da Alpha Vantage no servidor)
│   └── indices.js        # Função serverless (Vercel): CDI (Banco Central), Ibovespa e IFIX (B3)
├── tests/
│   ├── calc.test.js      # Testes unitários de calc.js
│   ├── ui.test.js        # Testes de tela (jsdom): filtros, modais, abas e totais
│   ├── sw.test.js        # Testes do service worker (cache offline)
│   └── rules/            # Testes das regras do Firestore (emulador)
├── assets/images/        # Favicon e ícones do app
├── manifest.webmanifest  # Manifesto do PWA (nome, ícones, cores)
├── sw.js                 # Service worker: interface offline
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

> Os proventos vêm da função serverless `api/proventos.js`, que só existe na Vercel. Com `npx serve` o restante do app funciona normalmente; os proventos de FIIs ficam indisponíveis (e os de Ações usam a Brapi como reserva). Para testar a função localmente use `npx vercel dev`.

## Configuração

### 1. Firebase (obrigatório)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Em **Authentication**, habilite o método **E-mail/senha**.
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
| Brapi | `BRAPI_TOKEN` em [`js/api.js`](js/api.js) | Cotações de Ações e FIIs funcionam no plano gratuito, sem token. Os proventos vêm da B3; a Brapi só serve de reserva (sem token, o plano gratuito cobre poucos tickers) |
| Alpha Vantage | Variável de ambiente `ALPHA_VANTAGE_KEY` na Vercel (usada só por [`api/noticias.js`](api/noticias.js)) | A aba "Minha Carteira" de Notícias fica vazia e exibe um aviso |

> A Alpha Vantage tem limite de 25 requisições por dia no plano gratuito, por isso as respostas ficam em cache local por 3 horas.

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

Datas são strings `YYYY-MM-DD`, o que simplifica filtros e agrupamentos por mês.

## Segurança

- As regras em [`firestore.rules`](firestore.rules) restringem as coleções pessoais ao próprio dono (`auth.uid == userId`) e as do casal aos membros do espaço.
- As credenciais do Firebase em `firebase-config.js` identificam o projeto e não são secretas; quem protege os dados são as regras do Firestore. Publique-as antes de usar dados reais.
- **Modo Casal com convite:** quem tem o código só cria um *pedido de entrada*; apenas o dono do espaço aprova (o doc do espaço só aceita membros novos vindos do dono e com pedido aberto). Isso é verificado por testes automatizados das regras.
- **Mudou as regras? Publique-as.** O deploy do app não publica o `firestore.rules`: cole o arquivo em **Firestore Database → Regras → Publicar** (ou `firebase deploy --only firestore:rules`).
- Faça backups periódicos em **Configurações → Backup e Restauração**. A restauração **adiciona** os dados do arquivo e nunca apaga o que já existe.

## Testes

```bash
npm install
npm test
```

`npm test` roda três camadas, sem Firebase nem rede:

- **Cálculos** ([`tests/calc.test.js`](tests/calc.test.js)): os cálculos financeiros ficam isolados em [`js/calc.js`](js/calc.js), sem DOM ou Firebase — métricas e preço médio, vendas e histórico, saúde da carteira, aportes, proventos e calendário, comparação com CDI/Ibovespa/IFIX, independência financeira, alertas, orçamento e recorrências.
- **Telas** ([`tests/ui.test.js`](tests/ui.test.js)): carrega o `index.html` real num DOM simulado (jsdom) e exercita filtros, modais, abas e totais, além de conferir que todo id usado pelo `ui.js` existe no HTML. Pensado para pegar regressões como filtros que não reagem ou proventos duplicados. Também cobre tema, primeiros passos e acessibilidade (modais, teclado nos selects).
- **Service worker** ([`tests/sw.test.js`](tests/sw.test.js)): o que vai para o cache offline e o que sempre vem da rede (Firebase, APIs).

**Regras do Firestore** (precisam do emulador e de um JDK 21+ instalado):

```bash
npm run test:rules
```

Cobrem quem lê o quê, o fluxo de convite do Modo Casal (pedido, aprovação, recusa) e que ninguém entra num espaço sem a aprovação do dono.

## Deploy

O projeto é estático e não precisa de "Build Command" nem de "Output Directory". Pela CLI:

```bash
npm i -g vercel
vercel
```

Ou conecte o repositório pelo [dashboard da Vercel](https://vercel.com/new): o [`vercel.json`](vercel.json) já define URLs limpas e o cache de assets (`/js` e `/css` sempre revalidados, imagens com cache longo).

Depois do primeiro deploy, adicione o domínio gerado em **Firebase Console → Authentication → Settings → Authorized domains**, caso contrário o login não funciona em produção.

## Decisões de projeto

- **Zero build.** ES Modules nativos e CDNs mantêm o projeto simples de rodar, depurar e hospedar.
- **Lógica pura separada.** Tudo que é cálculo vive em `calc.js` e é testável em Node, sem simular um navegador.
- **Tempo real por padrão.** Listeners `onSnapshot` mantêm todas as telas sincronizadas, inclusive entre duas pessoas no Modo Casal.
- **Falha de rede nunca quebra o app.** Cotações, proventos e notícias sempre devolvem um resultado parcial utilizável.
- **Funções serverless só onde precisa.** A B3 e o Banco Central não liberam chamadas diretas do navegador (e a chave da Alpha Vantage não pode ficar no front), então `api/` faz essas pontes; todo o resto continua estático.

## Limitações conhecidas

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
