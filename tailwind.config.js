// Configuração do Tailwind usada para gerar o css/tailwind.css (npm run build:css).
// É a mesma que antes ficava no index.html, quando o Tailwind rodava no navegador pelo CDN.
// O Tailwind lê as classes usadas no index.html e em todos os arquivos de js/ e
// gera só o CSS que o app usa (bem menor, e sem compilar nada na hora de abrir).

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        couple: {
          50: "#faf5ff",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
      },
    },
  },
};
