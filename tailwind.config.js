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
        // Paleta preta com detalhes vibrantes (verde neon no modo Pessoal, rosa no Casal).
        slate: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3a3a42", 800: "#1f1f26", 900: "#0e0e12", 950: "#000000" },
        blue: { 50: "#ecfff5", 100: "#d1ffe6", 200: "#a3ffcf", 300: "#69ffb0", 400: "#2dff8f", 500: "#19f58a", 600: "#00d66f", 700: "#00a855", 800: "#00763c", 900: "#00532b", 950: "#003119" },
        purple: { 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d" },
        couple: {
          50: "#fdf2f8",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
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
