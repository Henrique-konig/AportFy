# AportFy

Dashboard financeiro pessoal e de casal — dark mode, glassmorphism e dados em tempo real via Firebase.

## Stack

- HTML5 + Tailwind CSS (CDN) + Phosphor Icons + Chart.js
- JavaScript puro em ES Modules (sem bundler, sem Node.js)
- Firebase Authentication + Firestore (tempo real via `onSnapshot`)

## Estrutura

```
/aportfy
  ├── index.html
  ├── css/
  │    └── custom.css
  └── js/
       ├── firebase-config.js   (config do Firebase SDK)
       ├── auth.js              (login, registro, sessão)
       ├── db.js                (CRUD de transações e metas no Firestore)
       ├── ui.js                (DOM, modais, Chart.js, temas)
       └── app.js               (ponto de entrada / orquestração)
```

## Rodando localmente

Como o projeto usa ES Modules nativos, ele precisa ser servido por HTTP (não abra o `index.html` direto com `file://`). Qualquer servidor estático funciona, por exemplo:

```bash
npx serve .
```

## Configurando o Firebase

Antes de usar login e dados reais, preencha suas credenciais em [`js/firebase-config.js`](js/firebase-config.js) com os valores do seu projeto (Firebase Console → Configurações do projeto → SDK):

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SUA_APP_ID",
};
```

No Console do Firebase, habilite:
- **Authentication** → método de login "E-mail/Senha"
- **Firestore Database** → modo produção ou teste

Sem essas credenciais o app funciona normalmente (login exibirá erro de conexão), mas login/CRUD não persistem dados reais.

## Deploy no Vercel

O projeto é 100% estático (sem etapa de build), então o deploy é direto:

```bash
npm i -g vercel
vercel
```

Ou conecte o repositório pelo [dashboard da Vercel](https://vercel.com/new) — o `vercel.json` já está configurado (URLs limpas + cache de assets). Não é necessário definir "Build Command" nem "Output Directory": a Vercel serve os arquivos estáticos da raiz automaticamente.

Depois do primeiro deploy, adicione o domínio gerado pela Vercel (ex: `seu-projeto.vercel.app`) em **Firebase Console → Authentication → Settings → Authorized domains**, para que o login funcione em produção.
