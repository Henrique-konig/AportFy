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

## Sobre

O AportFy reúne em um só painel o dia a dia financeiro (receitas, despesas, metas e orçamento) e o acompanhamento de uma carteira de investimentos, com atualização em tempo real via Firestore. Funciona em dois modos: **Pessoal** (dados só seus) e **Casal** (dados compartilhados com outra pessoa).

É uma aplicação 100% estática: HTML, CSS e JavaScript em ES Modules nativos, sem bundler e sem etapa de build.

## Funcionalidades

**Dashboard**
- KPIs de saldo, receitas, despesas e progresso de metas, com comparação em relação ao mês anterior.
- Filtro por mês/ano ou **Todos os meses** (acumulado). Ao escolher um mês, o saldo mostra o resultado daquele mês.
- Fluxo de caixa dos últimos 6 meses e despesas por categoria do período selecionado.

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
- Cotações automáticas de **Ações e FIIs da B3** (Brapi), com fallback para o último preço salvo.
- **Aportes mensais**: quanto foi investido em cada um dos últimos 12 meses, com média e filtro por ativo.
- Evolução do capital por categoria, alocação da carteira e detalhe do ativo com histórico de preço.
- **Proventos a Receber**: proventos já anunciados e ainda não pagos de Ações e FIIs, com data-com, data de pagamento e o total calculado pelas cotas que você tinha na data-com.
- **Proventos** (dividendos, JCP e rendimentos): registro manual ou importação automática dos já pagos (Ações e FIIs), com filtro por mês e yield on cost.

**Notícias**
- *Minha Carteira*: notícias filtradas pelos ativos cadastrados (Alpha Vantage).
- *Mercado Diário*: manchetes do mercado em pt-BR (Google News RSS).

**Relatórios**
- Receitas, despesas e economia líquida por mês/ano ou acumulado, maiores categorias e maiores despesas, e fluxo de caixa de 12 meses.

**Conta e dados**
- Login com e-mail e senha, perfil e redefinição de senha por e-mail (em Configurações).
- **Espaço do Casal**: código de compartilhamento para ver as mesmas transações em conjunto.
- **Backup e restauração** de transações, metas, investimentos e proventos em arquivo `.json`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | HTML5, [Tailwind CSS](https://tailwindcss.com) (CDN), [Phosphor Icons](https://phosphoricons.com) |
| Lógica | JavaScript puro (ES Modules), sem framework e sem bundler |
| Gráficos | [Chart.js](https://www.chartjs.org) |
| Autenticação e banco | Firebase Authentication e Cloud Firestore (tempo real via `onSnapshot`) |
| Cotações e proventos | [Brapi](https://brapi.dev) (Ações) e API pública da [B3](https://www.b3.com.br) (FIIs) |
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
│   ├── ui.js             # DOM, modais, filtros e gráficos (Chart.js)
│   ├── auth.js           # Login, registro, sessão e recuperação de senha
│   ├── db.js             # CRUD e listeners em tempo real no Firestore
│   ├── calc.js           # Cálculos puros (sem DOM/Firebase), cobertos por testes
│   ├── api.js            # Cotações e calendário de proventos (Brapi e função /api/proventos)
│   ├── news.js           # Notícias da carteira e do mercado
│   ├── datepicker.js     # Seletor de data customizado
│   ├── dropdown.js       # Dropdown customizado para os selects
│   └── firebase-config.js# Inicialização do Firebase SDK
├── api/
│   └── proventos.js      # Função serverless (Vercel): proventos de FIIs na API da B3
├── tests/
│   └── calc.test.js      # Testes unitários de calc.js
├── assets/images/        # Favicon
├── firestore.rules       # Regras de segurança do Firestore
├── vercel.json           # URLs limpas, cache de assets e região da função
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

> Os proventos de **FIIs** vêm da função serverless `api/proventos.js`, que só existe na Vercel. Com `npx serve` o restante do app funciona normalmente e o painel "Proventos a Receber" avisa que não obteve resposta para os FIIs. Para testar a função localmente use `npx vercel dev`.

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

| Serviço | Onde configurar | Efeito sem a chave |
| --- | --- | --- |
| Brapi | `BRAPI_TOKEN` em [`js/api.js`](js/api.js) | Cotações e proventos de Ações e cotações de FIIs funcionam no plano gratuito, sem token |
| Alpha Vantage | `ALPHA_VANTAGE_KEY` em [`js/news.js`](js/news.js) | A aba "Minha Carteira" de Notícias fica vazia e exibe um aviso |

> A Alpha Vantage tem limite de 25 requisições por dia no plano gratuito, por isso as respostas ficam em cache local por 3 horas.

## Modelo de dados

Cada coleção existe nos dois modos: `users/{userId}/…` (Pessoal) e `couples/{coupleId}/…` (Casal).

| Coleção | Conteúdo |
| --- | --- |
| `transactions` | Receitas e despesas (`description`, `amount`, `type`, `category`, `date`) |
| `recurrences` | Modelos de transações lançadas automaticamente todo mês |
| `goals` | Metas financeiras |
| `budgets` | Limite de gasto por categoria |
| `investments` | Posições da carteira, com `purchases` (histórico de aportes) e `priceHistory` |
| `dividends` | Proventos recebidos (`ticker`, `type`, `amount`, `date`) |

Datas são strings `YYYY-MM-DD`, o que simplifica filtros e agrupamentos por mês.

## Segurança

- As regras em [`firestore.rules`](firestore.rules) restringem as coleções pessoais ao próprio dono (`auth.uid == userId`) e as do casal aos membros do espaço.
- As credenciais do Firebase em `firebase-config.js` identificam o projeto e não são secretas; quem protege os dados são as regras do Firestore. Publique-as antes de usar dados reais.
- Faça backups periódicos em **Configurações → Backup e Restauração**. A restauração **adiciona** os dados do arquivo e nunca apaga o que já existe.

## Testes

Os cálculos financeiros ficam isolados em [`js/calc.js`](js/calc.js), sem dependência de DOM ou Firebase, e são cobertos por testes unitários:

```bash
npm install
npm test
```

Cobertura atual: métricas e preço médio de investimentos, aportes mensais, série mensal de fluxo de caixa, orçamento por categoria, recorrências e deduplicação de proventos.

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
- **Falha de rede nunca quebra o app.** Cotações e notícias sempre devolvem um resultado parcial utilizável.

## Limitações conhecidas

- **Modo Casal sem convite bilateral:** quem descobrir o código de um espaço consegue entrar nele. O código só aparece na tela de Configurações do dono e deve ser compartilhado apenas com quem você confia.
- **Histórico de aportes:** posições criadas antes do campo `purchases` aparecem como uma única compra, na data da última compra. Editar quantidade, preço ou data de um ativo também resume o histórico em uma compra única.
- **Cotações e notícias** dependem de APIs gratuitas de terceiros, sujeitas a limites de uso e indisponibilidade.
- **Proventos de FIIs** vêm da API pública (não documentada) da B3 por meio de uma função serverless; o formato pode mudar sem aviso. O cálculo usa o histórico de aportes (`purchases`) para saber as cotas na data-com — para posições antigas sem histórico, vale a data da última compra.
